import React, { useEffect, useId, useRef, useState } from "react";
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

function Limb({ points, color, width, opacity = 1 }: { points: Point[]; color: string; width: number; opacity?: number }) {
  return (
    <polyline
      points={points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

/** An animated figure demonstrating an exercise, drawn from joint-angle keyframes. */
export function ExerciseFigure({ animation, label, className = "" }: { animation: ExerciseAnimationId; label: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const [skeleton, setSkeleton] = useState<Skeleton>(() => skeletonAt(animation, 0));
  const containerRef = useRef<SVGSVGElement>(null);

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

  const near = `url(#exercise-near-${id})`;
  const { prop } = EXERCISE_ANIMATIONS[animation];
  return (
    <svg ref={containerRef} viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`} className={className} role="img" aria-label={`Animation: ${label}`}>
      <defs>
        <linearGradient id={`exercise-near-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "rgb(var(--brand-from))" }} />
          <stop offset="100%" style={{ stopColor: "rgb(var(--brand-to))" }} />
        </linearGradient>
      </defs>
      <line x1="16" x2={FIGURE.width - 16} y1={FIGURE.ground + 1} y2={FIGURE.ground + 1} style={{ stroke: "rgb(var(--border-strong))" }} strokeWidth="2" strokeLinecap="round" />
      {prop === "wall" && <rect x={FIGURE.width - 34} y={40} width={10} height={FIGURE.ground - 39} rx={2} style={{ fill: "rgb(var(--border-strong))" }} />}
      {/* Far side first, lighter, for depth. */}
      <Limb points={[skeleton.shoulder, skeleton.farArm.elbow, skeleton.farArm.wrist]} color="rgb(148 163 184)" width={7} opacity={0.75} />
      <Limb points={[skeleton.hip, skeleton.far.knee, skeleton.far.ankle, skeleton.far.toe]} color="rgb(148 163 184)" width={9} opacity={0.75} />
      <Limb points={[skeleton.hip, skeleton.shoulder, skeleton.neck]} color={near} width={12} />
      <Limb points={[skeleton.hip, skeleton.near.knee, skeleton.near.ankle, skeleton.near.toe]} color={near} width={9} />
      <Limb points={[skeleton.shoulder, skeleton.nearArm.elbow, skeleton.nearArm.wrist]} color={near} width={7} />
      <circle cx={skeleton.head.x} cy={skeleton.head.y} r={10} fill={near} />
    </svg>
  );
}
