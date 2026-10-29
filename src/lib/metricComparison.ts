import { CompleteAnalysisReport, MetricResult, metric } from "../types/telemetry";
import { getCadenceDemoScoreBand, POSTURE_DEMO_REFERENCE } from "./formScorer";

export interface MetricComparison {
  label: string;
  observed: MetricResult;
  reference: string;
  position: string;
  scale?: {
    minimum: number;
    maximum: number;
    bandMinimum?: number;
    bandMaximum?: number;
    observed: number;
  };
}

function averageAbsolute(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + Math.abs(value), 0) / valid.length : null;
}

function scoreText(score: MetricResult): string {
  return score.value === null ? "Unavailable" : `${score.value}/100`;
}

export function getMetricComparisons(report: CompleteAnalysisReport): MetricComparison[] {
  const { gait, symmetry, formScore } = report;
  const meanTrunk = averageAbsolute(report.kinematics.trunkImagePlaneAngles);
  const trunkMetric = metric(
    meanTrunk,
    meanTrunk === null ? "unavailable" : "landmark-derived",
    "deg",
    "Mean absolute trunk image-plane angle; camera orientation is not calibrated."
  );
  const cadence = gait.cadenceSpm;
  const cadenceRule = cadence.value === null ? null : getCadenceDemoScoreBand(cadence.value);
  const posturePosition = meanTrunk === null
    ? "Unavailable"
    : meanTrunk < POSTURE_DEMO_REFERENCE.minimumDeg
      ? "Below app score band"
      : meanTrunk <= POSTURE_DEMO_REFERENCE.maximumDeg
        ? "Within app score band"
        : "Above app score band";

  return [
    {
      label: "Cadence",
      observed: cadence,
      reference: cadenceRule?.label ?? "App band unavailable",
      position: cadence.value === null
        ? "Unavailable"
        : `App rule score: ${scoreText(formScore.subScores.cadence)}`,
      ...(cadenceRule && cadence.value !== null
        ? {
            scale: {
              minimum: 120,
              maximum: 210,
              bandMinimum: cadenceRule.minimum,
              bandMaximum: cadenceRule.maximum,
              observed: cadence.value,
            },
          }
        : {}),
    },
    {
      label: "Knee-angle asymmetry",
      observed: symmetry.kneeAngleAsymmetryPct,
      reference: "App symmetry rule",
      position: `Rule score: ${scoreText(formScore.subScores.symmetry)}`,
      ...(formScore.subScores.symmetry.value === null
        ? {}
        : { scale: { minimum: 0, maximum: 100, observed: formScore.subScores.symmetry.value } }),
    },
    {
      label: "Pelvis vertical range",
      observed: gait.pelvisVerticalRangeBodyHeightPct,
      reference: "No app reference band",
      position: "Observed only",
    },
    {
      label: "Hip-line image tilt",
      observed: gait.maxHipLineImageTiltDeg,
      reference: "No app reference band",
      position: "Observed only",
    },
    {
      label: "Ankle-hip image offset",
      observed: gait.ankleHipOffsetBodyHeightPct,
      reference: "No app reference band",
      position: "Observed only",
    },
    {
      label: "Mean trunk image angle",
      observed: trunkMetric,
      reference: `${POSTURE_DEMO_REFERENCE.minimumDeg}-${POSTURE_DEMO_REFERENCE.maximumDeg} deg`,
      position: posturePosition,
      ...(meanTrunk === null
        ? {}
        : {
            scale: {
              minimum: 0,
              maximum: 20,
              bandMinimum: POSTURE_DEMO_REFERENCE.minimumDeg,
              bandMaximum: POSTURE_DEMO_REFERENCE.maximumDeg,
              observed: meanTrunk,
            },
          }),
    },
    {
      label: "Step-time variation",
      observed: gait.stepTimeCvPct,
      reference: "App consistency rule",
      position: `Rule score: ${scoreText(formScore.subScores.consistency)}`,
      ...(formScore.subScores.consistency.value === null
        ? {}
        : { scale: { minimum: 0, maximum: 100, observed: formScore.subScores.consistency.value } }),
    },
    {
      label: "Step-time consistency",
      observed: symmetry.strideConsistencyScore,
      reference: "App score scale (0-100)",
      position: `Rule score: ${scoreText(symmetry.strideConsistencyScore)}`,
      ...(symmetry.strideConsistencyScore.value === null
        ? {}
        : { scale: { minimum: 0, maximum: 100, observed: symmetry.strideConsistencyScore.value } }),
    },
  ];
}
