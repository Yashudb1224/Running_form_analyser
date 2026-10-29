import { FormScoreData, GaitMetrics, KinematicSequence, MetricResult, SymmetryMetrics, metric, unavailableMetric } from "../types/telemetry";

export const POSTURE_DEMO_REFERENCE = { minimumDeg: 3, maximumDeg: 10 } as const;

export function getCadenceDemoScoreBand(cadence: number) {
  if (cadence < 155) return { label: "<155 steps/min", score: 70, minimum: 120, maximum: 155 };
  if (cadence < 165) return { label: "155-<165 steps/min", score: 85, minimum: 155, maximum: 165 };
  if (cadence <= 185) return { label: "165-185 steps/min", score: 100, minimum: 165, maximum: 185 };
  return { label: ">185 steps/min", score: 92, minimum: 185, maximum: 210 };
}

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
      getCadenceDemoScoreBand(cadence).score,
      "heuristic-estimate",
      "%",
      "Demonstration rule using the existing cadence bands; not an individualized or validated target."
    );
  const postureScore = meanImageLean === null
    ? unavailable("A valid shoulder and hip midpoint was not available.")
    : metric(
      meanImageLean >= POSTURE_DEMO_REFERENCE.minimumDeg && meanImageLean <= POSTURE_DEMO_REFERENCE.maximumDeg
        ? 100
        : meanImageLean < POSTURE_DEMO_REFERENCE.minimumDeg
          ? 80
          : meanImageLean <= 15
            ? 82
            : 70,
      "heuristic-estimate",
      "%",
      `Demonstration scoring band: ${POSTURE_DEMO_REFERENCE.minimumDeg}-${POSTURE_DEMO_REFERENCE.maximumDeg} degrees mean absolute image-plane angle; not a validated posture target.`
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
      ? "Cadence: unavailable."
      : `Estimated cadence: ${cadence.toFixed(1)} steps/min.`,
    meanImageLean === null
      ? "Mean trunk image angle: unavailable."
      : `Mean trunk image angle: ${meanImageLean.toFixed(1)} deg.`,
    `Knee-angle asymmetry: ${symmetry.kneeAngleAsymmetryPct.value === null ? "unavailable" : `${symmetry.kneeAngleAsymmetryPct.value.toFixed(1)}%`}.`,
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
