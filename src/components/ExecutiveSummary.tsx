import React from "react";
import { Info } from "lucide-react";
import { CompleteAnalysisReport, MetricResult } from "@/types/telemetry";
import { MetricValue } from "./MetricValue";
import { getMetricComparisons, MetricComparison } from "@/lib/metricComparison";
import { BASIS_LABELS, MIN_COMPONENT_SCORE } from "@/lib/researchReferences";

interface ExecutiveSummaryProps {
  report: CompleteAnalysisReport;
}

const POSITION_STYLES: Record<MetricComparison["position"], string> = {
  within: "bg-success/10 text-success",
  below: "bg-warning/10 text-warning",
  above: "bg-warning/10 text-warning",
  "observed-only": "bg-subtle text-body",
  unavailable: "bg-subtle text-muted",
};

/** Theme-aware score color as a CSS value. */
function scoreColor(score: number): string {
  if (score >= 85) return "rgb(var(--success))";
  if (score >= 65) return "rgb(var(--warning))";
  return "rgb(var(--danger))";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ScoreRing({ score }: { score: number | null }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg viewBox="0 0 128 128" className="h-36 w-36 shrink-0" role="img" aria-label={score === null ? "Overall score unavailable" : `Overall score ${score} out of 100`}>
      <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="10" style={{ stroke: "rgb(var(--subtle))" }} />
      {score !== null && (
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform="rotate(-90 64 64)"
          style={{ stroke: scoreColor(score) }}
        />
      )}
      <text x="64" y="62" textAnchor="middle" style={{ fontSize: 32, fontWeight: 600, fill: "rgb(var(--ink))" }}>
        {score === null ? "—" : score}
      </text>
      <text x="64" y="82" textAnchor="middle" style={{ fontSize: 11, fill: "rgb(var(--muted))" }}>
        out of 100
      </text>
    </svg>
  );
}

const COMPONENT_LABELS: Record<string, string> = {
  "Cadence": "Cadence",
  "Shank angle at foot strike": "Foot strike",
  "Knee flexion at midstance": "Knee flexion",
  "Forward trunk lean": "Trunk lean",
  "Left/right symmetry": "Symmetry",
  "Stride-time variation": "Consistency",
};

const COMPONENT_STATUS: Record<string, { below: string; above: string }> = {
  "Cadence": { below: "Fewer steps per minute than typical", above: "More steps per minute than typical" },
  "Shank angle at foot strike": { below: "Foot lands behind the knee", above: "Foot lands ahead of the knee (overstriding)" },
  "Knee flexion at midstance": { below: "Knee stays stiffer than typical", above: "Knee bends more than typical" },
  "Forward trunk lean": { below: "More upright than typical", above: "Leaning further forward than typical" },
  "Left/right symmetry": { below: "", above: "Left and right legs differ more than typical" },
  "Stride-time variation": { below: "", above: "Stride timing is less even than typical" },
};

function componentStatus(comparison: MetricComparison): string {
  if (comparison.position === "within") return "In the typical range";
  if (comparison.position === "below" || comparison.position === "above") {
    return COMPONENT_STATUS[comparison.label]?.[comparison.position] ?? comparison.positionText;
  }
  return "Not measured in this video";
}

function ComponentRow({ comparison }: { comparison: MetricComparison }) {
  const score = comparison.score;
  const { observed, reference } = comparison;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-semibold text-ink">{COMPONENT_LABELS[comparison.label] ?? comparison.label}</span>
        <span className="font-semibold text-ink">{score?.value == null ? "n/a" : score.value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
        {score?.value != null && (
          <div className="h-full rounded-full" style={{ width: `${score.value}%`, backgroundColor: scoreColor(score.value) }} />
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {observed.value !== null && reference ? (
          <>
            <span className="font-medium text-body">{formatNumber(observed.value)} {observed.unit}</span>
            {" · typical "}{reference.minimum}–{reference.maximum} {reference.unit}
            {" · "}{componentStatus(comparison)}
          </>
        ) : componentStatus(comparison)}
      </p>
    </li>
  );
}

function RangeBar({ comparison }: { comparison: MetricComparison }) {
  const { reference, observed } = comparison;
  if (!reference) return null;
  const span = reference.scaleMaximum - reference.scaleMinimum;
  const toPercent = (value: number) => Math.min(100, Math.max(0, ((value - reference.scaleMinimum) / span) * 100));
  const bandLeft = toPercent(reference.minimum);
  const bandWidth = toPercent(reference.maximum) - bandLeft;
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-subtle" role="img" aria-label={`Reference ${comparison.referenceText}; ${comparison.positionText}`}>
        <span className="absolute inset-y-0 rounded-full bg-success/30" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
        {observed.value !== null && (
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow"
            style={{ left: `${toPercent(observed.value)}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>{reference.scaleMinimum}</span>
        <span className="font-medium text-success">{comparison.referenceText}</span>
        <span>{reference.scaleMaximum}</span>
      </div>
    </div>
  );
}

function MetricComparisonCard({ comparison }: { comparison: MetricComparison }) {
  return (
    <article className="panel flex min-w-0 flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{comparison.label}</h3>
        <span className={`status-pill ${POSITION_STYLES[comparison.position]}`}>{comparison.positionText}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        <MetricValue metric={comparison.observed} digits={1} showProvenance={false} />
      </p>
      {comparison.reference ? <RangeBar comparison={comparison} /> : (
        <p className="mt-4 text-[11px] font-medium text-muted">{comparison.referenceText}</p>
      )}
      <p className="mt-3 flex-1 text-xs leading-relaxed text-body">{comparison.guidance}</p>
      {comparison.reference && (
        <p className="mt-3 border-t border-border pt-2.5 text-[10px] leading-relaxed text-muted">
          {BASIS_LABELS[comparison.reference.basis]} · {comparison.reference.citations.map((citation) => citation.short).join("; ")}
        </p>
      )}
    </article>
  );
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ report }) => {
  const comparisons = getMetricComparisons(report);
  const scored = comparisons.filter((comparison): comparison is MetricComparison & { score: MetricResult } => comparison.score !== null);
  const { formScore } = report;

  return (
    <section aria-label="Form summary" className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="panel flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
          <ScoreRing score={formScore.overallScore.value} />
          <div className="min-w-0">
            <p className="eyebrow">Overall form score</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">{formScore.category}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {formScore.overallScore.value === null
                ? formScore.overallScore.explanation
                : "A weighted average of the five component scores. It's a screening summary, not a clinical assessment."}
            </p>
            {formScore.observations.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {formScore.observations.slice(0, 3).map((observation) => (
                  <li key={observation} className="flex gap-2 text-xs leading-relaxed text-body">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" aria-hidden="true" />
                    {observation}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="panel p-5 sm:p-6">
          <p className="eyebrow">Component scores</p>
          <p className="mt-2 flex gap-2 rounded-lg bg-subtle px-3 py-2 text-[11px] leading-relaxed text-body">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden="true" />
            <span>
              Each measure scores <strong className="font-semibold text-ink">100</strong> when it is inside the typical range
              reported in research, and loses points the further outside it is (lowest {MIN_COMPONENT_SCORE}).
            </span>
          </p>
          <ul className="mt-4 space-y-4">
            {scored.map((comparison) => <ComponentRow key={comparison.label} comparison={comparison} />)}
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="section-title">Measurements vs. research reference ranges</h3>
          <p className="text-xs text-muted">Green band = typical range</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {comparisons.map((comparison) => (
            <MetricComparisonCard key={comparison.label} comparison={comparison} />
          ))}
        </div>
      </div>
    </section>
  );
};
