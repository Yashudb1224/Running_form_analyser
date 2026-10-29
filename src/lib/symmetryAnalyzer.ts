import { GaitMetrics, KinematicSequence, MetricResult, SymmetryMetrics, metric, unavailableMetric } from "../types/telemetry";

function finiteValues(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function angleExtrema(values: (number | null)[]): { min: number | null; max: number | null } {
  const valid = finiteValues(values);
  return valid.length ? { min: Math.min(...valid), max: Math.max(...valid) } : { min: null, max: null };
}

function unavailableScore(reason: string): MetricResult {
  return unavailableMetric("%", reason);
}

export function evaluateSymmetryAndConsistency(
  kinematics: KinematicSequence,
  gait: GaitMetrics
): SymmetryMetrics {
  const leftKnee = angleExtrema(kinematics.leftKneeAngles);
  const rightKnee = angleExtrema(kinematics.rightKneeAngles);
  const leftElbow = mean(finiteValues(kinematics.leftElbowAngles));
  const rightElbow = mean(finiteValues(kinematics.rightElbowAngles));

  const pairedKnees = kinematics.leftKneeAngles
    .map((left, index) => ({ left, right: kinematics.rightKneeAngles[index] }))
    .filter((pair): pair is { left: number; right: number } =>
      pair.left !== null && pair.right !== null && Number.isFinite(pair.left) && Number.isFinite(pair.right)
    );
  const pairedMean = pairedKnees.length
    ? pairedKnees.reduce((sum, pair) => sum + (Math.abs(pair.left) + Math.abs(pair.right)) / 2, 0) / pairedKnees.length
    : null;
  const meanDifference = pairedKnees.length
    ? pairedKnees.reduce((sum, pair) => sum + Math.abs(pair.left - pair.right), 0) / pairedKnees.length
    : null;
  const kneeSi = pairedMean !== null && pairedMean > 0 && meanDifference !== null
    ? (meanDifference / pairedMean) * 100
    : null;
  const elbowMeanMagnitude = leftElbow !== null && rightElbow !== null
    ? (Math.abs(leftElbow) + Math.abs(rightElbow)) / 2
    : 0;
  const elbowSimilarity = leftElbow !== null && rightElbow !== null && elbowMeanMagnitude > 0
    ? Math.max(0, 100 - (Math.abs(leftElbow - rightElbow) / elbowMeanMagnitude) * 100)
    : null;

  const symmetryScore = kneeSi === null
    ? unavailableScore("Both knee angles must be visible in the same frames to compare them.")
    : metric(Math.max(0, Math.round(100 - kneeSi)), "heuristic-estimate", "%", "Rule-based complement of mean paired knee-angle asymmetry; not clinically validated.");
  const cv = gait.stepTimeCvPct.value;

  return {
    kneeAngleSymmetryScore: symmetryScore,
    strideConsistencyScore: cv === null
      ? unavailableScore("Stride consistency requires enough detected gait events.")
      : metric(Math.max(0, Math.round(100 - cv)), "heuristic-estimate", "%", "Rule-based 100 minus step-time coefficient of variation; not clinically validated."),
    kneeAngleMaxLeftDeg: metric(leftKnee.max, "landmark-derived", "deg", "Maximum internal 2D angle at the left knee; nearer 180° indicates a straighter configuration."),
    kneeAngleMaxRightDeg: metric(rightKnee.max, "landmark-derived", "deg", "Maximum internal 2D angle at the right knee; nearer 180° indicates a straighter configuration."),
    kneeAngleMinLeftDeg: metric(leftKnee.min, "landmark-derived", "deg", "Minimum internal 2D angle at the left knee; not labelled as a flexion angle."),
    kneeAngleMinRightDeg: metric(rightKnee.min, "landmark-derived", "deg", "Minimum internal 2D angle at the right knee; not labelled as a flexion angle."),
    kneeAngleAsymmetryPct: metric(kneeSi, "algorithmically-estimated", "%", "Mean frame-paired absolute knee-angle difference normalized by mean angle magnitude."),
    elbowAngleSimilarityPct: metric(elbowSimilarity, "algorithmically-estimated", "%", "A comparison of mean left/right elbow angles; not a measure of arm swing amplitude."),
  };
}
