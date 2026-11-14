import React from "react";
import Image from "next/image";

export type MascotMood = "idle" | "thinking" | "talking" | "happy";

export const MASCOT_NAME = "Dash";

/** Full-body cutout (498 × 586) and a square head crop for small avatars, both in /public. */
const FULL = { src: "/dash.png", width: 498, height: 586 } as const;
const HEAD = { src: "/dash-head.png", width: 160, height: 160 } as const;

/**
 * Dash, the cheetah running buddy. Small sizes show just the head; larger ones the whole runner.
 * The mood sets a gentle animation: bobbing when idle, a curious tilt while thinking, a bounce while
 * talking and a hop when happy.
 */
export function Mascot({
  size = 48,
  mood = "idle",
  variant = "auto",
  className = "",
}: {
  size?: number;
  mood?: MascotMood;
  variant?: "auto" | "full" | "head";
  className?: string;
}) {
  const art = variant === "full" || (variant === "auto" && size >= 72) ? FULL : HEAD;
  const height = Math.round((size * art.height) / art.width);
  return (
    <span className={`dash-mascot dash-${mood} inline-block shrink-0 ${className}`} style={{ width: size, height }} aria-hidden="true">
      <Image src={art.src} alt="" width={art.width} height={art.height} className="h-full w-full select-none object-contain" draggable={false} priority={art === HEAD} />
    </span>
  );
}
