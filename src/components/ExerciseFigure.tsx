import React, { useEffect, useRef, useState } from "react";
import {
  EXERCISE_ANIMATIONS, ExerciseAnimationId, FIGURE, Point, Skeleton, blendPoses, computeSkeleton,
} from "@/lib/exerciseAnimations";

const ease = (t: number) => t * t * (3 - 2 * t);

/** Pose of the looping animation at a given time, easing between keyframes with optional holds. */
function skeletonAt(id: ExerciseAnimationId, seconds: number): Skeleton {
  const { keyframes, stepSeconds, holdSeconds = 0 } = EXERCISE_ANIMATIONS[id];
  const segment = stepSeconds + holdSeconds;
  const loop = segment * keyframes.length;
  // requestAnimationFrame timestamps can be slightly earlier than the start time, so keep time ≥ 0
  // and the keyframe index in range.
  const time = ((seconds % loop) + loop) % loop;
  const index = Math.min(keyframes.length - 1, Math.max(0, Math.floor(time / segment)));
  const within = time - index * segment;
  const t = within < holdSeconds ? 0 : ease((within - holdSeconds) / stepSeconds);
  return computeSkeleton(blendPoses(keyframes[index], keyframes[(index + 1) % keyframes.length], t));
}

/** Runner's kit, matching Dash: blue vest, navy shorts, blue shoes. Far-side limbs are a shade darker. */
const COLORS = {
  outline: "#1f2937",
  skin: "#f2bd94",
  skinFar: "#d79d74",
  hair: "#3b2a20",
  vestFrom: "#3b82f6",
  vestTo: "#1d4ed8",
  shorts: "#1e3a8a",
  shortsFar: "#172c6b",
  shoe: "#2563eb",
  shoeFar: "#1d4ed8",
  sole: "#f8fafc",
  sock: "#f8fafc",
} as const;
const OUTLINE_WIDTH = 2.6;

type Shape =
  | { kind: "capsule"; a: Point; b: Point; ra: number; rb: number; fill: string }
  | { kind: "circle"; c: Point; r: number; fill: string };

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const f = (value: number) => value.toFixed(1);

/** A rounded, tapered limb segment: two end circles joined by their side tangents. */
function shapePath(shape: Shape): string {
  const circle = (c: Point, r: number) => `M${f(c.x - r)},${f(c.y)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0Z`;
  if (shape.kind === "circle") return circle(shape.c, shape.r);
  const { a, b, ra, rb } = shape;
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  const side = `M${f(a.x + nx * ra)},${f(a.y + ny * ra)}L${f(b.x + nx * rb)},${f(b.y + ny * rb)}L${f(b.x - nx * rb)},${f(b.y - ny * rb)}L${f(a.x - nx * ra)},${f(a.y - ny * ra)}Z`;
  return side + circle(a, ra) + circle(b, rb);
}

/** One body layer drawn as a silhouette: every outline first, then every fill, so joints stay seamless. */
function Layer({ shapes }: { shapes: Shape[] }) {
  const paths = shapes.map(shapePath);
  return (
    <g>
      {paths.map((d, index) => <path key={`o${index}`} d={d} fill={COLORS.outline} stroke={COLORS.outline} strokeWidth={OUTLINE_WIDTH * 2} strokeLinejoin="round" />)}
      {paths.map((d, index) => <path key={`f${index}`} d={d} fill={shapes[index].fill} />)}
    </g>
  );
}

function legShapes(hip: Point, leg: Skeleton["near"], far: boolean): Shape[] {
  const skin = far ? COLORS.skinFar : COLORS.skin;
  const shoe = far ? COLORS.shoeFar : COLORS.shoe;
  const footLength = Math.hypot(leg.toe.x - leg.ankle.x, leg.toe.y - leg.ankle.y) || 1;
  const heel = { x: leg.ankle.x - ((leg.toe.x - leg.ankle.x) / footLength) * 3, y: leg.ankle.y - ((leg.toe.y - leg.ankle.y) / footLength) * 3 };
  return [
    { kind: "capsule", a: hip, b: leg.knee, ra: 7.4, rb: 5.4, fill: skin },
    { kind: "capsule", a: leg.knee, b: leg.ankle, ra: 5.2, rb: 3.6, fill: skin },
    { kind: "capsule", a: lerp(leg.knee, leg.ankle, 0.82), b: leg.ankle, ra: 3.9, rb: 3.9, fill: COLORS.sock },
    { kind: "capsule", a: hip, b: lerp(hip, leg.knee, 0.5), ra: 8.6, rb: 7.2, fill: far ? COLORS.shortsFar : COLORS.shorts },
    { kind: "capsule", a: heel, b: leg.toe, ra: 4.6, rb: 3.4, fill: shoe },
  ];
}

function armShapes(shoulder: Point, arm: Skeleton["nearArm"], far: boolean): Shape[] {
  const skin = far ? COLORS.skinFar : COLORS.skin;
  return [
    { kind: "capsule", a: shoulder, b: arm.elbow, ra: 4.8, rb: 3.8, fill: skin },
    { kind: "capsule", a: arm.elbow, b: arm.wrist, ra: 3.7, rb: 3, fill: skin },
    { kind: "circle", c: arm.wrist, r: 3.9, fill: skin },
  ];
}

/** How far the drawn body reaches below its lowest joint, so the runner can be lifted onto the floor. */
function bodyDepth(skeleton: Skeleton): number {
  const padded: [Point, number][] = [
    [skeleton.head, 10.2], [skeleton.neck, 3.6], [skeleton.shoulder, 11.4], [skeleton.hip, 10.8],
    [skeleton.near.knee, 5.4], [skeleton.far.knee, 5.4], [skeleton.near.ankle, 4.6], [skeleton.far.ankle, 4.6],
    [skeleton.near.toe, 3.4], [skeleton.far.toe, 3.4], [skeleton.nearArm.elbow, 3.8], [skeleton.farArm.elbow, 3.8],
    [skeleton.nearArm.wrist, 3.9], [skeleton.farArm.wrist, 3.9],
  ];
  const lowestJoint = Math.max(...padded.map(([point]) => point.y));
  const lowestEdge = Math.max(...padded.map(([point, radius]) => point.y + radius + OUTLINE_WIDTH));
  return lowestEdge - lowestJoint;
}

function Runner({ skeleton, vest }: { skeleton: Skeleton; vest: string }) {
  const { hip, shoulder, neck, head } = skeleton;
  // Head orientation: "up" along the neck, "forward" a quarter-turn clockwise (the figure faces right).
  const upLength = Math.hypot(head.x - neck.x, head.y - neck.y) || 1;
  const up = { x: (head.x - neck.x) / upLength, y: (head.y - neck.y) / upLength };
  const forward = { x: -up.y, y: up.x };
  const face = { x: head.x + forward.x * 1.6 - up.x * 1.2, y: head.y + forward.y * 1.6 - up.y * 1.2 };
  const eye = { x: head.x + forward.x * 5.6 + up.x * 0.8, y: head.y + forward.y * 5.6 + up.y * 0.8 };
  const nose = { x: head.x + forward.x * 9.6 - up.x * 1.6, y: head.y + forward.y * 9.6 - up.y * 1.6 };
  const waist = lerp(hip, shoulder, 0.16);

  return (
    <g transform={`translate(0 ${f(-bodyDepth(skeleton))})`}>
      <Layer shapes={armShapes(shoulder, skeleton.farArm, true)} />
      <Layer shapes={legShapes(hip, skeleton.far, true)} />
      <Layer
        shapes={[
          { kind: "capsule", a: shoulder, b: neck, ra: 3.6, rb: 3.6, fill: COLORS.skin },
          { kind: "capsule", a: hip, b: lerp(hip, shoulder, 0.92), ra: 10.4, rb: 11.4, fill: vest },
          { kind: "capsule", a: hip, b: waist, ra: 10.8, rb: 10.6, fill: COLORS.shorts },
        ]}
      />
      <Layer
        shapes={[
          { kind: "circle", c: head, r: 10.2, fill: COLORS.hair },
          { kind: "circle", c: nose, r: 2, fill: COLORS.skin },
          { kind: "circle", c: face, r: 8.6, fill: COLORS.skin },
        ]}
      />
      <circle cx={eye.x} cy={eye.y} r={1.3} fill={COLORS.outline} />
      <Layer shapes={legShapes(hip, skeleton.near, false)} />
      <Layer shapes={armShapes(shoulder, skeleton.nearArm, false)} />
    </g>
  );
}

/** An animated, illustrated runner demonstrating an exercise, driven by joint-angle keyframes. */
export function ExerciseFigure({ animation, label, className = "" }: { animation: ExerciseAnimationId; label: string; className?: string }) {
  const [skeleton, setSkeleton] = useState<Skeleton>(() => skeletonAt(animation, 0));
  const containerRef = useRef<SVGSVGElement>(null);
  const gradientId = `exercise-vest-${React.useId().replace(/:/g, "")}`;

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setSkeleton(skeletonAt(animation, EXERCISE_ANIMATIONS[animation].stepSeconds * 0.5));
      return;
    }
    let frame = 0;
    let visible = true;
    const start = performance.now();
    const tick = (now: number) => {
      if (visible) setSkeleton(skeletonAt(animation, Math.max(0, now - start) / 1000));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [animation]);

  const { prop } = EXERCISE_ANIMATIONS[animation];
  return (
    <svg ref={containerRef} viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`} className={className} role="img" aria-label={`Animation: ${label}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={COLORS.vestFrom} />
          <stop offset="100%" stopColor={COLORS.vestTo} />
        </linearGradient>
      </defs>
      <ellipse cx={(skeleton.near.ankle.x + skeleton.far.ankle.x) / 2} cy={FIGURE.ground + 2} rx={34} ry={4} style={{ fill: "rgb(var(--ink) / 0.12)" }} />
      <line x1="16" x2={FIGURE.width - 16} y1={FIGURE.ground + 1} y2={FIGURE.ground + 1} style={{ stroke: "rgb(var(--border-strong))" }} strokeWidth="2" strokeLinecap="round" />
      {prop === "wall" && <rect x={FIGURE.width - 34} y={40} width={10} height={FIGURE.ground - 39} rx={2} style={{ fill: "rgb(var(--border-strong))" }} />}
      <Runner skeleton={skeleton} vest={`url(#${gradientId})`} />
    </svg>
  );
}
