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
      leftKnee: leftKnee === null ? null : Math.round(leftKnee),
      rightKnee: kinematics.rightKneeAngles[idx] === null ? null : Math.round(kinematics.rightKneeAngles[idx] ?? 0),
      leftHip: kinematics.leftHipAngles[idx] === null ? null : Math.round(kinematics.leftHipAngles[idx] ?? 0),
      rightHip: kinematics.rightHipAngles[idx] === null ? null : Math.round(kinematics.rightHipAngles[idx] ?? 0),
      trunkLean: kinematics.trunkImagePlaneAngles[idx] === null ? null : parseFloat((kinematics.trunkImagePlaneAngles[idx] ?? 0).toFixed(1)),
      pelvicTilt: kinematics.hipLineImageTiltAngles[idx] === null ? null : parseFloat((kinematics.hipLineImageTiltAngles[idx] ?? 0).toFixed(1)),
      leftElbow: kinematics.leftElbowAngles[idx] === null ? null : Math.round(kinematics.leftElbowAngles[idx] ?? 0),
      rightElbow: kinematics.rightElbowAngles[idx] === null ? null : Math.round(kinematics.rightElbowAngles[idx] ?? 0)
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">
          Time-Series Kinematic Charts
        </h3>
        <p className="text-xs text-slate-400">
          2D landmark-derived values; gaps indicate unavailable landmarks rather than zero-angle samples.
        </p>
      </div>

      {/* 1. Internal Knee Angle Chart */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
        <h4 className="text-sm font-bold text-slate-200 mb-4">
          1. Internal Knee Angle (Degrees; straight configuration approaches 180°)
        </h4>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 12 }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[0, 180]} label={{ value: "Angle (°)", angle: -90, position: "insideLeft" }} />
              <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
              <Legend />
              <Line type="monotone" connectNulls={false} dataKey="leftKnee" name="Left Internal Knee Angle (°)" stroke="#00E5FF" strokeWidth={2.5} dot={false} />
              <Line type="monotone" connectNulls={false} dataKey="rightKnee" name="Right Internal Knee Angle (°)" stroke="#FF00AA" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
          <strong>Graph explanation:</strong> Values are 2D internal angles at the knee. A larger value indicates a straighter configuration; the maximum angle is not maximum knee flexion. Missing segments are not filled with zeroes.
        </div>
      </div>

      {/* 2. Hip Drive & Trunk Lean Chart */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
        <h4 className="text-sm font-bold text-slate-200 mb-4">
          2. Hip Angle & Trunk Image-Plane Angle (Degrees)
        </h4>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 12 }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[-10, 180]} />
              <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
              <Legend />
              <Line type="monotone" connectNulls={false} dataKey="leftHip" name="Left Hip Angle (°)" stroke="#00FF66" strokeWidth={2} dot={false} />
              <Line type="monotone" connectNulls={false} dataKey="rightHip" name="Right Hip Angle (°)" stroke="#FFD700" strokeWidth={2} dot={false} />
              <Line type="monotone" connectNulls={false} dataKey="trunkLean" name="Trunk Image-Plane Angle (°)" stroke="#F8FAFC" strokeDasharray="5 5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
          <strong>Graph explanation:</strong> The trunk angle is relative to the image vertical. Without knowing camera orientation, it is not labelled as calibrated forward lean. Hip angles are 2D projections.
        </div>
      </div>

      {/* 3. Lateral Pelvic Tilt (Hip Drop) & Arm Drive Chart */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg">
        <h4 className="text-sm font-bold text-slate-200 mb-4">
          3. Hip-Line Image Tilt & Elbow Angles (Degrees)
        </h4>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222C3E" />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 12 }} label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[0, 140]} />
              <Tooltip contentStyle={{ backgroundColor: "#161F30", borderColor: "#222C3E", borderRadius: "8px", color: "#F8FAFC" }} />
              <Legend />
              <Line type="monotone" connectNulls={false} dataKey="pelvicTilt" name="Hip-Line Image Tilt (°)" stroke="#C084FC" strokeWidth={2.5} dot={false} />
              <Line type="monotone" connectNulls={false} dataKey="leftElbow" name="Left Elbow Angle (°)" stroke="#38BDF8" strokeWidth={1.5} dot={false} />
              <Line type="monotone" connectNulls={false} dataKey="rightElbow" name="Right Elbow Angle (°)" stroke="#F472B6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 bg-card/60 border border-border rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
          <strong>Graph explanation:</strong> The hip-line angle is measured in image space and does not diagnose pelvic drop. Elbow angles are 2D landmark geometry, not arm-swing amplitude.
        </div>
      </div>
    </div>
  );
};
