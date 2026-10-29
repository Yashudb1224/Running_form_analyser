import { CompleteAnalysisReport, EvidenceFrame, EvidenceKind, FootStrikeEvent } from "../types/telemetry";
import { REFERENCE_RANGES, ReferenceRange } from "./researchReferences";
import { drawCaption, drawKneeFlexion, drawShankAngle, drawSkeleton, drawTrunkLean, overlayScale } from "./overlayDrawing";

const EVIDENCE_MAX_WIDTH = 960;
const EVIDENCE_JPEG_QUALITY = 0.85;

export interface EvidenceMoment {
  id: string;
  kind: EvidenceKind;
  leg: "left" | "right" | null;
  frameIndex: number;
  value: number;
  unit: string;
  title: string;
}

export const EVIDENCE_REFERENCE: Record<EvidenceKind, ReferenceRange> = {
  "foot-strike": REFERENCE_RANGES.footStrikeShank,
  midstance: REFERENCE_RANGES.midstanceKneeFlexion,
  "trunk-lean": REFERENCE_RANGES.trunkLean,
};

/** Picks the item whose value is closest to the mean, i.e. the most representative example. */
function mostRepresentative<T>(items: T[], value: (item: T) => number): T | null {
  if (!items.length) return null;
  const average = items.reduce((sum, item) => sum + value(item), 0) / items.length;
  return items.reduce((best, item) => (Math.abs(value(item) - average) < Math.abs(value(best) - average) ? item : best));
}

/**
 * Chooses one representative video frame per scored visual measure and leg: the foot strike and
 * midstance whose values are closest to that leg's average, and the frame closest to the mean
 * trunk lean. These are the frames shown as evidence for the scores.
 */
export function selectEvidenceMoments(report: Pick<CompleteAnalysisReport, "gait" | "kinematics" | "frames">): EvidenceMoment[] {
  const moments: EvidenceMoment[] = [];
  const legName = (leg: "left" | "right") => (leg === "left" ? "Left" : "Right");

  for (const leg of ["left", "right"] as const) {
    const strikes = report.gait.events.filter(
      (event): event is FootStrikeEvent & { shankAngleDeg: number } => event.side === leg && event.shankAngleDeg !== null
    );
    const strike = mostRepresentative(strikes, (event) => event.shankAngleDeg);
    if (strike) {
      moments.push({
        id: `foot-strike-${leg}`,
        kind: "foot-strike",
        leg: strike.leg,
        frameIndex: strike.strikeFrame,
        value: strike.shankAngleDeg,
        unit: "deg",
        title: `${legName(leg)} foot strike`,
      });
    }
  }

  for (const leg of ["left", "right"] as const) {
    const stances = report.gait.events.filter(
      (event): event is FootStrikeEvent & { midstanceKneeFlexionDeg: number } => event.side === leg && event.midstanceKneeFlexionDeg !== null
    );
    const stance = mostRepresentative(stances, (event) => event.midstanceKneeFlexionDeg);
    if (stance) {
      moments.push({
        id: `midstance-${leg}`,
        kind: "midstance",
        leg: stance.leg,
        frameIndex: stance.midstanceFrame,
        value: stance.midstanceKneeFlexionDeg,
        unit: "deg",
        title: `${legName(leg)} midstance`,
      });
    }
  }

  const leanFrames = report.kinematics.trunkForwardLeanAngles
    .map((value, frameIndex) => ({ value, frameIndex }))
    .filter((item): item is { value: number; frameIndex: number } =>
      item.value !== null && Number.isFinite(item.value) && Boolean(report.frames[item.frameIndex]?.tracked)
    );
  const lean = mostRepresentative(leanFrames, (item) => item.value);
  if (lean) {
    moments.push({ id: "trunk-lean", kind: "trunk-lean", leg: null, frameIndex: lean.frameIndex, value: lean.value, unit: "deg", title: "Trunk lean" });
  }
  return moments;
}

function measurementLabel(moment: EvidenceMoment): string {
  const value = `${moment.value.toFixed(1)}°`;
  if (moment.kind === "foot-strike") return `Shin ${value}`;
  if (moment.kind === "midstance") return `Knee flexion ${value}`;
  return `Lean ${value}`;
}

/**
 * Seeks the analysis video to each evidence moment and renders the frame with its measurement drawn
 * on top. Browser-only. Failures for individual frames are skipped rather than failing the analysis.
 */
export async function captureEvidenceFrames(
  video: HTMLVideoElement,
  report: Pick<CompleteAnalysisReport, "gait" | "kinematics" | "frames">,
  seek: (time: number) => Promise<number>
): Promise<EvidenceFrame[]> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return [];
  const full = document.createElement("canvas");
  full.width = width;
  full.height = height;
  const fullCtx = full.getContext("2d");
  const outScale = Math.min(1, EVIDENCE_MAX_WIDTH / width);
  const output = document.createElement("canvas");
  output.width = Math.round(width * outScale);
  output.height = Math.round(height * outScale);
  const outputCtx = output.getContext("2d");
  if (!fullCtx || !outputCtx) return [];
  // Snapshots are viewed as thumbnails, so annotate larger than the live overlay does.
  const scale = Math.max(overlayScale(width, height), Math.min(width, height * 1.4) / 480);
  const facing = report.kinematics.facingDirection;
  const evidence: EvidenceFrame[] = [];

  for (const moment of selectEvidenceMoments(report)) {
    const frame = report.frames[moment.frameIndex];
    if (!frame) continue;
    try {
      await seek(frame.timestamp);
      fullCtx.drawImage(video, 0, 0, width, height);
      drawSkeleton(fullCtx, frame.landmarks, scale, { opacity: 0.55, legTags: true });
      const label = measurementLabel(moment);
      const drawn = moment.kind === "foot-strike"
        ? drawShankAngle(fullCtx, frame.landmarks, moment.leg ?? "left", facing, scale, label)
        : moment.kind === "midstance"
          ? drawKneeFlexion(fullCtx, frame.landmarks, moment.leg ?? "left", facing, scale, label)
          : drawTrunkLean(fullCtx, frame.landmarks, facing, scale, label);
      if (!drawn) continue;
      const reference = EVIDENCE_REFERENCE[moment.kind];
      drawCaption(
        fullCtx,
        `${moment.title} · ${frame.timestamp.toFixed(2)} s · ${label} (typical ${reference.minimum}–${reference.maximum}°)`,
        scale
      );
      outputCtx.drawImage(full, 0, 0, output.width, output.height);
      evidence.push({
        ...moment,
        timestamp: frame.timestamp,
        imageDataUrl: output.toDataURL("image/jpeg", EVIDENCE_JPEG_QUALITY),
        width: output.width,
        height: output.height,
      });
    } catch (error) {
      console.error(`Could not capture evidence frame ${moment.id}:`, error);
    }
  }
  return evidence;
}
