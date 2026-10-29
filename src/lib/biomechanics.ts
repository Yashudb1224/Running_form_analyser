import { CameraView, FacingDirection, FramePose, KinematicSequence, Landmark } from "../types/telemetry";

const MIN_VISIBILITY = 0.5;

function isUsable(point: Landmark | null | undefined): point is Landmark {
  return Boolean(
    point &&
    point.visibility !== null &&
    point.visibility >= MIN_VISIBILITY &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

export function calculate2DAngle(
  p1: Landmark | null | undefined,
  p2: Landmark | null | undefined,
  p3: Landmark | null | undefined
): number | null {
  if (!isUsable(p1) || !isUsable(p2) || !isUsable(p3)) return null;

  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return null;

  const cosine = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function calculateTrunkLean(shoulder: Landmark | null, hip: Landmark | null): number | null {
  if (!isUsable(shoulder) || !isUsable(hip)) return null;
  const vertical = hip.y - shoulder.y;
  if (Math.hypot(shoulder.x - hip.x, vertical) === 0) return null;
  return (Math.atan2(shoulder.x - hip.x, vertical) * 180) / Math.PI;
}

/** Signed angle of the knee-to-ankle segment from image vertical; positive when the ankle is at larger x. */
export function calculateShankAngle(knee: Landmark | null | undefined, ankle: Landmark | null | undefined): number | null {
  if (!isUsable(knee) || !isUsable(ankle)) return null;
  const vertical = ankle.y - knee.y;
  if (Math.hypot(ankle.x - knee.x, vertical) === 0) return null;
  return (Math.atan2(ankle.x - knee.x, vertical) * 180) / Math.PI;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Estimates which way the runner faces from the nose relative to the ears and the toes relative to
 * the heels. Each tracked frame casts a vote; a direction is only returned with a clear majority.
 */
export function detectFacingDirection(frames: FramePose[]): FacingDirection | null {
  let positive = 0;
  let negative = 0;
  for (const frame of frames) {
    const lm = frame.landmarks;
    const nose = lm[0] ?? null;
    const leftEar = lm[7] ?? null;
    const rightEar = lm[8] ?? null;
    const ears = midpoint(leftEar, rightEar) ?? (isUsable(leftEar) ? leftEar : isUsable(rightEar) ? rightEar : null);
    const votes: number[] = [];
    if (isUsable(nose) && ears) votes.push(nose.x - ears.x);
    for (const [heelIndex, toeIndex] of [[29, 31], [30, 32]] as const) {
      const heel = lm[heelIndex] ?? null;
      const toe = lm[toeIndex] ?? null;
      if (isUsable(heel) && isUsable(toe)) votes.push(toe.x - heel.x);
    }
    const sum = votes.reduce((total, vote) => total + Math.sign(vote), 0);
    if (sum > 0) positive++;
    else if (sum < 0) negative++;
  }
  const total = positive + negative;
  if (total < 3) return null;
  if (positive / total >= 0.7) return 1;
  if (negative / total >= 0.7) return -1;
  return null;
}

/**
 * Classifies the camera view from how far apart the left and right shoulders and hips appear relative
 * to torso length. In a true side view both pairs overlap horizontally.
 */
export function assessCameraView(frames: FramePose[]): { view: CameraView; bodyWidthRatio: number | null } {
  const ratios: number[] = [];
  for (const frame of frames) {
    const [leftShoulder, rightShoulder, leftHip, rightHip] = [11, 12, 23, 24].map((index) => frame.landmarks[index] ?? null);
    const shoulderCenter = midpoint(leftShoulder, rightShoulder);
    const hipCenter = midpoint(leftHip, rightHip);
    if (!shoulderCenter || !hipCenter || !leftShoulder || !rightShoulder || !leftHip || !rightHip) continue;
    const torso = Math.hypot(shoulderCenter.x - hipCenter.x, shoulderCenter.y - hipCenter.y);
    if (torso <= 0) continue;
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const hipWidth = Math.abs(leftHip.x - rightHip.x);
    ratios.push((shoulderWidth + hipWidth) / 2 / torso);
  }
  const ratio = median(ratios);
  if (ratio === null) return { view: "unknown", bodyWidthRatio: null };
  const rounded = Math.round(ratio * 100) / 100;
  if (ratio < 0.3) return { view: "side", bodyWidthRatio: rounded };
  if (ratio < 0.55) return { view: "oblique", bodyWidthRatio: rounded };
  return { view: "front-or-back", bodyWidthRatio: rounded };
}

export function calculatePelvicTilt(lHip: Landmark | null, rHip: Landmark | null): number | null {
  if (!isUsable(lHip) || !isUsable(rHip)) return null;
  const dx = rHip.x - lHip.x;
  const dy = rHip.y - lHip.y;
  if (Math.hypot(dx, dy) === 0) return null;
  return (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
}

function midpoint(a: Landmark | null, b: Landmark | null): Landmark | null {
  if (!isUsable(a) || !isUsable(b)) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: a.z !== null && b.z !== null ? (a.z + b.z) / 2 : null,
    visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0),
  };
}

export function computeSequenceKinematics(frames: FramePose[]): KinematicSequence {
  const facingDirection = detectFacingDirection(frames);
  const result: KinematicSequence = {
    leftKneeAngles: [],
    rightKneeAngles: [],
    leftHipAngles: [],
    rightHipAngles: [],
    leftElbowAngles: [],
    rightElbowAngles: [],
    trunkImagePlaneAngles: [],
    trunkForwardLeanAngles: [],
    hipLineImageTiltAngles: [],
    leftAnkleY: [],
    rightAnkleY: [],
    pelvisCenterY: [],
    torsoHeightPx: [],
    facingDirection,
  };

  for (const frame of frames) {
    const lm = frame.landmarks;
    const leftShoulder = lm[11] ?? null;
    const rightShoulder = lm[12] ?? null;
    const leftElbow = lm[13] ?? null;
    const rightElbow = lm[14] ?? null;
    const leftWrist = lm[15] ?? null;
    const rightWrist = lm[16] ?? null;
    const leftHip = lm[23] ?? null;
    const rightHip = lm[24] ?? null;
    const leftKnee = lm[25] ?? null;
    const rightKnee = lm[26] ?? null;
    const leftAnkle = lm[27] ?? null;
    const rightAnkle = lm[28] ?? null;
    const shoulderCenter = midpoint(leftShoulder, rightShoulder);
    const hipCenter = midpoint(leftHip, rightHip);

    result.leftKneeAngles.push(calculate2DAngle(leftHip, leftKnee, leftAnkle));
    result.rightKneeAngles.push(calculate2DAngle(rightHip, rightKnee, rightAnkle));
    result.leftHipAngles.push(calculate2DAngle(leftShoulder, leftHip, leftKnee));
    result.rightHipAngles.push(calculate2DAngle(rightShoulder, rightHip, rightKnee));
    result.leftElbowAngles.push(calculate2DAngle(leftShoulder, leftElbow, leftWrist));
    result.rightElbowAngles.push(calculate2DAngle(rightShoulder, rightElbow, rightWrist));
    const trunkAngle = calculateTrunkLean(shoulderCenter, hipCenter);
    result.trunkImagePlaneAngles.push(trunkAngle);
    result.trunkForwardLeanAngles.push(trunkAngle === null || facingDirection === null ? null : trunkAngle * facingDirection);
    result.hipLineImageTiltAngles.push(calculatePelvicTilt(leftHip, rightHip));
    result.leftAnkleY.push(isUsable(leftAnkle) ? leftAnkle.y : null);
    result.rightAnkleY.push(isUsable(rightAnkle) ? rightAnkle.y : null);
    result.pelvisCenterY.push(hipCenter?.y ?? null);
    result.torsoHeightPx.push(
      shoulderCenter && hipCenter ? Math.abs(hipCenter.y - shoulderCenter.y) || null : null
    );
  }

  return result;
}
