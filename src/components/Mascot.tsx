import React, { useId } from "react";

export type MascotMood = "idle" | "thinking" | "talking" | "happy";

export const MASCOT_NAME = "Dash";

/**
 * Dash, the app's running-buddy mascot: a gradient teardrop with a headband, big eyes and little
 * sneakers. Animations are CSS-only and respect "reduce motion".
 */
export function Mascot({ size = 48, mood = "idle", className = "" }: { size?: number; mood?: MascotMood; className?: string }) {
  const id = useId().replace(/:/g, "");
  const bodyGradient = `dash-body-${id}`;
  const bandGradient = `dash-band-${id}`;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`dash-mascot dash-${mood} ${className}`}
      role="img"
      aria-label={`${MASCOT_NAME}, your running coach${mood === "thinking" ? ", thinking" : ""}`}
    >
      <defs>
        <linearGradient id={bodyGradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "rgb(99 102 241)" }} />
          <stop offset="100%" style={{ stopColor: "rgb(20 184 166)" }} />
        </linearGradient>
        <linearGradient id={bandGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#FB7185" />
        </linearGradient>
      </defs>
      <g className="dash-bounce">
        {/* Shadow */}
        <ellipse cx="60" cy="112" rx="26" ry="4" fill="rgb(0 0 0 / 0.15)" className="dash-shadow" />
        {/* Sneakers */}
        <g className="dash-feet">
          <path d="M34 98 q-2 9 8 10 h12 q4 0 3-5 l-2-6 z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
          <path d="M66 98 q-2 9 8 10 h12 q4 0 3-5 l-2-6 z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
          <path d="M37 104 h17 M69 104 h17" stroke={`url(#${bandGradient})`} strokeWidth="2.5" strokeLinecap="round" />
        </g>
        {/* Body */}
        <path d="M60 10 C88 32 98 56 96 74 C94 94 80 104 60 104 C40 104 26 94 24 74 C22 56 32 32 60 10 Z" fill={`url(#${bodyGradient})`} />
        <path d="M60 18 C78 34 86 50 86 62" stroke="rgb(255 255 255 / 0.35)" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Arms */}
        <path d="M27 70 q-11 4 -9 16" stroke="rgb(79 70 229)" strokeWidth="6" strokeLinecap="round" fill="none" className="dash-arm-left" />
        <path d="M93 70 q11 -6 10 -18" stroke="rgb(13 148 136)" strokeWidth="6" strokeLinecap="round" fill="none" className="dash-arm-right" />
        {/* Headband */}
        <path d="M30 50 Q60 40 90 50 L91 59 Q60 49 29 59 Z" fill={`url(#${bandGradient})`} />
        <path d="M90 52 l12 -5 l-3 9 z" fill="#FB7185" className="dash-band-tail" />
        {/* Eyes */}
        <g className="dash-eyes">
          <ellipse cx="47" cy="70" rx="7" ry="8.5" fill="#fff" />
          <ellipse cx="73" cy="70" rx="7" ry="8.5" fill="#fff" />
          <g className="dash-pupils">
            <circle cx="48" cy="71" r="4" fill="#0F172A" />
            <circle cx="74" cy="71" r="4" fill="#0F172A" />
            <circle cx="49.5" cy="69" r="1.4" fill="#fff" />
            <circle cx="75.5" cy="69" r="1.4" fill="#fff" />
          </g>
        </g>
        {/* Cheeks */}
        <ellipse cx="38" cy="82" rx="4.5" ry="2.5" fill="#FB7185" opacity="0.45" />
        <ellipse cx="82" cy="82" rx="4.5" ry="2.5" fill="#FB7185" opacity="0.45" />
        {/* Mouth */}
        {mood === "happy" ? (
          <path d="M51 82 Q60 94 69 82 Z" fill="#0F172A" />
        ) : (
          <path d="M52 83 Q60 90 68 83" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" className="dash-mouth" />
        )}
        {/* Thinking dots */}
        {mood === "thinking" && (
          <g className="dash-think" fill="rgb(148 163 184)">
            <circle cx="98" cy="30" r="3" />
            <circle cx="106" cy="20" r="4" />
            <circle cx="114" cy="8" r="5" />
          </g>
        )}
      </g>
    </svg>
  );
}
