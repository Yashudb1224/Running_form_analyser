import { CompleteAnalysisReport } from "../types/telemetry";
import type { AnalysisRecord } from "./analysisRecord";
import { meanForwardTrunkLean } from "./formScorer";
import { REFERENCE_RANGES, ReferenceRange } from "./researchReferences";
import type { ExerciseAnimationId } from "./exerciseAnimations";

/** The measurements the trainer works from, from the open report or a saved analysis. */
export interface TrainerMetrics {
  cadence: number | null;
  shin: number | null;
  knee: number | null;
  lean: number | null;
  strideCv: number | null;
  symmetry: number | null;
}

export type WeaknessId =
  | "overstride"
  | "lowCadence"
  | "stiffKnee"
  | "crouchedKnee"
  | "uprightTrunk"
  | "excessiveLean"
  | "irregularRhythm"
  | "asymmetry";

export interface Weakness {
  id: WeaknessId;
  title: string;
  detail: string;
  /** How far outside the range, in units of the range width (larger is more urgent). */
  severity: number;
}

export interface Exercise {
  id: string;
  name: string;
  targets: WeaknessId[];
  dose: string;
  why: string;
  cues: string[];
  animation: ExerciseAnimationId;
}

export function metricsFromReport(report: CompleteAnalysisReport): TrainerMetrics {
  return {
    cadence: report.gait.cadenceSpm.value,
    shin: report.gait.footStrikeShankAngleDeg.value,
    knee: report.gait.midstanceKneeFlexionDeg.value,
    lean: meanForwardTrunkLean(report.kinematics),
    strideCv: report.gait.strideTimeCvPct.value,
    symmetry: report.symmetry.symmetryIndexPct.value,
  };
}

export function metricsFromRecord(record: AnalysisRecord): TrainerMetrics {
  const number = (value: number | null) => (value === null || value === undefined ? null : Number(value));
  return {
    cadence: number(record.cadence_spm),
    shin: number(record.shank_angle_deg),
    knee: number(record.knee_flexion_deg),
    lean: number(record.trunk_lean_deg),
    strideCv: number(record.stride_cv_pct),
    symmetry: number(record.symmetry_index_pct),
  };
}

function outside(reference: ReferenceRange, value: number | null): { side: "below" | "above"; severity: number } | null {
  if (value === null || !Number.isFinite(value)) return null;
  const width = reference.maximum - reference.minimum || 1;
  if (value < reference.minimum && !reference.lowerIsBetter) return { side: "below", severity: (reference.minimum - value) / width };
  if (value > reference.maximum) return { side: "above", severity: (value - reference.maximum) / width };
  return null;
}

/** Measures outside their research ranges, most urgent first. */
export function detectWeaknesses(metrics: TrainerMetrics): Weakness[] {
  const found: Weakness[] = [];
  const add = (id: WeaknessId, title: string, detail: string, severity: number) => found.push({ id, title, detail, severity });
  const r = REFERENCE_RANGES;

  const shin = outside(r.footStrikeShank, metrics.shin);
  if (shin?.side === "above") add("overstride", "Overstriding", `Your shin is ${metrics.shin?.toFixed(1)}° ahead of vertical at foot strike (typical ${r.footStrikeShank.minimum}–${r.footStrikeShank.maximum}°).`, shin.severity);
  const cadence = outside(r.cadence, metrics.cadence);
  if (cadence?.side === "below") add("lowCadence", "Low cadence", `${metrics.cadence?.toFixed(0)} steps/min is below the typical ${r.cadence.minimum}–${r.cadence.maximum}.`, cadence.severity);
  const knee = outside(r.midstanceKneeFlexion, metrics.knee);
  if (knee?.side === "below") add("stiffKnee", "Stiff landing", `Knee bend of ${metrics.knee?.toFixed(1)}° at midstance is less than the typical ${r.midstanceKneeFlexion.minimum}–${r.midstanceKneeFlexion.maximum}°.`, knee.severity);
  if (knee?.side === "above") add("crouchedKnee", "Sitting low", `Knee bend of ${metrics.knee?.toFixed(1)}° at midstance is more than the typical ${r.midstanceKneeFlexion.minimum}–${r.midstanceKneeFlexion.maximum}°.`, knee.severity);
  const lean = outside(r.trunkLean, metrics.lean);
  if (lean?.side === "below") add("uprightTrunk", "Too upright", `Trunk lean of ${metrics.lean?.toFixed(1)}° is below the typical ${r.trunkLean.minimum}–${r.trunkLean.maximum}°.`, lean.severity);
  if (lean?.side === "above") add("excessiveLean", "Leaning too far", `Trunk lean of ${metrics.lean?.toFixed(1)}° is above the typical ${r.trunkLean.minimum}–${r.trunkLean.maximum}°.`, lean.severity);
  const rhythm = outside(r.strideTimeVariation, metrics.strideCv);
  if (rhythm) add("irregularRhythm", "Uneven rhythm", `Stride timing varies by ${metrics.strideCv?.toFixed(1)}% (typical under ${r.strideTimeVariation.maximum}%).`, rhythm.severity);
  const symmetry = outside(r.symmetryIndex, metrics.symmetry);
  if (symmetry) add("asymmetry", "Left/right imbalance", `Your legs differ by ${metrics.symmetry?.toFixed(1)}% (typical under ${r.symmetryIndex.maximum}%).`, symmetry.severity * 0.5);

  return found.sort((a, b) => b.severity - a.severity);
}

export const EXERCISES: Exercise[] = [
  {
    id: "a-skips", name: "A-skips", targets: ["overstride", "lowCadence"], dose: "3 × 20 m", animation: "aSkip",
    why: "Trains you to drive the knee up and strike down under your hips instead of reaching forward.",
    cues: ["Tall posture, eyes ahead", "Knee to hip height", "Snap the foot down under your body"],
  },
  {
    id: "high-knees", name: "High knees", targets: ["overstride", "lowCadence"], dose: "3 × 20 s", animation: "highKnees",
    why: "Builds quick, light foot turnover and a landing close to your centre of mass.",
    cues: ["Stay on the balls of your feet", "Quick, quiet contacts", "Pump the arms"],
  },
  {
    id: "quick-feet", name: "Quick-feet bounces", targets: ["lowCadence", "irregularRhythm"], dose: "4 × 20 s", animation: "quickFeet",
    why: "Grooves a fast, even rhythm, like skipping rope without the rope.",
    cues: ["Small, springy hops", "Keep the rhythm steady", "Relax the shoulders"],
  },
  {
    id: "wall-drill", name: "Wall lean march", targets: ["uprightTrunk", "overstride"], dose: "3 × 10 per leg", animation: "wallDrill",
    why: "Teaches a forward lean from the ankles with the foot landing beneath the hips.",
    cues: ["Lean from the ankles, body straight", "Drive one knee up at a time", "Land under the hips"],
  },
  {
    id: "squats", name: "Bodyweight squats", targets: ["stiffKnee"], dose: "3 × 12", animation: "squat",
    why: "Strengthens the quads and glutes so your knee can bend and absorb landing forces.",
    cues: ["Hips back and down", "Knees track over toes", "Chest up"],
  },
  {
    id: "calf-raises", name: "Calf raises", targets: ["stiffKnee", "overstride"], dose: "3 × 15", animation: "calfRaise",
    why: "Strong calves help you land softly under your body and push off efficiently.",
    cues: ["Rise slowly onto the toes", "Pause at the top", "Lower under control"],
  },
  {
    id: "glute-bridge", name: "Glute bridges", targets: ["crouchedKnee", "excessiveLean"], dose: "3 × 12", animation: "gluteBridge",
    why: "Stronger glutes keep your hips tall so you don't sit low or fold forward.",
    cues: ["Feet flat, hip-width apart", "Squeeze the glutes to lift", "Ribs down, no arching"],
  },
  {
    id: "plank", name: "Forearm plank", targets: ["excessiveLean", "irregularRhythm"], dose: "3 × 30 s", animation: "plank",
    why: "A stable core holds your trunk steady instead of collapsing forward as you tire.",
    cues: ["Straight line head to heels", "Brace the stomach", "Breathe steadily"],
  },
  {
    id: "reverse-lunge", name: "Reverse lunges", targets: ["asymmetry", "stiffKnee"], dose: "3 × 8 per leg", animation: "reverseLunge",
    why: "Trains each leg on its own, evening out strength between sides.",
    cues: ["Step back, drop the back knee", "Front shin stays vertical", "Push up through the front heel"],
  },
  {
    id: "single-leg-balance", name: "Single-leg balance", targets: ["asymmetry", "irregularRhythm"], dose: "3 × 30 s per leg", animation: "singleLegBalance",
    why: "Improves the balance and control each leg needs during stance.",
    cues: ["Lift the knee to hip height", "Hips level", "Hold still, then switch"],
  },
  {
    id: "single-leg-squat", name: "Single-leg squat (partial)", targets: ["asymmetry", "crouchedKnee", "stiffKnee"], dose: "3 × 6 per leg", animation: "singleLegSquat",
    why: "Builds the single-leg strength that controls how far the knee bends on landing.",
    cues: ["Small range to start", "Knee over the middle toes", "Keep the hips level"],
  },
  {
    id: "butt-kicks", name: "Butt kicks", targets: ["lowCadence", "overstride"], dose: "3 × 20 m", animation: "buttKicks",
    why: "Encourages a quick heel recovery so the leg swings through faster and lands under you.",
    cues: ["Heels up towards the glutes", "Short, quick steps", "Stay tall"],
  },
];

/** The general routine shown when no weaknesses are found. */
const MAINTENANCE = ["a-skips", "squats", "glute-bridge", "plank", "calf-raises", "single-leg-balance"];

/**
 * Exercises for the given weaknesses: those matching the most urgent weaknesses first, then the
 * rest of the matches, without repeats. With no weaknesses, a balanced maintenance routine.
 */
export function recommendExercises(weaknesses: Weakness[], limit = 6): { exercise: Exercise; reasons: WeaknessId[] }[] {
  if (!weaknesses.length) {
    return MAINTENANCE.map((id) => ({ exercise: EXERCISES.find((exercise) => exercise.id === id) as Exercise, reasons: [] })).slice(0, limit);
  }
  const ranked = new Map<string, { exercise: Exercise; reasons: WeaknessId[]; score: number }>();
  weaknesses.forEach((weakness, rank) => {
    EXERCISES.filter((exercise) => exercise.targets.includes(weakness.id)).forEach((exercise) => {
      const existing = ranked.get(exercise.id);
      // Earlier (more urgent) weaknesses and an exercise's primary target count for more.
      const score = (weaknesses.length - rank) * 10 + (exercise.targets[0] === weakness.id ? 3 : 0);
      if (existing) {
        existing.reasons.push(weakness.id);
        existing.score += score;
      } else {
        ranked.set(exercise.id, { exercise, reasons: [weakness.id], score });
      }
    });
  });
  return [...ranked.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ exercise, reasons }) => ({ exercise, reasons }));
}
