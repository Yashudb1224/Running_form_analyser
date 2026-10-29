import { FormScoreData, GaitMetrics, KinematicSequence, MetricResult, SymmetryMetrics, metric, unavailableMetric } from "../types/telemetry";

function average(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function averageAbsolute(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + Math.abs(value), 0) / valid.length : null;
}

function unavailable(reason: string): MetricResult {
  return unavailableMetric("%", reason);
}

export function calculateFormScore(
  kinematics: KinematicSequence,
  gait: GaitMetrics,
  symmetry: SymmetryMetrics,
  analysisSufficient: boolean
): FormScoreData {
  const cadence = gait.cadenceSpm.value;
  const meanImageLean = averageAbsolute(kinematics.trunkImagePlaneAngles);
  const cadenceScore = cadence === null
    ? unavailable("Cadence is unavailable because gait events were insufficient.")
    : metric(
      cadence >= 165 && cadence <= 185 ? 100 : cadence >= 155 && cadence < 165 ? 85 : cadence < 155 ? 70 : 92,
      "heuristic-estimate",
      "%",
      "Demonstration rule using the existing cadence bands; not an individualized or validated target."
    );
  const postureScore = meanImageLean === null
    ? unavailable("A valid shoulder and hip midpoint was not available.")
    : metric(
      meanImageLean >= 3 && meanImageLean <= 10
        ? 100
        : meanImageLean < 3
          ? 80
          : meanImageLean <= 15
            ? 82
            : 70,
      "heuristic-estimate",
      "%",
      "Demonstration rule using the existing 3–10 degree posture band on mean absolute image-plane angle; camera orientation is not calibrated."
    );
  const efficiency = unavailable("A calibrated efficiency score cannot be derived from this 2D video analysis.");
  const requiredScores = [
    symmetry.kneeAngleSymmetryScore.value,
    symmetry.strideConsistencyScore.value,
    cadenceScore.value,
    postureScore.value,
  ];
  const [symmetryValue, consistencyValue, cadenceValue, postureValue] = requiredScores;
  const overall = analysisSufficient && requiredScores.every((value) => value !== null)
    ? metric(
      Math.round(
        (0.25 * (symmetryValue ?? 0) +
          0.25 * (consistencyValue ?? 0) +
          0.2 * (cadenceValue ?? 0) +
          0.15 * (postureValue ?? 0)) / 0.85
      ),
      "heuristic-estimate",
      "/ 100",
      "Experimental weighted rule-based index using available legacy components; uncalibrated efficiency is excluded and weights are renormalized. Not validated."
    )
    : unavailable(analysisSufficient
      ? "The composite is withheld because one or more required inputs are unavailable."
      : "The composite is withheld because the video did not meet the minimum tracking-quality gate.");

  const category = overall.value === null
    ? "Insufficient valid data for a composite"
    : overall.value < 75
      ? "Review the measured components"
      : overall.value < 88
        ? "Mixed results across measured components"
        : "High rule-based demonstration score";

  const observations = [
    cadence === null
      ? "Cadence is unavailable: too few valid ankle trajectory events were detected."
      : `Estimated cadence: ${cadence.toFixed(1)} steps/min, derived from tracked ankle trajectory events.`,
    meanImageLean === null
      ? "Trunk image-plane angle is unavailable because required shoulder or hip landmarks were missing."
      : `Mean absolute trunk angle in the image plane: ${meanImageLean.toFixed(1)}°. Camera orientation is not calibrated.`,
    `Knee-angle asymmetry index: ${symmetry.kneeAngleAsymmetryPct.value === null ? "unavailable" : `${symmetry.kneeAngleAsymmetryPct.value.toFixed(1)}%`}. This compares paired 2D landmark-derived knee angles.`,
    "Ground-contact time and flight time are not measured and are excluded from scoring.",
    "All rule-based scores are for demonstration only; they are not clinical, injury-risk, or performance diagnoses.",
  ];

  return {
    overallScore: overall,
    category,
    observations,
    subScores: {
      symmetry: symmetry.kneeAngleSymmetryScore,
      consistency: symmetry.strideConsistencyScore,
      cadence: cadenceScore,
      posture: postureScore,
      efficiency,
    },
  };
}
