import React from "react";
import { CompleteAnalysisReport } from "@/types/telemetry";

interface ExecutiveSummaryProps {
  report: CompleteAnalysisReport;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ report }) => {
  const { formScore, gait, symmetry, kinematics } = report;

  const meanTrunk = kinematics.trunkLeanAngles.length > 0
    ? kinematics.trunkLeanAngles.reduce((a, b) => a + b, 0) / kinematics.trunkLeanAngles.length
    : 6.0;

  return (
    <div className="space-y-6">
      {/* Executive Card */}
      <div className="bg-gradient-to-r from-card to-surface rounded-2xl p-6 border border-border shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold text-primary tracking-wider uppercase">
              Advanced Performance Telemetry Report
            </span>
            <h2 className="text-2xl font-extrabold text-slate-100 mt-1">
              Full Kinematic & Gait Efficiency Suite
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Sub-Frame Markerless AI Vision • Ground Contact & Pelvic Stability Tracking
            </p>
          </div>

          <div className="bg-surface/80 border border-border px-6 py-4 rounded-xl text-right">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Form Efficiency Score
            </div>
            <div className="text-4xl font-black text-success leading-none mt-1">
              {formScore.overallScore}
              <span className="text-sm font-normal text-slate-500"> / 100</span>
            </div>
            <div className="text-xs font-semibold text-primary mt-1">
              {formScore.category}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Cadence */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Cadence</div>
          <div className="text-2xl font-black text-slate-100 mt-1">
            {gait.cadenceSpm} <span className="text-xs text-slate-400 font-normal">spm</span>
          </div>
          <div className="text-xs font-medium text-primary mt-1">
            {gait.cadenceSpm >= 165 && gait.cadenceSpm <= 185 ? "Optimal (165-185)" : "Adjust Cadence"}
          </div>
        </div>

        {/* Ground Contact Time */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Contact Time (GCT)</div>
          <div className="text-2xl font-black text-cyan-400 mt-1">
            {gait.groundContactTimeMs} <span className="text-xs text-slate-400 font-normal">ms</span>
          </div>
          <div className="text-xs font-medium text-slate-400 mt-1">
            Duty Factor: <span className="text-slate-200 font-semibold">{gait.dutyFactorPct}%</span>
          </div>
        </div>

        {/* Vertical Oscillation */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Vertical Bounce</div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {gait.verticalOscillationCm} <span className="text-xs text-slate-400 font-normal">cm</span>
          </div>
          <div className="text-xs font-medium text-primary mt-1">Target: 6.0 – 9.0 cm</div>
        </div>

        {/* Overstride Brake Distance */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Brake Distance</div>
          <div className="text-2xl font-black text-pink-400 mt-1">
            {gait.overstrideDistanceCm} <span className="text-xs text-slate-400 font-normal">cm</span>
          </div>
          <div className="text-xs font-medium text-slate-400 mt-1">Foot-to-Hip Offset</div>
        </div>

        {/* Pelvic Drop */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Max Pelvic Drop</div>
          <div className="text-2xl font-black text-purple-400 mt-1">
            {gait.pelvicDropMaxDeg}°
          </div>
          <div className="text-xs font-medium text-success mt-1">Target: &lt; 4.5°</div>
        </div>

        {/* Limb Symmetry */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Limb Symmetry</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{symmetry.overallSymmetryScore}%</div>
          <div className="text-xs font-medium text-success mt-1">Target: &gt;90%</div>
        </div>

        {/* Avg Forward Lean */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Avg Forward Lean</div>
          <div className="text-2xl font-black text-slate-100 mt-1">{meanTrunk.toFixed(1)}°</div>
          <div className="text-xs font-medium text-primary mt-1">Target: 4° – 10°</div>
        </div>

        {/* Stride Consistency */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Stride Consistency</div>
          <div className="text-2xl font-black text-slate-100 mt-1">{symmetry.strideConsistencyScore}%</div>
          <div className="text-xs font-medium text-success mt-1">Target: &gt;85%</div>
        </div>
      </div>
    </div>
  );
};

