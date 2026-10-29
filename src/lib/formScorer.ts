import { FormScoreData, GaitMetrics, KinematicSequence, MetricResult, SymmetryMetrics, metric, unavailableMetric } from "../types/telemetry";
import { REFERENCE_RANGES, ReferenceRange, getReferenceGuidance, scoreAgainstReference } from "./researchReferences";

const COMPONENT_WEIGHTS = {
  cadence: 0.2,
  footStrike: 0.2,
  kneeFlexion: 0.15,
  posture: 0.15,
  symmetry: 0.2,
  consistency: 0.1,
} as const;
const MIN_COMPONENTS_FOR_COMPOSITE = 4;

type ComponentKey = keyof typeof COMPONENT_WEIGHTS;

export function meanForwardTrunkLean(kinematics: KinematicSequence): number | null {
  const valid = kinematics.trunkForwardLeanAngles.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10 : null;
}

function referenceScore(reference: ReferenceRange, value: number | null, unavailableReason: string): MetricResult {
  if (value === null) return unavailableMetric("/ 100", unavailableReason);
  return metric(
    scoreAgainstReference(reference, value),
    "heuristic-estimate",
    "/ 100",
    `100 inside ${reference.minimum}-${reference.maximum} ${reference.unit}; ${reference.penaltyPerUnit} points lost per ${reference.unit} outside.`
  );
}

export function calculateFormScore(
  kinematics: KinematicSequence,
  gait: GaitMetrics,
  symmetry: SymmetryMetrics,
  analysisSufficient: boolean
): FormScoreData {
  const cadence = gait.cadenceSpm.value;
  const lean = meanForwardTrunkLean(kinematics);
  const shank = gait.footStrikeShankAngleDeg.value;
  const knee = gait.midstanceKneeFlexionDeg.value;

  const subScores: Record<ComponentKey, MetricResult> = {
    cadence: referenceScore(REFERENCE_RANGES.cadence, cadence, "Cadence is unavailable because gait events were insufficient."),
    footStrike: referenceScore(REFERENCE_RANGES.footStrikeShank, shank, gait.footStrikeShankAngleDeg.explanation),
    kneeFlexion: referenceScore(REFERENCE_RANGES.midstanceKneeFlexion, knee, "No stance phases with a visible knee were detected."),
    posture: referenceScore(
      REFERENCE_RANGES.trunkLean,
      lean,
      kinematics.facingDirection === null
        ? "Running direction is unknown, so forward lean cannot be signed."
        : "A valid shoulder and hip midpoint was not available."
    ),
    symmetry: symmetry.symmetryScore,
    consistency: symmetry.consistencyScore,
  };

  const available = (Object.keys(COMPONENT_WEIGHTS) as ComponentKey[])
    .filter((key) => subScores[key].value !== null);
  const totalWeight = available.reduce((sum, key) => sum + COMPONENT_WEIGHTS[key], 0);
  const canScore = analysisSufficient && available.length >= MIN_COMPONENTS_FOR_COMPOSITE && totalWeight > 0;
  const overall = canScore
    ? metric(
      Math.round(available.reduce((sum, key) => sum + COMPONENT_WEIGHTS[key] * (subScores[key].value ?? 0), 0) / totalWeight),
      "heuristic-estimate",
      "/ 100",
      `Weighted mean of ${available.length} component scores, each measured against a published reference range. Weights are renormalized over the available components.`
    )
    : unavailableMetric("/ 100", analysisSufficient
      ? `The composite needs at least ${MIN_COMPONENTS_FOR_COMPOSITE} scored components; ${available.length} were available.`
      : "The composite is withheld because the video did not meet the tracking-quality and camera-view requirements.");

  const category = overall.value === null
    ? "Insufficient data for an overall score"
    : overall.value >= 90
      ? "Close to research-typical ranges"
      : overall.value >= 75
        ? "Mostly within typical ranges"
        : overall.value >= 60
          ? "Several measures outside typical ranges"
          : "Most measures outside typical ranges";

  const observations: string[] = [];
  const addObservation = (reference: ReferenceRange, value: number | null) => {
    if (value === null) return;
    const guidance = getReferenceGuidance(reference, value);
    if (guidance && guidance !== "Within the reference range.") {
      observations.push(`${reference.label} ${value.toFixed(1)} ${reference.unit}: ${guidance}`);
    }
  };
  addObservation(REFERENCE_RANGES.footStrikeShank, shank);
  addObservation(REFERENCE_RANGES.cadence, cadence);
  addObservation(REFERENCE_RANGES.midstanceKneeFlexion, knee);
  addObservation(REFERENCE_RANGES.trunkLean, lean);
  const symmetryValues = [symmetry.kneeFlexionSymmetryIndexPct.value, symmetry.stepTimeSymmetryIndexPct.value]
    .filter((value): value is number => value !== null);
  if (symmetryValues.length) addObservation(REFERENCE_RANGES.symmetryIndex, Math.max(...symmetryValues));
  addObservation(REFERENCE_RANGES.stepTimeVariation, gait.stepTimeCvPct.value);
  if (!observations.length && overall.value !== null) {
    observations.push("All scored measures are within their reference ranges.");
  }

  return { overallScore: overall, category, observations, subScores };
}
