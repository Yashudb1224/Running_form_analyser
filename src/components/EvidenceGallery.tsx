import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Maximize2, PlayCircle, X, Camera } from "lucide-react";
import { CompleteAnalysisReport, EvidenceFrame } from "@/types/telemetry";
import { EVIDENCE_REFERENCE } from "@/lib/evidenceFrames";
import { getReferencePosition } from "@/lib/researchReferences";
import { getChartPalette } from "@/lib/chartTheme";
import { useTheme } from "./ThemeProvider";

interface EvidenceGalleryProps {
  report: CompleteAnalysisReport;
  onOpenInVideo: (time: number) => void;
}

const TIMELINE_WINDOW_SEC = 4;

const POSITION_STYLES = {
  within: "bg-success/10 text-success",
  below: "bg-warning/10 text-warning",
  above: "bg-warning/10 text-warning",
} as const;

const POSITION_TEXT = { within: "Typical", below: "Below typical", above: "Above typical" } as const;

function EvidenceCard({ evidence, onEnlarge, onOpenInVideo }: { evidence: EvidenceFrame; onEnlarge: () => void; onOpenInVideo: () => void }) {
  const reference = EVIDENCE_REFERENCE[evidence.kind];
  const position = getReferencePosition(reference, evidence.value);
  return (
    <figure className="panel flex min-w-0 flex-col overflow-hidden">
      <button type="button" onClick={onEnlarge} className="group relative block bg-[#111827]" aria-label={`Enlarge ${evidence.title} frame`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL captured in the browser */}
        <img
          src={evidence.imageDataUrl}
          alt={`${evidence.title} at ${evidence.timestamp.toFixed(2)} seconds with the measured angle drawn on the video frame`}
          width={evidence.width}
          height={evidence.height}
          className="aspect-video w-full object-contain"
        />
        <span className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>
      <figcaption className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-ink">{evidence.title}</p>
          <span className={`status-pill ${POSITION_STYLES[position]}`}>{POSITION_TEXT[position]}</span>
        </div>
        <p className="mt-1 text-xs text-body">
          <span className="font-semibold text-ink">{reference.label}: {evidence.value.toFixed(1)}°</span>
          <span className="text-muted"> · typical {reference.minimum}–{reference.maximum}°</span>
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span className="text-[11px] tabular-nums text-muted">{evidence.timestamp.toFixed(2)} s in video</span>
          <button type="button" onClick={onOpenInVideo} className="quiet-button min-h-7 px-2 text-[11px]">
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" /> Open in video
          </button>
        </div>
      </figcaption>
    </figure>
  );
}

function Lightbox({ evidence, onClose }: { evidence: EvidenceFrame; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={evidence.title} onClick={onClose}>
      <div className="relative max-h-full w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL captured in the browser */}
        <img src={evidence.imageDataUrl} alt={evidence.title} className="max-h-[85vh] w-full rounded-lg object-contain" />
        <button type="button" onClick={onClose} className="absolute right-2 top-2 rounded-md bg-black/70 p-2 text-white hover:bg-black" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Ankle height over a few seconds with each detected stance event marked: the evidence behind cadence. */
function StepTimeline({ report }: { report: CompleteAnalysisReport }) {
  const palette = getChartPalette(useTheme().resolved);
  const { frames, kinematics, gait } = report;
  const data = useMemo(() => {
    const allY = [...kinematics.leftAnkleY, ...kinematics.rightAnkleY].filter((value): value is number => value !== null);
    if (!allY.length || !gait.events.length) return null;
    const ground = Math.max(...allY);
    const torsos = kinematics.torsoHeightPx.filter((value): value is number => value !== null).sort((a, b) => a - b);
    const torso = torsos[Math.floor(torsos.length / 2)] || 1;
    const height = (y: number | null) => (y === null ? null : Math.round(((ground - y) / torso) * 1000) / 10);
    const start = Math.max(0, frames[gait.events[0].stanceFrame].timestamp - 0.3);
    const end = start + TIMELINE_WINDOW_SEC;
    const series = frames
      .map((frame, index) => ({ time: Number(frame.timestamp.toFixed(3)), left: height(kinematics.leftAnkleY[index]), right: height(kinematics.rightAnkleY[index]) }))
      .filter((row) => row.time >= start && row.time <= end);
    const marks = (leg: "left" | "right") => gait.events
      .filter((event) => event.side === leg && event.stanceTime >= start && event.stanceTime <= end)
      .map((event) => ({ time: Number(event.stanceTime.toFixed(3)), [leg]: height(event.leg === "left" ? kinematics.leftAnkleY[event.stanceFrame] : kinematics.rightAnkleY[event.stanceFrame]) }));
    return { series, leftMarks: marks("left"), rightMarks: marks("right"), start, end };
  }, [frames, kinematics, gait]);

  if (!data) return null;
  const stride = gait.medianStrideSec;

  return (
    <div className="chart-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">Stride timing behind cadence and consistency</h4>
        <p className="text-xs text-muted">First {TIMELINE_WINDOW_SEC} s of detected steps</p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Ankle height above the ground line. Each dot is a detected stance (foot on the ground); the time from any dot to the dot after
        next is one stride (two steps).
        {stride !== null && gait.cadenceSpm.value !== null && (
          <> Median stride {stride.toFixed(3)} s → 120 ÷ {stride.toFixed(3)} = <span className="font-semibold text-ink">{gait.cadenceSpm.value.toFixed(1)} steps/min</span>, from {gait.strideCount} strides.</>
        )}
      </p>
      <div className="mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis dataKey="time" type="number" domain={[data.start, data.end]} allowDuplicatedCategory={false} stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 11 }} tickFormatter={(value: number) => `${value.toFixed(1)}s`} />
            <YAxis stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 11 }} width={44} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: palette.tooltipBackground, border: `1px solid ${palette.tooltipBorder}`, borderRadius: 8, color: palette.tooltipText, fontSize: 12 }}
              labelFormatter={(value: number) => `${Number(value).toFixed(2)} s`}
              formatter={(value: number, name: string) => [`${value}% torso`, name]}
            />
            <Legend verticalAlign="top" height={26} iconType="circle" wrapperStyle={{ fontSize: 11, color: palette.axis }} />
            <Line data={data.series} type="monotone" dataKey="left" name="Left ankle" stroke={palette.left} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
            <Line data={data.series} type="monotone" dataKey="right" name="Right ankle" stroke={palette.right} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
            <Scatter data={data.leftMarks} dataKey="left" name="Left stance" fill={palette.left} legendType="none" isAnimationActive={false} />
            <Scatter data={data.rightMarks} dataKey="right" name="Right stance" fill={palette.right} legendType="none" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({ report, onOpenInVideo }) => {
  const [enlarged, setEnlarged] = useState<EvidenceFrame | null>(null);
  const { evidence } = report;

  return (
    <section aria-labelledby="evidence-heading" className="space-y-4">
      <div>
        <h3 id="evidence-heading" className="section-title">Evidence from your video</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          The frames behind the scores, with each angle drawn exactly as it was measured. For each leg, the frame closest to that leg&apos;s
          average is shown. Use &quot;Open in video&quot; to step through every foot strike.
        </p>
      </div>
      {evidence.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {evidence.map((item) => (
            <EvidenceCard key={item.id} evidence={item} onEnlarge={() => setEnlarged(item)} onOpenInVideo={() => onOpenInVideo(item.timestamp)} />
          ))}
        </div>
      ) : (
        <div className="panel flex items-center gap-3 p-4 text-xs text-muted">
          <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
          No evidence frames could be captured: no foot strikes, midstance or trunk positions were measured in this video.
        </div>
      )}
      <StepTimeline report={report} />
      {enlarged && <Lightbox evidence={enlarged} onClose={() => setEnlarged(null)} />}
    </section>
  );
};
