import { GaitMetrics, KinematicSequence, MetricResult, SymmetryMetrics, metric, unavailableMetric } from "../types/telemetry";
import { REFERENCE_RANGES, scoreAgainstReference } from "./researchReferences";

/** Above this share of overlapping-leg frames, left/right labels are not trustworthy. */
export const MAX_MERGED_LEG_FRAMES_PCT = 50;

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

/** Robinson symmetry index: |L - R| relative to the mean of both sides, in percent. */
export function symmetryIndex(left: number | null, right: number | null): number | null {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return null;
  const average = (Math.abs(left) + Math.abs(right)) / 2;
  return average > 0 ? (Math.abs(left - right) / average) * 100 : null;
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function unavailableScore(reason: string): MetricResult {
  return unavailableMetric("/ 100", reason);
}

export function evaluateSymmetryAndConsistency(
  kinematics: KinematicSequence,
  gait: GaitMetrics
): SymmetryMetrics {
  const leftKnee = angleExtrema(kinematics.leftKneeAngles);
  const rightKnee = angleExtrema(kinematics.rightKneeAngles);
  const leftElbow = mean(finiteValues(kinematics.leftElbowAngles));
  const rightElbow = mean(finiteValues(kinematics.rightElbowAngles));

  // Compare like-for-like events per leg; the two legs are half a cycle apart at any instant.
  const kneeSi = symmetryIndex(gait.left.midstanceKneeFlexionDeg.value, gait.right.midstanceKneeFlexionDeg.value);
  const stepSi = symmetryIndex(gait.left.stepTimeSec.value, gait.right.stepTimeSec.value);
  const landingSi = symmetryIndex(gait.left.landingOffsetTorsoPct.value, gait.right.landingOffsetTorsoPct.value);
  const leftShank = gait.left.footStrikeShankAngleDeg.value;
  const rightShank = gait.right.footStrikeShankAngleDeg.value;
  const shankDifference = leftShank !== null && rightShank !== null ? Math.abs(leftShank - rightShank) : null;

  const elbowMeanMagnitude = leftElbow !== null && rightElbow !== null
    ? (Math.abs(leftElbow) + Math.abs(rightElbow)) / 2
    : 0;
  const elbowSimilarity = leftElbow !== null && rightElbow !== null && elbowMeanMagnitude > 0
    ? Math.max(0, 100 - (Math.abs(leftElbow - rightElbow) / elbowMeanMagnitude) * 100)
    : null;

  // Symmetry from a single side-on clip uses only what is measured equally well on both legs:
  //  - step time, from contacts grouped by physical leg through foot alternation (immune to label swaps);
  //  - landing position, measured at foot strike when the legs are furthest apart and both visible.
  // Knee flexion is not scored: the far knee is hidden behind the swinging near leg at its midstance.
  const legsMerged = (gait.mergedLegFramesPct ?? 0) > MAX_MERGED_LEG_FRAMES_PCT;
  const components = finiteValues([stepSi, landingSi]);
  const combinedSi = !legsMerged && components.length
    ? components.reduce((sum, value) => sum + value, 0) / components.length
    : null;
  const symmetryScore = legsMerged
    ? unavailableScore(`The pose model placed both legs on top of each other in ${gait.mergedLegFramesPct?.toFixed(0)}% of frames, so left and right cannot be compared.`)
    : combinedSi === null
    ? unavailableScore("Foot contacts on both legs are needed to compare left and right.")
    : metric(
      scoreAgainstReference(REFERENCE_RANGES.symmetryIndex, combinedSi),
      "heuristic-estimate",
      "/ 100",
      `Scored from the mean of the step-time and landing-position symmetry indices (${combinedSi.toFixed(1)}%) against the 10% research threshold.`
    );
  const cv = gait.strideTimeCvPct.value;

  return {
    symmetryScore,
    consistencyScore: cv === null
      ? unavailableScore("Stride consistency requires enough detected same-leg strides.")
      : metric(
        scoreAgainstReference(REFERENCE_RANGES.strideTimeVariation, cv),
        "heuristic-estimate",
        "/ 100",
        "Scored from stride-time variation against the app's 5% rule."
      ),
    symmetryIndexPct: metric(
      round1(combinedSi),
      "algorithmically-estimated",
      "%",
      legsMerged ? symmetryScore.explanation : "Mean of the step-time and landing-position symmetry indices."
    ),
    kneeFlexionSymmetryIndexPct: metric(legsMerged ? null : round1(kneeSi), "algorithmically-estimated", "%", legsMerged ? symmetryScore.explanation : "Symmetry index of mean left and right midstance knee flexion; the far knee is often hidden behind the near leg at midstance."),
    stepTimeSymmetryIndexPct: metric(legsMerged ? null : round1(stepSi), "algorithmically-estimated", "%", legsMerged ? symmetryScore.explanation : "Symmetry index of mean step time ending on each foot."),
    landingOffsetSymmetryIndexPct: metric(legsMerged ? null : round1(landingSi), "algorithmically-estimated", "%", legsMerged ? symmetryScore.explanation : "Symmetry index of how far ahead of the hips each foot lands."),
    shankAngleDifferenceDeg: metric(legsMerged ? null : round1(shankDifference), "algorithmically-estimated", "deg", "Absolute difference between left and right mean foot-strike shank angles."),
    kneeAngleMaxLeftDeg: metric(leftKnee.max, "landmark-derived", "deg", "Maximum internal 2D angle at the left knee; nearer 180° indicates a straighter configuration."),
    kneeAngleMaxRightDeg: metric(rightKnee.max, "landmark-derived", "deg", "Maximum internal 2D angle at the right knee; nearer 180° indicates a straighter configuration."),
    kneeAngleMinLeftDeg: metric(leftKnee.min, "landmark-derived", "deg", "Minimum internal 2D angle at the left knee (greatest bend, usually in swing)."),
    kneeAngleMinRightDeg: metric(rightKnee.min, "landmark-derived", "deg", "Minimum internal 2D angle at the right knee (greatest bend, usually in swing)."),
    elbowAngleSimilarityPct: metric(elbowSimilarity, "algorithmically-estimated", "%", "A comparison of mean left/right elbow angles; not a measure of arm swing amplitude."),
  };
}
