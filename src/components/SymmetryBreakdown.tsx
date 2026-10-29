import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { CompleteAnalysisReport, MetricResult } from "@/types/telemetry";
import { MetricValue } from "./MetricValue";
import { getChartPalette } from "@/lib/chartTheme";
import { useTheme } from "./ThemeProvider";

interface SymmetryBreakdownProps {
  report: CompleteAnalysisReport;
}


function formatValue(metric: MetricResult): string {
  if (metric.value === null) return "—";
  return `${Number.isInteger(metric.value) ? metric.value : metric.value.toFixed(metric.unit === "s" ? 3 : 1)} ${metric.unit}`;
}

export const SymmetryBreakdown: React.FC<SymmetryBreakdownProps> = ({ report }) => {
  const { symmetry, gait } = report;
  const palette = getChartPalette(useTheme().resolved);
  const { left: LEFT_COLOR, right: RIGHT_COLOR } = palette;
  const legRows: [string, MetricResult, MetricResult, MetricResult | null][] = [
    ["Knee flexion at midstance", gait.left.midstanceKneeFlexionDeg, gait.right.midstanceKneeFlexionDeg, symmetry.kneeFlexionSymmetryIndexPct],
    ["Step time", gait.left.stepTimeSec, gait.right.stepTimeSec, symmetry.stepTimeSymmetryIndexPct],
    ["Shank angle at foot strike", gait.left.footStrikeShankAngleDeg, gait.right.footStrikeShankAngleDeg, symmetry.shankAngleDifferenceDeg],
  ];
  const barData = [
    { measure: "Midstance knee flexion", left: gait.left.midstanceKneeFlexionDeg.value, right: gait.right.midstanceKneeFlexionDeg.value },
    { measure: "Foot-strike shank angle", left: gait.left.footStrikeShankAngleDeg.value, right: gait.right.footStrikeShankAngleDeg.value },
  ];
  const metrics = [
    ["Cadence", gait.cadenceSpm],
    ["Mean step interval", gait.avgStepTimeSec],
    ["Step-time variation", gait.stepTimeCvPct],
    ["Foot landing ahead of hip", gait.ankleAheadOfHipTorsoPct],
    ["Vertical oscillation", gait.verticalOscillationTorsoPct],
    ["Hip-line image tilt (max)", gait.maxHipLineImageTiltDeg],
    ["Elbow-angle similarity", symmetry.elbowAngleSimilarityPct],
  ] as const;
  const hasBars = barData.some((row) => row.left !== null || row.right !== null);

  return (
    <section aria-labelledby="gait-heading" className="space-y-4">
      <div>
        <p className="eyebrow">Bilateral comparison</p>
        <h3 id="gait-heading" className="mt-1 text-lg font-semibold text-ink">Gait and symmetry</h3>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead className="bg-card text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Per-leg measure</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: LEFT_COLOR }} />Left</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: RIGHT_COLOR }} />Right</th>
                <th scope="col" className="px-4 py-3 font-semibold">Symmetry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {legRows.map(([label, left, right, comparison]) => (
                <tr key={label}>
                  <th scope="row" className="px-4 py-3 font-medium text-body">{label}</th>
                  <td className="px-4 py-3 font-medium text-ink">{formatValue(left)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{formatValue(right)}</td>
                  <td className="px-4 py-3">
                    {comparison === null || comparison.value === null ? <span className="text-muted">—</span> : (
                      <span className={`status-pill ${comparison.unit === "%" && comparison.value > 10 ? "bg-warning/10 text-warning" : "bg-subtle text-body"}`}>
                        {comparison.unit === "%" ? `SI ${comparison.value.toFixed(1)}%` : `Δ ${comparison.value.toFixed(1)}°`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-4 py-3 font-medium text-body">Stance events detected</th>
                <td className="px-4 py-3 font-medium text-ink">{gait.left.events}</td>
                <td className="px-4 py-3 font-medium text-ink">{gait.right.events}</td>
                <td className="px-4 py-3 text-muted">{gait.stepCount} steps used</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-border bg-card px-4 py-2.5 text-[11px] leading-relaxed text-muted">
          Symmetry index (SI) = |left − right| ÷ mean of both sides. Values under 10% are commonly treated as practically symmetric in gait research.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="chart-panel">
          <h4 className="text-sm font-semibold text-ink">Left vs. right</h4>
          <div className="mt-3 h-60 w-full">
            {hasBars ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                  <CartesianGrid stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="measure" stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: palette.grid }} />
                  <YAxis unit="°" width={44} stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: palette.cursor }} contentStyle={{ backgroundColor: palette.tooltipBackground, border: `1px solid ${palette.tooltipBorder}`, borderRadius: 8, color: palette.tooltipText, fontSize: 12 }} formatter={(value: number, name: string) => [`${value.toFixed(1)}°`, name]} />
                  <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 11, color: palette.axis }} />
                  <Bar dataKey="left" name="Left" fill={LEFT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                  <Bar dataKey="right" name="Right" fill={RIGHT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-xs text-muted">
                No stance events with visible knees and ankles were detected.
              </div>
            )}
          </div>
        </div>

        <div className="chart-panel">
          <h4 className="text-sm font-semibold text-ink">Gait metrics</h4>
          <dl className="mt-2 divide-y divide-border">
            {metrics.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-2.5">
                <dt className="text-xs text-body">{label}</dt>
                <dd className="text-right text-xs font-medium text-ink">
                  <MetricValue metric={value} digits={value.unit === "s" ? 3 : 1} className="block" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};
