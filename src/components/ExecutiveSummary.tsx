import React from "react";
import { CompleteAnalysisReport, MetricResult } from "@/types/telemetry";
import { MetricValue } from "./MetricValue";

interface ExecutiveSummaryProps {
  report: CompleteAnalysisReport;
}

function averageAbsolute(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + Math.abs(value), 0) / valid.length : null;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ report }) => {
  const { formScore, gait, symmetry, kinematics } = report;
  const meanTrunk = averageAbsolute(kinematics.trunkImagePlaneAngles);
  const cards: { label: string; value: MetricResult; color: string }[] = [
    { label: "Estimated Cadence", value: gait.cadenceSpm, color: "text-primary" },
    { label: "Ground Contact Time", value: gait.groundContactTimeMs, color: "text-cyan-400" },
    { label: "Pelvis Vertical Range", value: gait.pelvisVerticalRangeBodyHeightPct, color: "text-amber-400" },
    { label: "Ankle–Hip Image Offset", value: gait.ankleHipOffsetBodyHeightPct, color: "text-pink-400" },
    { label: "Hip-Line Image Tilt", value: gait.maxHipLineImageTiltDeg, color: "text-purple-400" },
    { label: "Knee-Angle Asymmetry", value: symmetry.kneeAngleAsymmetryPct, color: "text-emerald-400" },
    { label: "Mean Trunk Image Angle", value: {
      value: meanTrunk,
      status: meanTrunk === null ? "unavailable" : "landmark-derived",
      unit: "deg",
      explanation: "Mean absolute angle relative to the image vertical; not a calibrated forward lean measurement.",
    }, color: "text-slate-100" },
    { label: "Stride Consistency Index", value: symmetry.strideConsistencyScore, color: "text-slate-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-card to-surface rounded-2xl p-6 border border-border shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold text-primary tracking-wider uppercase">Exploratory Running Form Telemetry</span>
            <h2 className="text-2xl font-extrabold text-slate-100 mt-1">Landmark-Derived Motion Summary</h2>
            <p className="text-xs text-slate-400 mt-1">2D image-space estimates; camera geometry is uncalibrated.</p>
          </div>
          <div className="bg-surface/80 border border-border px-6 py-4 rounded-xl text-right">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Experimental Rule-Based Index</div>
            <div className="text-4xl font-black text-success leading-none mt-1">
              {formScore.overallScore.value === null ? "—" : formScore.overallScore.value}
              <span className="text-sm font-normal text-slate-500"> / 100</span>
            </div>
            <div className="text-xs font-semibold text-primary mt-1">{formScore.category}</div>
            <p className="text-[10px] text-slate-500 mt-1">{formScore.overallScore.status.replaceAll("-", " ")}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-5 border-t border-border pt-4">
          This score uses demonstration rules, not a validated sports-science assessment. It is not medical advice or an injury-risk prediction.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase">{label}</div>
            <div className={`text-xl font-black mt-2 ${color}`}><MetricValue metric={value} digits={1} /></div>
            <div className="text-[10px] font-medium text-slate-500 mt-2">{value.explanation}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
