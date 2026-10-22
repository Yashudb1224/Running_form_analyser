export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface FramePose {
  frameIndex: number;
  timestamp: number;
  landmarks: Landmark[]; // 33 MediaPipe pose keypoints
}

export interface KinematicSequence {
  leftKneeAngles: number[];
  rightKneeAngles: number[];
  leftHipAngles: number[];
  rightHipAngles: number[];
  leftElbowAngles: number[];
  rightElbowAngles: number[];
  trunkLeanAngles: number[];
  pelvicTiltAngles: number[];
  leftAnkleY: number[];
  rightAnkleY: number[];
  pelvisCenterY: number[];
}

export interface GaitMetrics {
  cadenceSpm: number;
  avgStepTimeSec: number;
  groundContactTimeMs: number;
  flightTimeMs: number;
  dutyFactorPct: number;
  verticalOscillationCm: number;
  overstrideDistanceCm: number;
  pelvicDropMaxDeg: number;
  stepTimeCvPct: number;
  stancePct: number;
  swingPct: number;
  leftContacts: number[];
  rightContacts: number[];
}

export interface SymmetryMetrics {
  overallSymmetryScore: number;
  strideConsistencyScore: number;
  kneeFlexionMaxLeft: number;
  kneeFlexionMaxRight: number;
  kneeFlexionMinLeft: number;
  kneeFlexionMinRight: number;
  kneeMinSiPct: number;
  armSwingSymmetryPct: number;
}

export interface FormScoreData {
  overallScore: number;
  category: string;
  observations: string[];
  subScores: {
    symmetry: number;
    consistency: number;
    cadence: number;
    posture: number;
    efficiency: number;
  };
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
}

