import { FramePose, GaitMetrics, KinematicSequence, Landmark, metric, unavailableMetric } from "../types/telemetry";
import { smoothArray } from "./signalProcessor";

const MIN_VISIBILITY = 0.5;

function validPoint(point: Landmark | null | undefined): point is Landmark {
  return Boolean(point && point.visibility !== null && point.visibility >= MIN_VISIBILITY);
}

function finiteValues(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

export function findPeaks(
  data: (number | null)[],
  timestamps: number[],
  minimumSeparationSec: number,
  prominence: number
): number[] {
  const peaks: number[] = [];
  let lastPeakTime = -Infinity;

  for (let index = 1; index < data.length - 1; index++) {
    const value = data[index];
    if (value === null || !Number.isFinite(value)) continue;
    let plateauEnd = index;
    while (plateauEnd + 1 < data.length && data[plateauEnd + 1] === value) plateauEnd++;
    const before = data[index - 1];
    const after = data[plateauEnd + 1];
    const peakIndex = Math.floor((index + plateauEnd) / 2);
    const time = timestamps[peakIndex];
    if (
      typeof before !== "number" ||
      typeof after !== "number" ||
      !Number.isFinite(value) ||
      !Number.isFinite(time) ||
      value <= before ||
      value <= after ||
      time - lastPeakTime < minimumSeparationSec
    ) {
      index = plateauEnd;
      continue;
    }

    const windowStart = Math.max(0, peakIndex - 3);
    const windowEnd = Math.min(data.length, peakIndex + 4);
    const neighborhood = finiteValues(data.slice(windowStart, windowEnd));
    if (neighborhood.length < 3) {
      index = plateauEnd;
      continue;
    }
    const localMinimum = Math.min(...neighborhood);
    if (value - localMinimum >= prominence) {
      peaks.push(peakIndex);
      lastPeakTime = time;
    }
    index = plateauEnd;
  }
  return peaks;
}

function emptyGaitMetrics(reason: string): GaitMetrics {
  return {
    cadenceSpm: unavailableMetric("steps/min", reason),
    avgStepTimeSec: unavailableMetric("s", reason),
    groundContactTimeMs: unavailableMetric("ms", "Not directly measured by this video method."),
    flightTimeMs: unavailableMetric("ms", "Not directly measured by this video method."),
    dutyFactorPct: unavailableMetric("%", "Requires measured contact and flight events."),
    pelvisVerticalRangeBodyHeightPct: unavailableMetric("% body height", reason),
    ankleHipOffsetBodyHeightPct: unavailableMetric("% body height", reason),
    maxHipLineImageTiltDeg: unavailableMetric("deg", reason),
    stepTimeCvPct: unavailableMetric("%", reason),
    stancePct: unavailableMetric("%", "Contact/flight phase duration is not measured."),
    swingPct: unavailableMetric("%", "Contact/flight phase duration is not measured."),
    leftContacts: [],
    rightContacts: [],
  };
}

export function analyzeGaitCycles(
  timestamps: number[],
  leftAnkleY: (number | null)[],
  rightAnkleY: (number | null)[],
  kinematics: KinematicSequence,
  frames: FramePose[]
): GaitMetrics {
  const validAnkleY = [...finiteValues(leftAnkleY), ...finiteValues(rightAnkleY)];
  if (timestamps.length < 3 || validAnkleY.length < 6) {
    return emptyGaitMetrics("Insufficient valid ankle tracking to estimate this metric.");
  }

  const range = Math.max(...validAnkleY) - Math.min(...validAnkleY);
  if (!Number.isFinite(range) || range <= 0) {
    return emptyGaitMetrics("Ankle trajectory has no usable vertical range.");
  }

  const prominence = Math.max(1, range * 0.08);
  const leftSmooth = smoothArray(leftAnkleY, 3);
  const rightSmooth = smoothArray(rightAnkleY, 3);
  const leftContacts = findPeaks(leftSmooth, timestamps, 0.25, prominence);
  const rightContacts = findPeaks(rightSmooth, timestamps, 0.25, prominence);
  const allContacts = [
    ...leftContacts.map((frame) => ({ frame, time: timestamps[frame], leg: "left" as const })),
    ...rightContacts.map((frame) => ({ frame, time: timestamps[frame], leg: "right" as const })),
  ].sort((a, b) => a.time - b.time);

  const validDurations: number[] = [];
  for (let index = 1; index < allContacts.length; index++) {
    const previous = allContacts[index - 1];
    const current = allContacts[index];
    const duration = current.time - previous.time;
    if (previous.leg !== current.leg && Number.isFinite(duration) && duration > 0) validDurations.push(duration);
  }
  const reason = validDurations.length < 2
    ? "At least three alternating left/right ankle events are needed for a cadence estimate."
    : "";
  const hasCadence = !reason;
  const meanStepTime = hasCadence
    ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length
    : null;
  const elapsed = validDurations.reduce((sum, duration) => sum + duration, 0);
  const cadence = hasCadence && elapsed > 0 ? (validDurations.length / elapsed) * 60 : null;
  const variance = meanStepTime === null
    ? null
    : validDurations.reduce((sum, duration) => sum + (duration - meanStepTime) ** 2, 0) / validDurations.length;
  const stepCv = variance !== null && meanStepTime
    ? (Math.sqrt(variance) / meanStepTime) * 100
    : null;

  const pelvis = finiteValues(kinematics.pelvisCenterY);
  const torso = finiteValues(kinematics.torsoHeightPx);
  const verticalOscillation = pelvis.length > 1 && torso.length > 0
    ? ((Math.max(...pelvis) - Math.min(...pelvis)) / (torso.reduce((sum, value) => sum + value, 0) / torso.length)) * 100
    : null;

  const offsets: number[] = [];
  for (const contact of allContacts) {
    const frame = frames[contact.frame];
    const ankleIndex = contact.leg === "left" ? 27 : 28;
    const hipIndex = contact.leg === "left" ? 23 : 24;
    const ankle = frame?.landmarks[ankleIndex];
    const hip = frame?.landmarks[hipIndex];
    const torsoHeight = kinematics.torsoHeightPx[contact.frame];
    if (validPoint(ankle) && validPoint(hip) && torsoHeight && torsoHeight > 0) {
      offsets.push((Math.abs(ankle.x - hip.x) / torsoHeight) * 100);
    }
  }

  const pelvicValues = finiteValues(kinematics.hipLineImageTiltAngles);
  return {
    cadenceSpm: metric(cadence === null ? null : Math.round(cadence * 10) / 10, "algorithmically-estimated", "steps/min", "Estimated from alternating left/right peaks in tracked ankle vertical trajectories; not a direct sensor measurement."),
    avgStepTimeSec: metric(meanStepTime, "algorithmically-estimated", "s", "Mean interval between alternating left/right ankle trajectory events."),
    groundContactTimeMs: unavailableMetric("ms", "Video sampling and 2D landmarks do not directly identify foot-ground contact."),
    flightTimeMs: unavailableMetric("ms", "Video sampling and 2D landmarks do not directly identify foot-ground contact."),
    dutyFactorPct: unavailableMetric("%", "Not calculated because contact and flight durations are unavailable."),
    pelvisVerticalRangeBodyHeightPct: metric(
      verticalOscillation === null ? null : Math.round(verticalOscillation * 10) / 10,
      "heuristic-estimate",
      "% body height",
      "Image-space pelvis vertical range divided by mean shoulder-to-hip pixel distance; uncalibrated."
    ),
    ankleHipOffsetBodyHeightPct: metric(
      offsets.length ? Math.round((offsets.reduce((sum, value) => sum + value, 0) / offsets.length) * 10) / 10 : null,
      "heuristic-estimate",
      "% body height",
      "Mean absolute horizontal ankle-to-hip offset at detected events, normalized by torso pixel height; camera direction and physical scale are unknown."
    ),
    maxHipLineImageTiltDeg: metric(
      pelvicValues.length ? Math.round(Math.max(...pelvicValues) * 10) / 10 : null,
      "landmark-derived",
      "deg",
      "Maximum absolute image-plane angle of the line joining the two tracked hip landmarks."
    ),
    stepTimeCvPct: metric(stepCv === null ? null : Math.round(stepCv * 10) / 10, "algorithmically-estimated", "%", "Coefficient of variation of detected event intervals; requires at least three events."),
    stancePct: unavailableMetric("%", "Contact phase duration is not directly detected."),
    swingPct: unavailableMetric("%", "Contact phase duration is not directly detected."),
    leftContacts,
    rightContacts,
  };
}
