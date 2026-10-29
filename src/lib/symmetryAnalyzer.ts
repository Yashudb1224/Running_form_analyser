import { GaitMetrics, KinematicSequence, MetricResult, SymmetryMetrics, metric, unavailableMetric } from "../types/telemetry";
import { REFERENCE_RANGES, scoreAgainstReference } from "./researchReferences";

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
  const leftShank = gait.left.footStrikeShankAngleDeg.value;
  const rightShank = gait.right.footStrikeShankAngleDeg.value;
  const shankDifference = leftShank !== null && rightShank !== null ? Math.abs(leftShank - rightShank) : null;

  const elbowMeanMagnitude = leftElbow !== null && rightElbow !== null
    ? (Math.abs(leftElbow) + Math.abs(rightElbow)) / 2
    : 0;
  const elbowSimilarity = leftElbow !== null && rightElbow !== null && elbowMeanMagnitude > 0
    ? Math.max(0, 100 - (Math.abs(leftElbow - rightElbow) / elbowMeanMagnitude) * 100)
    : null;

  const availableIndices = finiteValues([kneeSi, stepSi]);
  const worstIndex = availableIndices.length ? Math.max(...availableIndices) : null;
  const symmetryScore = worstIndex === null
    ? unavailableScore("Stance events on both legs are needed to compare left and right.")
    : metric(
      scoreAgainstReference(REFERENCE_RANGES.symmetryIndex, worstIndex),
      "heuristic-estimate",
      "/ 100",
      `Scored from the larger of the knee-flexion and step-time symmetry indices (${worstIndex.toFixed(1)}%) against the 10% research threshold.`
    );
  const cv = gait.stepTimeCvPct.value;

  return {
    symmetryScore,
    consistencyScore: cv === null
      ? unavailableScore("Step consistency requires enough detected gait events.")
      : metric(
        scoreAgainstReference(REFERENCE_RANGES.stepTimeVariation, cv),
        "heuristic-estimate",
        "/ 100",
        "Scored from step-time variation against the app's 5% rule."
      ),
    kneeFlexionSymmetryIndexPct: metric(round1(kneeSi), "algorithmically-estimated", "%", "Symmetry index of mean left and right midstance knee flexion."),
    stepTimeSymmetryIndexPct: metric(round1(stepSi), "algorithmically-estimated", "%", "Symmetry index of mean step time ending on each foot."),
    shankAngleDifferenceDeg: metric(round1(shankDifference), "algorithmically-estimated", "deg", "Absolute difference between left and right mean foot-strike shank angles."),
    kneeAngleMaxLeftDeg: metric(leftKnee.max, "landmark-derived", "deg", "Maximum internal 2D angle at the left knee; nearer 180° indicates a straighter configuration."),
    kneeAngleMaxRightDeg: metric(rightKnee.max, "landmark-derived", "deg", "Maximum internal 2D angle at the right knee; nearer 180° indicates a straighter configuration."),
    kneeAngleMinLeftDeg: metric(leftKnee.min, "landmark-derived", "deg", "Minimum internal 2D angle at the left knee (greatest bend, usually in swing)."),
    kneeAngleMinRightDeg: metric(rightKnee.min, "landmark-derived", "deg", "Minimum internal 2D angle at the right knee (greatest bend, usually in swing)."),
    elbowAngleSimilarityPct: metric(elbowSimilarity, "algorithmically-estimated", "%", "A comparison of mean left/right elbow angles; not a measure of arm swing amplitude."),
  };
}
