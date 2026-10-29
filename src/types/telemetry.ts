export type MetricStatus =
  | "landmark-derived"
  | "algorithmically-estimated"
  | "heuristic-estimate"
  | "unavailable";

export interface MetricResult {
  value: number | null;
  status: MetricStatus;
  unit: string;
  explanation: string;
}

export interface Landmark {
  x: number;
  y: number;
  z: number | null;
  visibility: number | null;
}

export interface FramePose {
  frameIndex: number;
  timestamp: number;
  landmarks: (Landmark | null)[];
  tracked: boolean;
  meanVisibility: number | null;
}

/** +1 when the runner faces the +x image direction (to the right), -1 when facing left. */
export type FacingDirection = 1 | -1;

export interface KinematicSequence {
  leftKneeAngles: (number | null)[];
  rightKneeAngles: (number | null)[];
  leftHipAngles: (number | null)[];
  rightHipAngles: (number | null)[];
  leftElbowAngles: (number | null)[];
  rightElbowAngles: (number | null)[];
  trunkImagePlaneAngles: (number | null)[];
  /** Trunk angle from vertical, positive when leaning in the running direction. */
  trunkForwardLeanAngles: (number | null)[];
  hipLineImageTiltAngles: (number | null)[];
  leftAnkleY: (number | null)[];
  rightAnkleY: (number | null)[];
  pelvisCenterY: (number | null)[];
  torsoHeightPx: (number | null)[];
  facingDirection: FacingDirection | null;
}

export interface FootStrikeEvent {
  /** Landmark side the measurements were taken from (the foot on the ground in this frame). */
  leg: "left" | "right";
  /**
   * Physical leg, kept consistent through the clip from the alternation of foot contacts, so pose-model
   * left/right label swaps do not mix the two legs. Use this for any left/right grouping.
   */
  side: "left" | "right";
  /** Frame index of the stance peak (lowest ankle position in the image). */
  stanceFrame: number;
  /** Sub-frame interpolated stance-peak time in seconds. */
  stanceTime: number;
  /** Approximate initial-contact frame: first stance-window frame before the peak. */
  strikeFrame: number;
  /** Frame of greatest knee flexion within the stance window. */
  midstanceFrame: number;
  shankAngleDeg: number | null;
  ankleAheadOfHipPct: number | null;
  midstanceKneeFlexionDeg: number | null;
}

export type EvidenceKind = "foot-strike" | "midstance" | "trunk-lean";

export interface EvidenceFrame {
  id: string;
  kind: EvidenceKind;
  leg: "left" | "right" | null;
  frameIndex: number;
  timestamp: number;
  value: number;
  unit: string;
  title: string;
  /** JPEG data URL of the video frame with the measurement drawn on it. */
  imageDataUrl: string;
  width: number;
  height: number;
}

export interface LegSummary {
  midstanceKneeFlexionDeg: MetricResult;
  footStrikeShankAngleDeg: MetricResult;
  stepTimeSec: MetricResult;
  landingOffsetTorsoPct: MetricResult;
  events: number;
}

export interface GaitMetrics {
  cadenceSpm: MetricResult;
  avgStepTimeSec: MetricResult;
  groundContactTimeMs: MetricResult;
  flightTimeMs: MetricResult;
  dutyFactorPct: MetricResult;
  verticalOscillationTorsoPct: MetricResult;
  ankleAheadOfHipTorsoPct: MetricResult;
  footStrikeShankAngleDeg: MetricResult;
  midstanceKneeFlexionDeg: MetricResult;
  maxHipLineImageTiltDeg: MetricResult;
  strideTimeCvPct: MetricResult;
  stepCount: number;
  strideCount: number;
  medianStrideSec: number | null;
  events: FootStrikeEvent[];
  /** Percent of frames where both legs overlap, suggesting the pose model put both on one leg. */
  mergedLegFramesPct: number | null;
  left: LegSummary;
  right: LegSummary;
  leftContacts: number[];
  rightContacts: number[];
}

export interface SymmetryMetrics {
  symmetryScore: MetricResult;
  consistencyScore: MetricResult;
  /** Observed symmetry index: mean of step-time and landing-position indices (not scored). */
  symmetryIndexPct: MetricResult;
  kneeFlexionSymmetryIndexPct: MetricResult;
  stepTimeSymmetryIndexPct: MetricResult;
  landingOffsetSymmetryIndexPct: MetricResult;
  shankAngleDifferenceDeg: MetricResult;
  kneeAngleMaxLeftDeg: MetricResult;
  kneeAngleMaxRightDeg: MetricResult;
  kneeAngleMinLeftDeg: MetricResult;
  kneeAngleMinRightDeg: MetricResult;
  elbowAngleSimilarityPct: MetricResult;
}

export interface FormScoreData {
  overallScore: MetricResult;
  category: string;
  observations: string[];
  subScores: {
    cadence: MetricResult;
    footStrike: MetricResult;
    kneeFlexion: MetricResult;
    posture: MetricResult;
    consistency: MetricResult;
  };
}

export type CameraView = "side" | "oblique" | "front-or-back" | "unknown";

export interface AnalysisQuality {
  sampledFrames: number;
  trackedFrames: number;
  validTrackingPct: number;
  meanLandmarkVisibility: number | null;
  analyzedStartSec: number;
  analyzedEndSec: number;
  samplingRateFps: number;
  sourceDurationSec: number;
  cameraView: CameraView;
  /** Median shoulder/hip horizontal separation relative to torso length; small in a side view. */
  bodyWidthRatio: number | null;
  facingDirection: FacingDirection | null;
  /** Separate episodes where the pose model swapped left/right legs and the app corrected them. */
  legSwapEpisodes: number;
  sufficientForSummary: boolean;
  message: string;
  warnings: string[];
}

export interface CompleteAnalysisReport {
  totalFrames: number;
  fps: number;
  durationSec: number;
  videoWidth: number;
  videoHeight: number;
  frames: FramePose[];
  kinematics: KinematicSequence;
  gait: GaitMetrics;
  symmetry: SymmetryMetrics;
  formScore: FormScoreData;
  quality: AnalysisQuality;
  evidence: EvidenceFrame[];
}

export function metric(
  value: number | null,
  status: MetricStatus,
  unit: string,
  explanation: string
): MetricResult {
  const isAvailable = value !== null && Number.isFinite(value);
  return {
    value: isAvailable ? value : null,
    status: isAvailable ? status : "unavailable",
    unit,
    explanation,
  };
}

export function unavailableMetric(unit: string, explanation: string): MetricResult {
  return metric(null, "unavailable", unit, explanation);
}
