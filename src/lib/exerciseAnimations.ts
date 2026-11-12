/**
 * Exercise demonstrations as joint-angle keyframes for a side-view figure facing right.
 * A pose is turned into joint positions by forward kinematics, the figure is placed on the ground
 * line, and the renderer eases between keyframes in a loop.
 *
 * Angles are in degrees. Trunk: from vertical, positive leaning forward. Thigh / upper arm: from
 * vertical pointing down, positive swinging forward. Knee: flexion (shin folds back). Elbow:
 * flexion (forearm folds forward). Ankle: foot rotation, positive pointing the toes down.
 */

export interface LimbPose {
  thigh: number;
  knee: number;
  ankle?: number;
}

export interface ArmPose {
  upper: number;
  elbow: number;
}

export interface Pose {
  trunk: number;
  /** Near (left) and far (right) leg. */
  near: LimbPose;
  far: LimbPose;
  nearArm: ArmPose;
  farArm: ArmPose;
  /** Extra height above the ground, for hops. */
  lift?: number;
  /** Neck and head direction, like the trunk; defaults to the trunk angle (lying poses tilt it). */
  head?: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Skeleton {
  head: Point;
  neck: Point;
  shoulder: Point;
  hip: Point;
  near: { knee: Point; ankle: Point; toe: Point };
  far: { knee: Point; ankle: Point; toe: Point };
  nearArm: { elbow: Point; wrist: Point };
  farArm: { elbow: Point; wrist: Point };
}

export type ExerciseAnimationId =
  | "aSkip" | "highKnees" | "quickFeet" | "wallDrill" | "squat" | "calfRaise" | "gluteBridge"
  | "plank" | "reverseLunge" | "singleLegBalance" | "singleLegSquat" | "buttKicks";

export interface ExerciseAnimation {
  keyframes: Pose[];
  /** Seconds per transition between keyframes. */
  stepSeconds: number;
  /** Seconds to hold each keyframe before moving on. */
  holdSeconds?: number;
  prop?: "wall";
}

export const FIGURE = { width: 220, height: 200, ground: 178, centerX: 110 } as const;
const LENGTH = { trunk: 52, neck: 7, head: 10, thigh: 38, shin: 36, foot: 13, upperArm: 27, forearm: 25 } as const;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const add = (point: Point, length: number, angle: number, down = true): Point => ({
  x: point.x + length * Math.sin(rad(angle)),
  y: point.y + (down ? 1 : -1) * length * Math.cos(rad(angle)),
});

function leg(hip: Point, limb: LimbPose) {
  const knee = add(hip, LENGTH.thigh, limb.thigh);
  const shinAngle = limb.thigh - limb.knee;
  const ankle = add(knee, LENGTH.shin, shinAngle);
  // The foot is perpendicular to the shin, pointing forward; ankle rotation points the toes down.
  const footAngle = rad(shinAngle + (limb.ankle ?? 0));
  const toe = { x: ankle.x + LENGTH.foot * Math.cos(footAngle), y: ankle.y + LENGTH.foot * Math.sin(footAngle) };
  return { knee, ankle, toe };
}

function arm(shoulder: Point, pose: ArmPose) {
  const elbow = add(shoulder, LENGTH.upperArm, pose.upper);
  const wrist = add(elbow, LENGTH.forearm, pose.upper + pose.elbow);
  return { elbow, wrist };
}

/** Joint positions for a pose, shifted so the lowest point rests on the ground line. */
export function computeSkeleton(pose: Pose): Skeleton {
  const hip = { x: FIGURE.centerX, y: 0 };
  const shoulder = add(hip, LENGTH.trunk, pose.trunk, false);
  const neck = add(shoulder, LENGTH.neck, pose.head ?? pose.trunk, false);
  const head = add(neck, LENGTH.head, pose.head ?? pose.trunk, false);
  const skeleton: Skeleton = {
    head, neck, shoulder, hip,
    near: leg(hip, pose.near),
    far: leg(hip, pose.far),
    nearArm: arm(shoulder, pose.nearArm),
    farArm: arm(shoulder, pose.farArm),
  };
  const points = allPoints(skeleton);
  const lowest = Math.max(...points.map((point) => point.y), head.y + LENGTH.head);
  const leftmost = Math.min(...points.map((point) => point.x));
  const rightmost = Math.max(...points.map((point) => point.x));
  const dy = FIGURE.ground - lowest - (pose.lift ?? 0);
  // Keep wide poses (plank, bridge) centred horizontally.
  const dx = FIGURE.centerX - (leftmost + rightmost) / 2;
  return shift(skeleton, dx, dy);
}

function allPoints(skeleton: Skeleton): Point[] {
  return [
    skeleton.shoulder, skeleton.hip, skeleton.neck,
    skeleton.near.knee, skeleton.near.ankle, skeleton.near.toe,
    skeleton.far.knee, skeleton.far.ankle, skeleton.far.toe,
    skeleton.nearArm.elbow, skeleton.nearArm.wrist, skeleton.farArm.elbow, skeleton.farArm.wrist,
  ];
}

function shift(skeleton: Skeleton, dx: number, dy: number): Skeleton {
  const move = (point: Point): Point => ({ x: point.x + dx, y: point.y + dy });
  return {
    head: move(skeleton.head), neck: move(skeleton.neck), shoulder: move(skeleton.shoulder), hip: move(skeleton.hip),
    near: { knee: move(skeleton.near.knee), ankle: move(skeleton.near.ankle), toe: move(skeleton.near.toe) },
    far: { knee: move(skeleton.far.knee), ankle: move(skeleton.far.ankle), toe: move(skeleton.far.toe) },
    nearArm: { elbow: move(skeleton.nearArm.elbow), wrist: move(skeleton.nearArm.wrist) },
    farArm: { elbow: move(skeleton.farArm.elbow), wrist: move(skeleton.farArm.wrist) },
  };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolates two poses (t from 0 to 1). */
export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  const limb = (x: LimbPose, y: LimbPose): LimbPose => ({ thigh: mix(x.thigh, y.thigh, t), knee: mix(x.knee, y.knee, t), ankle: mix(x.ankle ?? 0, y.ankle ?? 0, t) });
  const armPose = (x: ArmPose, y: ArmPose): ArmPose => ({ upper: mix(x.upper, y.upper, t), elbow: mix(x.elbow, y.elbow, t) });
  return {
    trunk: mix(a.trunk, b.trunk, t),
    near: limb(a.near, b.near),
    far: limb(a.far, b.far),
    nearArm: armPose(a.nearArm, b.nearArm),
    farArm: armPose(a.farArm, b.farArm),
    lift: mix(a.lift ?? 0, b.lift ?? 0, t),
    head: a.head === undefined && b.head === undefined ? undefined : mix(a.head ?? a.trunk, b.head ?? b.trunk, t),
  };
}

const standing: Pose = {
  trunk: 3,
  near: { thigh: 0, knee: 4 },
  far: { thigh: 0, knee: 4 },
  nearArm: { upper: -5, elbow: 25 },
  farArm: { upper: 5, elbow: 25 },
};

/** Running-drill pose with one knee driven up (near or far leg) and opposite arm swing. */
const drive = (side: "near" | "far", thigh: number, knee: number, lift: number): Pose => {
  const up = { thigh, knee, ankle: -10 };
  const support = { thigh: -8, knee: 6, ankle: 10 };
  const forwardArm = { upper: 45, elbow: 85 };
  const backArm = { upper: -40, elbow: 85 };
  return side === "near"
    ? { trunk: 4, near: up, far: support, nearArm: backArm, farArm: forwardArm, lift }
    : { trunk: 4, near: support, far: up, nearArm: forwardArm, farArm: backArm, lift };
};

const kick = (side: "near" | "far"): Pose => {
  const up = { thigh: -8, knee: 135 };
  const support = { thigh: 2, knee: 6, ankle: 15 };
  return side === "near"
    ? { trunk: 6, near: up, far: support, nearArm: { upper: 35, elbow: 85 }, farArm: { upper: -35, elbow: 85 }, lift: 5 }
    : { trunk: 6, near: support, far: up, nearArm: { upper: -35, elbow: 85 }, farArm: { upper: 35, elbow: 85 }, lift: 5 };
};

export const EXERCISE_ANIMATIONS: Record<ExerciseAnimationId, ExerciseAnimation> = {
  aSkip: { keyframes: [drive("near", 75, 85, 8), drive("far", 75, 85, 8)], stepSeconds: 0.45 },
  highKnees: { keyframes: [drive("near", 88, 100, 4), drive("far", 88, 100, 4)], stepSeconds: 0.28 },
  // Pass through a tall stance between kicks so the in-between frames never look like kneeling.
  buttKicks: {
    keyframes: [kick("near"), { ...kick("near"), near: { thigh: 0, knee: 6 }, far: { thigh: 0, knee: 6 } }, kick("far"), { ...kick("far"), near: { thigh: 0, knee: 6 }, far: { thigh: 0, knee: 6 } }],
    stepSeconds: 0.16,
  },
  quickFeet: {
    keyframes: [
      { ...standing, near: { thigh: 4, knee: 12, ankle: 20 }, far: { thigh: -4, knee: 12, ankle: 20 }, nearArm: { upper: 10, elbow: 90 }, farArm: { upper: 10, elbow: 90 }, lift: 8 },
      { ...standing, near: { thigh: 2, knee: 16, ankle: 5 }, far: { thigh: -2, knee: 16, ankle: 5 }, nearArm: { upper: 12, elbow: 92 }, farArm: { upper: 12, elbow: 92 }, lift: 0 },
    ],
    stepSeconds: 0.18,
  },
  wallDrill: {
    keyframes: [
      { trunk: 28, near: { thigh: 75, knee: 95, ankle: -10 }, far: { thigh: -22, knee: 4, ankle: 25 }, nearArm: { upper: 95, elbow: 5 }, farArm: { upper: 92, elbow: 5 } },
      { trunk: 28, near: { thigh: -22, knee: 4, ankle: 25 }, far: { thigh: 75, knee: 95, ankle: -10 }, nearArm: { upper: 95, elbow: 5 }, farArm: { upper: 92, elbow: 5 } },
    ],
    stepSeconds: 0.5,
    holdSeconds: 0.15,
    prop: "wall",
  },
  squat: {
    keyframes: [
      { ...standing, nearArm: { upper: 85, elbow: 0 }, farArm: { upper: 80, elbow: 0 } },
      { trunk: 38, near: { thigh: 88, knee: 110, ankle: -20 }, far: { thigh: 86, knee: 108, ankle: -20 }, nearArm: { upper: 95, elbow: 0 }, farArm: { upper: 90, elbow: 0 } },
    ],
    stepSeconds: 0.9,
    holdSeconds: 0.25,
  },
  calfRaise: {
    keyframes: [
      { ...standing, nearArm: { upper: -5, elbow: 10 }, farArm: { upper: 5, elbow: 10 } },
      { ...standing, near: { thigh: 0, knee: 0, ankle: 40 }, far: { thigh: 0, knee: 0, ankle: 40 }, nearArm: { upper: -5, elbow: 10 }, farArm: { upper: 5, elbow: 10 } },
    ],
    stepSeconds: 0.7,
    holdSeconds: 0.35,
  },
  gluteBridge: {
    keyframes: [
      // Lying on the back, knees up and feet flat; then the hips lift until shoulders, hips and knees line up.
      { trunk: -90, head: -75, near: { thigh: 153, knee: 133, ankle: -20 }, far: { thigh: 151, knee: 131, ankle: -20 }, nearArm: { upper: 90, elbow: 0 }, farArm: { upper: 92, elbow: 0 } },
      { trunk: -110, head: -75, near: { thigh: 118, knee: 118, ankle: 0 }, far: { thigh: 116, knee: 116, ankle: 0 }, nearArm: { upper: 110, elbow: 0 }, farArm: { upper: 112, elbow: 0 } },
    ],
    stepSeconds: 0.9,
    holdSeconds: 0.4,
  },
  plank: {
    keyframes: [
      { trunk: 92, near: { thigh: -88, knee: 0, ankle: -90 }, far: { thigh: -88, knee: 0, ankle: -90 }, nearArm: { upper: 0, elbow: 90 }, farArm: { upper: 2, elbow: 90 } },
      { trunk: 89, near: { thigh: -91, knee: 0, ankle: -90 }, far: { thigh: -91, knee: 0, ankle: -90 }, nearArm: { upper: 0, elbow: 90 }, farArm: { upper: 2, elbow: 90 } },
    ],
    stepSeconds: 1.4,
  },
  reverseLunge: {
    keyframes: [
      { ...standing, nearArm: { upper: -10, elbow: 100 }, farArm: { upper: -10, elbow: 100 } },
      { trunk: 6, near: { thigh: -42, knee: 95, ankle: 40 }, far: { thigh: 80, knee: 82, ankle: -5 }, nearArm: { upper: -10, elbow: 100 }, farArm: { upper: -10, elbow: 100 } },
    ],
    stepSeconds: 0.85,
    holdSeconds: 0.3,
  },
  singleLegBalance: {
    keyframes: [
      { trunk: 2, near: { thigh: 85, knee: 90, ankle: -10 }, far: { thigh: 0, knee: 4 }, nearArm: { upper: 60, elbow: 30 }, farArm: { upper: -55, elbow: 30 } },
      { trunk: 4, near: { thigh: 82, knee: 92, ankle: -10 }, far: { thigh: 1, knee: 6 }, nearArm: { upper: 50, elbow: 35 }, farArm: { upper: -45, elbow: 35 } },
    ],
    stepSeconds: 1.2,
  },
  singleLegSquat: {
    keyframes: [
      { trunk: 4, near: { thigh: 30, knee: 15, ankle: -10 }, far: { thigh: 0, knee: 4 }, nearArm: { upper: 80, elbow: 0 }, farArm: { upper: 78, elbow: 0 } },
      { trunk: 30, near: { thigh: 55, knee: 10, ankle: -10 }, far: { thigh: 62, knee: 78, ankle: -15 }, nearArm: { upper: 95, elbow: 0 }, farArm: { upper: 92, elbow: 0 } },
    ],
    stepSeconds: 1,
    holdSeconds: 0.25,
  },
};
