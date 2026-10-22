import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { CompleteAnalysisReport } from "@/types/telemetry";

interface SymmetryBreakdownProps {
  report: CompleteAnalysisReport;
}

export const SymmetryBreakdown: React.FC<SymmetryBreakdownProps> = ({ report }) => {
  const { symmetry, gait } = report;

  const barData = [
    {
      limb: "Left Leg",
      maxFlexion: symmetry.kneeFlexionMaxLeft,
      minFlexion: symmetry.kneeFlexionMinLeft
    },
    {
      limb: "Right Leg",
      maxFlexion: symmetry.kneeFlexionMaxRight,
      minFlexion: symmetry.kneeFlexionMinRight
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">
          Bilateral Gait & Advanced Symmetry Breakdown
        </h3>
        <p className="text-xs text-slate-400">
          Left vs Right limb mechanical balance, arm drive symmetry, and ground contact timing
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
          <h4 className="text-sm font-bold text-slate-200 mb-4">
            Knee Flexion Range (Left vs Right)
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
                <XAxis dataKey="limb" stroke="#64748B" />
                <YAxis stroke="#64748B" domain={[0, 180]} />
                <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
                <Legend />
                <Bar dataKey="maxFlexion" name="Max Swing Flexion (°)" fill="#00E5FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minFlexion" name="Min Impact Bend (°)" fill="#FF00AA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Telemetry Summary */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-200 mb-4">
              Advanced Gait Telemetry Details
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-slate-400">Ground Contact Time (GCT):</span>
                <span className="font-mono font-semibold text-cyan-400">{gait.groundContactTimeMs} ms / step</span>
              </li>
              <li className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-slate-400">Vertical Bounce Oscillation:</span>
                <span className="font-mono font-semibold text-amber-400">{gait.verticalOscillationCm} cm</span>
              </li>
              <li className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-slate-400">Landing Overstride Distance:</span>
                <span className="font-mono font-semibold text-pink-400">{gait.overstrideDistanceCm} cm ahead of hip</span>
              </li>
              <li className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-slate-400">Arm Swing Symmetry:</span>
                <span className="font-mono font-semibold text-emerald-400">{symmetry.armSwingSymmetryPct}%</span>
              </li>
              <li className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-slate-400">Knee Asymmetry Index:</span>
                <span className="font-mono font-semibold text-slate-100">{symmetry.kneeMinSiPct}% (Target &lt;5%)</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-300">
            <strong>Coach's Tip:</strong> Maintain quick, light foot strikes centered under your hips. Integrate glute strengthening and core stability exercises to minimize lateral pelvic drop and overstride braking forces.
          </div>
        </div>
      </div>
    </div>
  );
};

