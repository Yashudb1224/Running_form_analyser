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
    { limb: "Left", maximumAngle: symmetry.kneeAngleMaxLeftDeg.value, minimumAngle: symmetry.kneeAngleMinLeftDeg.value },
    { limb: "Right", maximumAngle: symmetry.kneeAngleMaxRightDeg.value, minimumAngle: symmetry.kneeAngleMinRightDeg.value },
  ];
  const metrics = [
    ["Cadence estimate", gait.cadenceSpm],
    ["Mean step interval", gait.avgStepTimeSec],
    ["Step-time variation", gait.stepTimeCvPct],
    ["Pelvis vertical range", gait.pelvisVerticalRangeBodyHeightPct],
    ["Ankle–hip image offset", gait.ankleHipOffsetBodyHeightPct],
    ["Hip-line image tilt", gait.maxHipLineImageTiltDeg],
    ["Paired knee-angle asymmetry", symmetry.kneeAngleAsymmetryPct],
    ["Elbow-angle comparison", symmetry.elbowAngleSimilarityPct],
  ] as const;
  const hasKneeAngles = barData.some((row) => row.maximumAngle !== null || row.minimumAngle !== null);

  return (
    <section aria-labelledby="gait-heading">
      <div className="mb-2 border-b border-border pb-4">
        <p className="eyebrow">Bilateral measures</p>
        <h3 id="gait-heading" className="mt-1 text-lg font-semibold text-slate-900">Gait and symmetry</h3>
      </div>

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="py-5">
          <h4 className="text-sm font-semibold text-slate-800">Internal knee-angle range</h4>
          <div className="mt-3 h-60 w-full">
            {hasKneeAngles ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                  <CartesianGrid stroke="#e3e8ec" vertical={false} />
                  <XAxis dataKey="limb" stroke="#687681" tick={{ fill: "#687681", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#dce2e7" }} />
                  <YAxis domain={[0, 180]} unit="°" width={44} stroke="#687681" tick={{ fill: "#687681", fontSize: 11 }} tickLine={{ stroke: "#e3e8ec" }} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #dce2e7", borderRadius: 2, color: "#202a33", fontSize: 12 }} formatter={(value: number, name: string) => [`${value}°`, name]} />
                  <Legend verticalAlign="top" height={28} iconType="square" wrapperStyle={{ fontSize: 11, color: "#687681" }} />
                  <Bar dataKey="maximumAngle" name="Maximum angle" fill="#2d6598" maxBarSize={34} isAnimationActive={false} />
                  <Bar dataKey="minimumAngle" name="Minimum angle" fill="#a9b5be" maxBarSize={34} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-border px-4 text-center text-xs text-slate-500">
                Knee-angle observations are unavailable.
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border py-5 lg:border-l lg:border-t-0 lg:pl-8">
          <h4 className="text-sm font-semibold text-slate-800">Gait metrics</h4>
          <dl className="mt-2 divide-y divide-border border-y border-border">
            {metrics.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-2.5">
                <dt className="text-xs text-slate-600">{label}</dt>
                <dd className="text-right text-xs font-medium text-slate-800">
                  <MetricValue metric={value} digits={1} className="block" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

    </section>
  );
};
