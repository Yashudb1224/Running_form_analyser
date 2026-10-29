import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { CompleteAnalysisReport } from "@/types/telemetry";
import { MetricValue } from "./MetricValue";

interface SymmetryBreakdownProps {
  report: CompleteAnalysisReport;
}

export const SymmetryBreakdown: React.FC<SymmetryBreakdownProps> = ({ report }) => {
  const { symmetry, gait } = report;
  const barData = [
    { limb: "Left Leg", maximumAngle: symmetry.kneeAngleMaxLeftDeg.value, minimumAngle: symmetry.kneeAngleMinLeftDeg.value },
    { limb: "Right Leg", maximumAngle: symmetry.kneeAngleMaxRightDeg.value, minimumAngle: symmetry.kneeAngleMinRightDeg.value },
  ];
  const metrics = [
    ["Cadence estimate", gait.cadenceSpm],
    ["Mean step interval", gait.avgStepTimeSec],
    ["Ground contact time", gait.groundContactTimeMs],
    ["Flight time", gait.flightTimeMs],
    ["Pelvis vertical range", gait.pelvisVerticalRangeBodyHeightPct],
    ["Ankle–hip image offset", gait.ankleHipOffsetBodyHeightPct],
    ["Hip-line image tilt", gait.maxHipLineImageTiltDeg],
    ["Paired knee-angle asymmetry", symmetry.kneeAngleAsymmetryPct],
    ["Elbow-angle comparison", symmetry.elbowAngleSimilarityPct],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">Gait Events & Bilateral Motion</h3>
        <p className="text-xs text-slate-400">All angles are 2D image projections. Provenance and unavailable values are shown alongside each metric.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
          <h4 className="text-sm font-bold text-slate-200 mb-4">Internal Knee Angle Range (Left vs Right)</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
                <XAxis dataKey="limb" stroke="#64748B" />
                <YAxis stroke="#64748B" domain={[0, 180]} />
                <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
                <Legend />
                <Bar dataKey="maximumAngle" name="Maximum internal angle (°)" fill="#00E5FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minimumAngle" name="Minimum internal angle (°)" fill="#FF00AA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-3">A straighter configuration approaches 180°. Maximum internal angle is not maximum flexion; unavailable angles remain blank.</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
          <h4 className="text-sm font-bold text-slate-200 mb-4">Metric Values & Provenance</h4>
          <ul className="space-y-3">
            {metrics.map(([label, value]) => (
              <li key={label} className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 text-xs">
                <span className="text-slate-400">{label}</span>
                <MetricValue metric={value} className="text-right font-mono font-semibold text-slate-100" />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-400">
        This exploratory analysis is not calibrated to physical distance, validated against force plates, or intended for diagnosis. Ground-contact and flight duration are unavailable because the current video method does not directly detect contact.
      </p>
    </div>
  );
};
