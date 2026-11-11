import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { History, Loader2, Trash2 } from "lucide-react";
import { AnalysisRecord, deleteAnalysis, listAnalyses } from "@/lib/analysisRecord";
import { getSupabase } from "@/lib/supabaseClient";
import { getChartPalette } from "@/lib/chartTheme";
import { useTheme } from "./ThemeProvider";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatValue(value: number | null, unit: string, digits = 1): string {
  return value === null || value === undefined ? "—" : `${Number(value).toFixed(digits)}${unit}`;
}

export function AnalysisHistory({ refreshKey }: { refreshKey: number }) {
  const palette = getChartPalette(useTheme().resolved);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      setRecords(await listAnalyses(supabase));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const remove = async (record: AnalysisRecord) => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (!window.confirm(`Delete the analysis of "${record.video_name}" from ${formatDate(record.created_at)}? This cannot be undone.`)) return;
    setDeletingId(record.id);
    try {
      await deleteAnalysis(supabase, record.id);
      setRecords((previous) => previous.filter((item) => item.id !== record.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this analysis.");
    } finally {
      setDeletingId(null);
    }
  };

  const trend = useMemo(
    () => [...records]
      .reverse()
      .filter((record) => record.overall_score !== null)
      .map((record) => ({
        date: new Date(record.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        score: record.overall_score,
        cadence: record.cadence_spm === null ? null : Math.round(Number(record.cadence_spm)),
      })),
    [records]
  );

  return (
    <section aria-labelledby="history-heading" className="mx-auto mb-12 max-w-6xl space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-secondary" aria-hidden="true" />
        <h2 id="history-heading" className="section-title">Your progress</h2>
      </div>

      {loading && (
        <div className="panel flex items-center gap-2 p-5 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your analyses…
        </div>
      )}
      {error && <p role="alert" className="panel p-4 text-sm text-danger">{error}</p>}

      {!loading && !error && records.length === 0 && (
        <p className="panel p-5 text-sm text-muted">No saved analyses yet. Analyse a video above and it will appear here.</p>
      )}

      {!loading && records.length > 0 && (
        <>
          {trend.length >= 2 && (
            <div className="chart-panel">
              <h3 className="text-sm font-semibold text-ink">Form score over time</h3>
              <div className="mt-3 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 16, left: -16, bottom: 4 }}>
                    <CartesianGrid stroke={palette.grid} vertical={false} />
                    <XAxis dataKey="date" stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 11 }} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 11 }} width={44} />
                    <Tooltip contentStyle={{ backgroundColor: palette.tooltipBackground, border: `1px solid ${palette.tooltipBorder}`, borderRadius: 8, color: palette.tooltipText, fontSize: 12 }} />
                    <Line type="monotone" dataKey="score" name="Form score" stroke={palette.left} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-xs">
                <thead className="bg-card text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Video</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Score</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Cadence</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Shin angle</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Knee flexion</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Trunk lean</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Stride var.</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-body">{formatDate(record.created_at)}</td>
                      <td className="max-w-[14rem] truncate px-4 py-3 font-medium text-ink" title={record.video_name}>{record.video_name}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{record.overall_score ?? "—"}</td>
                      <td className="px-4 py-3 text-body">{formatValue(record.cadence_spm, "", 0)}</td>
                      <td className="px-4 py-3 text-body">{formatValue(record.shank_angle_deg, "°")}</td>
                      <td className="px-4 py-3 text-body">{formatValue(record.knee_flexion_deg, "°")}</td>
                      <td className="px-4 py-3 text-body">{formatValue(record.trunk_lean_deg, "°")}</td>
                      <td className="px-4 py-3 text-body">{formatValue(record.stride_cv_pct, "%")}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void remove(record)}
                          disabled={deletingId === record.id}
                          className="quiet-button min-h-7 px-2 text-muted hover:text-danger"
                          aria-label={`Delete analysis of ${record.video_name}`}
                        >
                          {deletingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
