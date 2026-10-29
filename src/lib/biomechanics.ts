import { FramePose, KinematicSequence, Landmark } from "../types/telemetry";

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
  const result: KinematicSequence = {
    leftKneeAngles: [],
    rightKneeAngles: [],
    leftHipAngles: [],
    rightHipAngles: [],
    leftElbowAngles: [],
    rightElbowAngles: [],
    trunkImagePlaneAngles: [],
    hipLineImageTiltAngles: [],
    leftAnkleY: [],
    rightAnkleY: [],
    pelvisCenterY: [],
    torsoHeightPx: [],
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
    result.trunkImagePlaneAngles.push(calculateTrunkLean(shoulderCenter, hipCenter));
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
