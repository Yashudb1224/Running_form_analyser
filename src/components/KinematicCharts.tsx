import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { CompleteAnalysisReport } from "@/types/telemetry";

interface KinematicChartsProps {
  report: CompleteAnalysisReport;
}

export const KinematicCharts: React.FC<KinematicChartsProps> = ({ report }) => {
  const { kinematics, frames, fps } = report;

  // Prepare chart dataset
  const chartData = kinematics.leftKneeAngles.map((leftKnee, idx) => {
    const timestamp = frames[idx] ? frames[idx].timestamp : idx / (fps || 30);
    return {
      time: parseFloat(timestamp.toFixed(2)),
      leftKnee: Math.round(leftKnee),
      rightKnee: Math.round(kinematics.rightKneeAngles[idx] || 0),
      leftHip: Math.round(kinematics.leftHipAngles[idx] || 0),
      rightHip: Math.round(kinematics.rightHipAngles[idx] || 0),
      trunkLean: parseFloat((kinematics.trunkLeanAngles[idx] || 0).toFixed(1)),
      pelvicTilt: parseFloat((kinematics.pelvicTiltAngles?.[idx] || 0).toFixed(1)),
      leftElbow: Math.round(kinematics.leftElbowAngles?.[idx] || 0),
      rightElbow: Math.round(kinematics.rightElbowAngles?.[idx] || 0)
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">
          Time-Series Kinematic Charts
        </h3>
        <p className="text-xs text-slate-400">
          Continuous joint angle trajectory tracking extracted frame-by-frame
        </p>
      </div>

      {/* 1. Knee Flexion Chart */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
        <h4 className="text-sm font-bold text-slate-200 mb-4">
          1. Knee Flexion & Extension Cycles (Degrees)
        </h4>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 12 }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[0, 180]} label={{ value: "Angle (°)", angle: -90, position: "insideLeft" }} />
              <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
              <Legend />
              <Line type="monotone" dataKey="leftKnee" name="Left Knee (°)" stroke="#00E5FF" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="rightKnee" name="Right Knee (°)" stroke="#FF00AA" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
          <strong>Graph Explanation:</strong><br />
          • <strong>Peaks (high points ~140°–160°):</strong> Show maximum knee bend during swing phase.<br />
          • <strong>Valleys (low points ~15°–35°):</strong> Show leg extension during foot contact stance phase.<br />
          • <strong>Pattern Overlap:</strong> Smooth overlap between Left (Cyan) and Right (Pink) lines indicates consistent rhythm.
        </div>
      </div>

      {/* 2. Hip Drive & Trunk Lean Chart */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
        <h4 className="text-sm font-bold text-slate-200 mb-4">
          2. Hip Drive & Trunk Forward Lean Angle (Degrees)
        </h4>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 12 }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[-10, 180]} />
              <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
              <Legend />
              <Line type="monotone" dataKey="leftHip" name="Left Hip (°)" stroke="#00FF66" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rightHip" name="Right Hip (°)" stroke="#FFD700" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="trunkLean" name="Trunk Forward Lean (°)" stroke="#F8FAFC" strokeDasharray="5 5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
          <strong>Graph Explanation:</strong><br />
          • <strong>Trunk Lean (White Dashed Line):</strong> Tracks upper body forward angle. A steady horizontal line around 5°–10° indicates stable posture without vertical swaying.<br />
          • <strong>Hip Drive (Green/Gold Lines):</strong> Tracks hip joint extension during stride push-off.
        </div>
      </div>

      {/* 3. Lateral Pelvic Tilt (Hip Drop) & Arm Drive Chart */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
        <h4 className="text-sm font-bold text-slate-200 mb-4">
          3. Lateral Pelvic Drop & Upper Body Arm Carriage (Degrees)
        </h4>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 12 }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[0, 140]} />
              <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
              <Legend />
              <Line type="monotone" dataKey="pelvicTilt" name="Lateral Pelvic Tilt (°)" stroke="#C084FC" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="leftElbow" name="Left Elbow Bend (°)" stroke="#38BDF8" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="rightElbow" name="Right Elbow Bend (°)" stroke="#F472B6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
          <strong>Graph Explanation:</strong><br />
          • <strong>Pelvic Tilt (Purple Line):</strong> Measures lateral hip dip (Trendelenburg sign). Peaks should remain under 4.5° for strong glute/core stability.<br />
          • <strong>Elbow Bend (Cyan/Pink Lines):</strong> Tracks arm carriage compactness. Optimal elbow angle oscillates around 80°–100°.
        </div>
      </div>
    </div>
  );
};

