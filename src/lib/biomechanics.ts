import { FramePose, KinematicSequence, Landmark } from "@/types/telemetry";

/**
 * Calculates 2D vector angle (degrees) formed by three keypoints (p1 -> vertex p2 -> p3).
 */
export function calculate2DAngle(p1: Landmark, p2: Landmark, p3: Landmark): number {
  if (p1.visibility < 0.2 || p2.visibility < 0.2 || p3.visibility < 0.2) {
    return 180.0; // Default open angle if low visibility
  }

  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 180.0;

  let cosAngle = dot / (mag1 * mag2);
  cosAngle = Math.max(-1.0, Math.min(1.0, cosAngle)); // Clamp bounds

  const angleRad = Math.acos(cosAngle);
  return (angleRad * 180.0) / Math.PI;
}

/**
 * Calculates forward trunk lean angle relative to true vertical axis.
 */
export function calculateTrunkLean(shoulder: Landmark, hip: Landmark): number {
  if (shoulder.visibility < 0.2 || hip.visibility < 0.2) return 5.0;

  const dx = shoulder.x - hip.x;
  const dy = hip.y - shoulder.y; // Invert canvas y coordinate

  const angleRad = Math.atan2(dx, dy);
  return (angleRad * 180.0) / Math.PI;
}

/**
 * Calculates lateral pelvic tilt (hip drop) angle relative to horizontal.
 */
export function calculatePelvicTilt(lHip: Landmark, rHip: Landmark): number {
  if (lHip.visibility < 0.2 || rHip.visibility < 0.2) return 0.0;

  const dx = rHip.x - lHip.x;
  const dy = rHip.y - lHip.y;

  if (Math.abs(dx) < 1e-5) return 0.0;

  const angleRad = Math.atan2(dy, dx);
  return Math.abs((angleRad * 180.0) / Math.PI);
}

/**
 * Computes time-series kinematics across all extracted pose frames.
 */
export function computeSequenceKinematics(frames: FramePose[]): KinematicSequence {
  const leftKneeAngles: number[] = [];
  const rightKneeAngles: number[] = [];
  const leftHipAngles: number[] = [];
  const rightHipAngles: number[] = [];
  const leftElbowAngles: number[] = [];
  const rightElbowAngles: number[] = [];
  const trunkLeanAngles: number[] = [];
  const pelvicTiltAngles: number[] = [];
  const leftAnkleY: number[] = [];
  const rightAnkleY: number[] = [];
  const pelvisCenterY: number[] = [];

  for (const frame of frames) {
    const lm = frame.landmarks;

    // Landmark indices:
    // 11: Left Shoulder, 12: Right Shoulder
    // 13: Left Elbow, 14: Right Elbow
    // 15: Left Wrist, 16: Right Wrist
    // 23: Left Hip, 24: Right Hip
    // 25: Left Knee, 26: Right Knee
    // 27: Left Ankle, 28: Right Ankle

    const lShoulder = lm[11] || { x: 0, y: 0, z: 0, visibility: 0 };
    const rShoulder = lm[12] || { x: 0, y: 0, z: 0, visibility: 0 };
    const lElbow = lm[13] || { x: 0, y: 0, z: 0, visibility: 0 };
    const rElbow = lm[14] || { x: 0, y: 0, z: 0, visibility: 0 };
    const lWrist = lm[15] || { x: 0, y: 0, z: 0, visibility: 0 };
    const rWrist = lm[16] || { x: 0, y: 0, z: 0, visibility: 0 };
    const lHip = lm[23] || { x: 0, y: 0, z: 0, visibility: 0 };
    const rHip = lm[24] || { x: 0, y: 0, z: 0, visibility: 0 };
    const lKnee = lm[25] || { x: 0, y: 0, z: 0, visibility: 0 };
    const rKnee = lm[26] || { x: 0, y: 0, z: 0, visibility: 0 };
    const lAnkle = lm[27] || { x: 0, y: 0, z: 0, visibility: 0 };
    const rAnkle = lm[28] || { x: 0, y: 0, z: 0, visibility: 0 };

    // Knee Flexion Angle (Hip -> Knee -> Ankle)
    const lKneeAng = calculate2DAngle(lHip, lKnee, lAnkle);
    const rKneeAng = calculate2DAngle(rHip, rKnee, rAnkle);

    // Hip Angle (Shoulder -> Hip -> Knee)
    const lHipAng = calculate2DAngle(lShoulder, lHip, lKnee);
    const rHipAng = calculate2DAngle(rShoulder, rHip, rKnee);

    // Elbow Angle (Shoulder -> Elbow -> Wrist)
    const lElbowAng = calculate2DAngle(lShoulder, lElbow, lWrist);
    const rElbowAng = calculate2DAngle(rShoulder, rElbow, rWrist);

    // Trunk Lean
    const avgShoulder = {
      x: (lShoulder.x + rShoulder.x) / 2,
      y: (lShoulder.y + rShoulder.y) / 2,
      z: 0,
      visibility: (lShoulder.visibility + rShoulder.visibility) / 2
    };
    const avgHip = {
      x: (lHip.x + rHip.x) / 2,
      y: (lHip.y + rHip.y) / 2,
      z: 0,
      visibility: (lHip.visibility + rHip.visibility) / 2
    };
    const trunkLean = calculateTrunkLean(avgShoulder, avgHip);

    // Lateral Pelvic Tilt (Hip Drop)
    const pelvicTilt = calculatePelvicTilt(lHip, rHip);

    leftKneeAngles.push(lKneeAng);
    rightKneeAngles.push(rKneeAng);
    leftHipAngles.push(lHipAng);
    rightHipAngles.push(rHipAng);
    leftElbowAngles.push(lElbowAng);
    rightElbowAngles.push(rElbowAng);
    trunkLeanAngles.push(trunkLean);
    pelvicTiltAngles.push(pelvicTilt);
    leftAnkleY.push(lAnkle.y);
    rightAnkleY.push(rAnkle.y);
    pelvisCenterY.push(avgHip.y);
  }

  return {
    leftKneeAngles,
    rightKneeAngles,
    leftHipAngles,
    rightHipAngles,
    leftElbowAngles,
    rightElbowAngles,
    trunkLeanAngles,
    pelvicTiltAngles,
    leftAnkleY,
    rightAnkleY,
    pelvisCenterY
  };
}

