import { CompleteAnalysisReport, MetricResult, metric } from "../types/telemetry";
import { meanForwardTrunkLean } from "./formScorer";
import {
  REFERENCE_RANGES,
  ReferencePosition,
  ReferenceRange,
  getReferenceGuidance,
  getReferencePosition,
} from "./researchReferences";

export interface MetricComparison {
  label: string;
  observed: MetricResult;
  reference: ReferenceRange | null;
  /** Reference band as text, or a note on why there is none. */
  referenceText: string;
  position: ReferencePosition | "unavailable" | "observed-only";
  positionText: string;
  guidance: string;
  score: MetricResult | null;
}

const POSITION_TEXT: Record<ReferencePosition, string> = {
  below: "Below reference",
  within: "Within reference",
  above: "Above reference",
};

function compare(label: string, observed: MetricResult, reference: ReferenceRange, score: MetricResult | null): MetricComparison {
  const referenceText = `${reference.minimum}-${reference.maximum} ${reference.unit}`;
  if (observed.value === null) {
    return { label, observed, reference, referenceText, position: "unavailable", positionText: "Unavailable", guidance: observed.explanation, score };
  }
  const position = getReferencePosition(reference, observed.value);
  return {
    label,
    observed,
    reference,
    referenceText,
    position,
    positionText: POSITION_TEXT[position],
    guidance: getReferenceGuidance(reference, observed.value),
    score,
  };
}

function observedOnly(label: string, observed: MetricResult, note: string, referenceText = "No published range"): MetricComparison {
  return {
    label,
    observed,
    reference: null,
    referenceText,
    position: observed.value === null ? "unavailable" : "observed-only",
    positionText: observed.value === null ? "Unavailable" : "Observed only",
    guidance: observed.value === null ? observed.explanation : note,
    score: null,
  };
}

export function getMetricComparisons(report: CompleteAnalysisReport): MetricComparison[] {
  const { gait, symmetry, formScore, kinematics } = report;
  const lean = meanForwardTrunkLean(kinematics);
  const leanMetric = metric(
    lean,
    "landmark-derived",
    "deg",
    kinematics.facingDirection === null
      ? "Running direction could not be determined, so forward lean is unavailable."
      : "Mean shoulder-to-hip angle from vertical, positive when leaning in the running direction."
  );

  return [
    compare("Cadence", gait.cadenceSpm, REFERENCE_RANGES.cadence, formScore.subScores.cadence),
    compare("Shank angle at foot strike", gait.footStrikeShankAngleDeg, REFERENCE_RANGES.footStrikeShank, formScore.subScores.footStrike),
    compare("Knee flexion at midstance", gait.midstanceKneeFlexionDeg, REFERENCE_RANGES.midstanceKneeFlexion, formScore.subScores.kneeFlexion),
    compare("Forward trunk lean", leanMetric, REFERENCE_RANGES.trunkLean, formScore.subScores.posture),
    observedOnly(
      "Left/right symmetry",
      symmetry.symmetryIndexPct,
      "Difference between your legs in step time and landing position. Shown for information only: from a single side-on video the far leg is tracked less reliably than the near leg, so it is not scored.",
      `Typical: under ${REFERENCE_RANGES.symmetryIndex.maximum}% (not scored)`
    ),
    compare("Stride-time variation", gait.strideTimeCvPct, REFERENCE_RANGES.strideTimeVariation, formScore.subScores.consistency),
    observedOnly(
      "Foot landing ahead of hip",
      gait.ankleAheadOfHipTorsoPct,
      "Landing closer under the hips lowers braking forces (Lieberman et al., 2015). No numeric threshold is published for video."
    ),
    observedOnly(
      "Vertical oscillation",
      gait.verticalOscillationTorsoPct,
      "Lower bounce is associated with better running economy (Folland et al., 2017), but this image-space value is not in centimetres."
    ),
  ];
}
