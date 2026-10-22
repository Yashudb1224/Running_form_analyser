import { GaitMetrics, KinematicSequence, SymmetryMetrics } from "@/types/telemetry";

export function evaluateSymmetryAndConsistency(
  kinematics: KinematicSequence,
  gait: GaitMetrics
): SymmetryMetrics {
  const leftKnee = kinematics.leftKneeAngles;
  const rightKnee = kinematics.rightKneeAngles;
  const leftElbow = kinematics.leftElbowAngles || [];
  const rightElbow = kinematics.rightElbowAngles || [];

  const maxLeft = leftKnee.length > 0 ? Math.max(...leftKnee) : 155.0;
  const maxRight = rightKnee.length > 0 ? Math.max(...rightKnee) : 154.0;
  const minLeft = leftKnee.length > 0 ? Math.min(...leftKnee) : 25.0;
  const minRight = rightKnee.length > 0 ? Math.min(...rightKnee) : 24.0;

  // Symmetry Index calculation: SI = |L - R| / (0.5 * (L + R)) * 100%
  const meanMin = (minLeft + minRight) / 2.0;
  const kneeMinSiPct = meanMin > 0 ? (Math.abs(minLeft - minRight) / meanMin) * 100.0 : 0.0;

  // Arm swing symmetry calculation
  let armSwingSymmetryPct = 94.0;
  if (leftElbow.length > 0 && rightElbow.length > 0) {
    const meanLeftElbow = leftElbow.reduce((a, b) => a + b, 0) / leftElbow.length;
    const meanRightElbow = rightElbow.reduce((a, b) => a + b, 0) / rightElbow.length;
    const diff = Math.abs(meanLeftElbow - meanRightElbow);
    armSwingSymmetryPct = Math.max(70.0, Math.min(100.0, Math.round(100.0 - diff * 1.2)));
  }

  // Overall Symmetry Score (0-100%)
  const overallSymmetryScore = Math.max(
    0.0,
    Math.min(100.0, Math.round(100.0 - kneeMinSiPct * 1.2 - (100 - armSwingSymmetryPct) * 0.3))
  );

  // Stride Consistency Score (0-100%) based on Step Time CV%
  const strideConsistencyScore = Math.max(0.0, Math.min(100.0, Math.round(100.0 - gait.stepTimeCvPct * 4.0)));

  return {
    overallSymmetryScore,
    strideConsistencyScore,
    kneeFlexionMaxLeft: Math.round(maxLeft * 10) / 10,
    kneeFlexionMaxRight: Math.round(maxRight * 10) / 10,
    kneeFlexionMinLeft: Math.round(minLeft * 10) / 10,
    kneeFlexionMinRight: Math.round(minRight * 10) / 10,
    kneeMinSiPct: Math.round(kneeMinSiPct * 10) / 10,
    armSwingSymmetryPct
  };
}

