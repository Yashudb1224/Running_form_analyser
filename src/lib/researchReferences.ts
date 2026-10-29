/**
 * Published reference ranges used to interpret the video measurements.
 *
 * None of these are official optimal values: running biomechanics research does not define a single
 * correct cadence, lean, or joint angle. Each range describes what is typically observed or what
 * clinical video-analysis guidance considers unremarkable, and every band carries its source and
 * how the numeric limits were chosen so the report can say exactly what a comparison means.
 */

export type ReferenceBasis =
  | "research-typical"
  | "clinical-guidance"
  | "app-rule";

export interface Citation {
  short: string;
  full: string;
}

export interface ReferenceRange {
  id: ReferenceId;
  label: string;
  unit: string;
  minimum: number;
  maximum: number;
  /** Display scale for range bars. */
  scaleMinimum: number;
  scaleMaximum: number;
  /** Score points lost per unit outside the band; scores floor at MIN_COMPONENT_SCORE. */
  penaltyPerUnit: number;
  basis: ReferenceBasis;
  summary: string;
  /** How the numeric limits relate to the cited sources. */
  bandNote: string;
  guidanceBelow: string;
  guidanceAbove: string;
  citations: Citation[];
}

export type ReferenceId =
  | "cadence"
  | "trunkLean"
  | "midstanceKneeFlexion"
  | "footStrikeShank"
  | "symmetryIndex"
  | "strideTimeVariation";

export const MIN_COMPONENT_SCORE = 40;

export const CITATIONS = {
  heiderscheit2011: {
    short: "Heiderscheit et al., 2011",
    full: "Heiderscheit BC, Chumanov ES, Michalski MP, Wille CM, Ryan MB. Effects of step rate manipulation on joint mechanics during running. Med Sci Sports Exerc. 2011;43(2):296-302.",
  },
  daniels: {
    short: "Daniels, Running Formula",
    full: "Daniels J. Daniels' Running Formula. Human Kinetics. Observation of ~180 steps/min in elite distance runners at race pace.",
  },
  lieberman2015: {
    short: "Lieberman et al., 2015",
    full: "Lieberman DE, Warrener AG, Wang J, Castillo ER. Effects of stride frequency and foot position at landing on braking force, hip torque, impact peak force and the metabolic cost of running in humans. J Exp Biol. 2015;218:3406-3414.",
  },
  tengPowers2014: {
    short: "Teng & Powers, 2014",
    full: "Teng HL, Powers CM. Sagittal plane trunk posture influences patellofemoral joint stress during running. J Orthop Sports Phys Ther. 2014;44(10):785-792.",
  },
  folland2017: {
    short: "Folland et al., 2017",
    full: "Folland JP, Allen SJ, Black MI, Handsaker JC, Forrester SE. Running technique is an important component of running economy and performance. Med Sci Sports Exerc. 2017;49(7):1412-1423.",
  },
  novacheck1998: {
    short: "Novacheck, 1998",
    full: "Novacheck TF. The biomechanics of running. Gait Posture. 1998;7(1):77-95.",
  },
  souza2016: {
    short: "Souza, 2016",
    full: "Souza RB. An evidence-based videotaped running biomechanics analysis. Phys Med Rehabil Clin N Am. 2016;27(1):217-236.",
  },
  robinson1987: {
    short: "Robinson et al., 1987",
    full: "Robinson RO, Herzog W, Nigg BM. Use of force platform variables to quantify the effects of chiropractic manipulation on gait symmetry. J Manipulative Physiol Ther. 1987;10(4):172-176.",
  },
  moore2016: {
    short: "Moore, 2016",
    full: "Moore IS. Is there an economical running technique? A review of modifiable biomechanical factors affecting running economy. Sports Med. 2016;46(6):793-807.",
  },
} satisfies Record<string, Citation>;

export const REFERENCE_RANGES: Record<ReferenceId, ReferenceRange> = {
  cadence: {
    id: "cadence",
    label: "Cadence",
    unit: "steps/min",
    minimum: 160,
    maximum: 185,
    scaleMinimum: 130,
    scaleMaximum: 210,
    penaltyPerUnit: 2,
    basis: "research-typical",
    summary: "Cadence rises with running speed and varies with leg length, so there is no universal optimum. 180 steps/min is an observation of elite runners at race pace, not a rule.",
    bandNote: "160-185 steps/min spans cadences commonly reported for trained runners at moderate to fast paces. The research evidence is relative: raising your own cadence 5-10% reduces loading at the hip and knee.",
    guidanceBelow: "Lower than typical. If you overstride or have knee or hip pain, research supports trying a 5-10% higher cadence at the same pace.",
    guidanceAbove: "Higher than typical. This is common at fast paces or for shorter runners and is not a concern on its own.",
    citations: [CITATIONS.heiderscheit2011, CITATIONS.lieberman2015, CITATIONS.daniels],
  },
  trunkLean: {
    id: "trunkLean",
    label: "Forward trunk lean",
    unit: "deg",
    minimum: 3,
    maximum: 12,
    scaleMinimum: -10,
    scaleMaximum: 25,
    penaltyPerUnit: 4,
    basis: "research-typical",
    summary: "Runners normally lean slightly forward from the hips. More lean shifts load from the knee towards the hip; leaning backwards is uncommon.",
    bandNote: "3-12 deg brackets the self-selected forward trunk angles reported in running studies. Increasing lean reduces patellofemoral (knee) stress but increases hip extensor demand.",
    guidanceBelow: "More upright than typical, or leaning back. A slight lean from the hips (not the waist) is usual.",
    guidanceAbove: "More forward lean than typical. This raises hip and lower-back demand; check that the lean comes from the ankles and hips rather than bending at the waist.",
    citations: [CITATIONS.tengPowers2014, CITATIONS.folland2017, CITATIONS.souza2016],
  },
  midstanceKneeFlexion: {
    id: "midstanceKneeFlexion",
    label: "Knee flexion at midstance",
    unit: "deg",
    minimum: 35,
    maximum: 50,
    scaleMinimum: 15,
    scaleMaximum: 70,
    penaltyPerUnit: 3,
    basis: "research-typical",
    summary: "The stance knee bends to absorb landing forces. Laboratory gait studies report peak stance knee flexion of roughly 40-45 deg in running.",
    bandNote: "35-50 deg brackets the typical laboratory values, allowing for the extra error of 2D video estimates.",
    guidanceBelow: "Stiffer than typical. Limited knee bend can mean higher impact loading through the leg.",
    guidanceAbove: "More knee bend than typical. This usually indicates a more crouched running style with higher quadriceps demand.",
    citations: [CITATIONS.novacheck1998, CITATIONS.souza2016],
  },
  footStrikeShank: {
    id: "footStrikeShank",
    label: "Shank angle at foot strike",
    unit: "deg",
    minimum: 0,
    maximum: 8,
    scaleMinimum: -10,
    scaleMaximum: 25,
    penaltyPerUnit: 5,
    basis: "clinical-guidance",
    summary: "Clinical video analysis looks for a near-vertical shin when the foot lands. A shin angled well forward means the foot lands ahead of the knee (overstriding), which increases braking forces.",
    bandNote: "The sources describe a near-vertical shank qualitatively. The 0-8 deg band is this app's numeric reading of that guidance, not a published cutoff.",
    guidanceBelow: "The ankle lands behind the knee. This is uncommon and is often a tracking or foot-strike timing artefact.",
    guidanceAbove: "The foot lands ahead of the knee (overstriding). A slightly higher cadence or landing closer under the hips usually reduces this.",
    citations: [CITATIONS.souza2016, CITATIONS.lieberman2015],
  },
  symmetryIndex: {
    id: "symmetryIndex",
    label: "Left/right symmetry index",
    unit: "%",
    minimum: 0,
    maximum: 10,
    scaleMinimum: 0,
    scaleMaximum: 30,
    penaltyPerUnit: 3,
    basis: "research-typical",
    summary: "The symmetry index is the left/right difference divided by the mean of the two sides, here averaged over step time and landing position. Healthy runners are rarely perfectly symmetric.",
    bandNote: "A symmetry index below 10% is a threshold widely used in gait research to describe practically symmetric movement. It is not a clinical injury cutoff.",
    guidanceBelow: "",
    guidanceAbove: "One side differs by more than 10%. If this persists across videos, or you have pain on one side, consider an in-person assessment.",
    citations: [CITATIONS.robinson1987],
  },
  strideTimeVariation: {
    id: "strideTimeVariation",
    label: "Stride-time variation",
    unit: "%",
    minimum: 0,
    maximum: 5,
    scaleMinimum: 0,
    scaleMaximum: 20,
    penaltyPerUnit: 4,
    basis: "app-rule",
    summary: "Steady-state running is highly regular. Higher variation can come from changes of pace, uneven terrain, fatigue, or tracking noise.",
    bandNote: "There is no published consensus threshold. The 5% band is an app rule that allows for video timing resolution (one frame is about 33 ms at 30 frames/s).",
    guidanceBelow: "",
    guidanceAbove: "Stride timing varies more than expected for steady running. Check that the clip shows constant-pace running on even ground.",
    citations: [CITATIONS.moore2016],
  },
};

export type ReferencePosition = "below" | "within" | "above";

export function getReferencePosition(reference: ReferenceRange, value: number): ReferencePosition {
  if (value < reference.minimum) return "below";
  if (value > reference.maximum) return "above";
  return "within";
}

export function scoreAgainstReference(reference: ReferenceRange, value: number): number {
  const distance = value < reference.minimum
    ? reference.minimum - value
    : value > reference.maximum
      ? value - reference.maximum
      : 0;
  return Math.round(Math.max(MIN_COMPONENT_SCORE, 100 - distance * reference.penaltyPerUnit));
}

export function getReferenceGuidance(reference: ReferenceRange, value: number): string {
  const position = getReferencePosition(reference, value);
  if (position === "within") return "Within the reference range.";
  return position === "below" ? reference.guidanceBelow : reference.guidanceAbove;
}

export const BASIS_LABELS: Record<ReferenceBasis, string> = {
  "research-typical": "Research-typical range",
  "clinical-guidance": "Clinical video-analysis guidance",
  "app-rule": "App rule (no published threshold)",
};
