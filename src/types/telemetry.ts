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

export interface KinematicSequence {
  leftKneeAngles: (number | null)[];
  rightKneeAngles: (number | null)[];
  leftHipAngles: (number | null)[];
  rightHipAngles: (number | null)[];
  leftElbowAngles: (number | null)[];
  rightElbowAngles: (number | null)[];
  trunkImagePlaneAngles: (number | null)[];
  hipLineImageTiltAngles: (number | null)[];
  leftAnkleY: (number | null)[];
  rightAnkleY: (number | null)[];
  pelvisCenterY: (number | null)[];
  torsoHeightPx: (number | null)[];
}

export interface GaitMetrics {
  cadenceSpm: MetricResult;
  avgStepTimeSec: MetricResult;
  groundContactTimeMs: MetricResult;
  flightTimeMs: MetricResult;
  dutyFactorPct: MetricResult;
  pelvisVerticalRangeBodyHeightPct: MetricResult;
  ankleHipOffsetBodyHeightPct: MetricResult;
  maxHipLineImageTiltDeg: MetricResult;
  stepTimeCvPct: MetricResult;
  stancePct: MetricResult;
  swingPct: MetricResult;
  leftContacts: number[];
  rightContacts: number[];
}

export interface SymmetryMetrics {
  kneeAngleSymmetryScore: MetricResult;
  strideConsistencyScore: MetricResult;
  kneeAngleMaxLeftDeg: MetricResult;
  kneeAngleMaxRightDeg: MetricResult;
  kneeAngleMinLeftDeg: MetricResult;
  kneeAngleMinRightDeg: MetricResult;
  kneeAngleAsymmetryPct: MetricResult;
  elbowAngleSimilarityPct: MetricResult;
}

export interface FormScoreData {
  overallScore: MetricResult;
  category: string;
  observations: string[];
  subScores: {
    symmetry: MetricResult;
    consistency: MetricResult;
    cadence: MetricResult;
    posture: MetricResult;
    efficiency: MetricResult;
  };
}

export interface AnalysisQuality {
  sampledFrames: number;
  trackedFrames: number;
  validTrackingPct: number;
  meanLandmarkVisibility: number | null;
  analyzedStartSec: number;
  analyzedEndSec: number;
  samplingRateFps: number;
  sourceDurationSec: number;
  sufficientForSummary: boolean;
  message: string;
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
