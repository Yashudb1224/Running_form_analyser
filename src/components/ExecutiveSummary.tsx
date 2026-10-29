import React from "react";
import { CompleteAnalysisReport } from "@/types/telemetry";
import { MetricValue } from "./MetricValue";
import { getMetricComparisons, MetricComparison } from "@/lib/metricComparison";

interface ExecutiveSummaryProps {
  report: CompleteAnalysisReport;
}

function MetricComparisonCard({ comparison }: { comparison: MetricComparison }) {
  const { scale } = comparison;
  const observedPosition = scale
    ? Math.min(100, Math.max(0, ((scale.observed - scale.minimum) / (scale.maximum - scale.minimum)) * 100))
    : null;
  const bandLeft = scale?.bandMinimum === undefined
    ? null
    : Math.min(100, Math.max(0, ((scale.bandMinimum - scale.minimum) / (scale.maximum - scale.minimum)) * 100));
  const bandWidth = scale?.bandMinimum === undefined || scale.bandMaximum === undefined
    ? null
    : Math.min(100, Math.max(0, ((scale.bandMaximum - scale.bandMinimum) / (scale.maximum - scale.minimum)) * 100));

  return (
    <article className="min-w-0 border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-slate-800">{comparison.label}</h3>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="min-w-0">
          <p className="metric-label">Observed</p>
          <p className="metric-number mt-1 truncate text-xl">
            <MetricValue metric={comparison.observed} digits={1} showProvenance={false} />
          </p>
          <p className="mt-1 text-[10px] font-medium capitalize text-slate-500">
            {comparison.observed.status.replace(/-/g, " ")}
          </p>
        </div>
        <div className="min-w-0">
          <p className="metric-label">App reference</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-slate-800">{comparison.reference}</p>
          <p className="mt-1 text-[10px] font-medium leading-snug text-slate-500">{comparison.position}</p>
        </div>
      </div>
      {observedPosition !== null && (
        <div
          className="relative mt-4 h-2 bg-slate-200"
          role="img"
          aria-label={`${comparison.label}: ${comparison.position}; reference ${comparison.reference}`}
        >
          {bandLeft !== null && bandWidth !== null && (
            <span className="absolute inset-y-0 bg-primary/60" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
          )}
          <span
            className="absolute -top-1.5 h-5 w-0.5 bg-slate-900"
            style={{ left: `${observedPosition}%` }}
          />
        </div>
      )}
      {scale && (
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
          <span>{scale.minimum}</span>
          <span>{scale.maximum}</span>
        </div>
      )}
    </article>
  );
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ report }) => {
  const comparisons = getMetricComparisons(report);

  return (
    <section aria-label="Metric comparison" className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="border-l-2 border-primary pl-4">
          <div>
            <p className="metric-label">Experimental composite</p>
            <p className="metric-number mt-0.5 text-3xl">
              {report.formScore.overallScore.value === null ? "—" : report.formScore.overallScore.value}
              <span className="ml-1 text-sm font-medium text-slate-500">/ 100</span>
            </p>
          </div>
        </div>
        <p className="eyebrow">Metric comparisons</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {comparisons.map((comparison) => (
          <MetricComparisonCard key={comparison.label} comparison={comparison} />
        ))}
      </div>
    </section>
  );
};
