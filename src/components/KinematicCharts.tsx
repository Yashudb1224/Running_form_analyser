import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceArea } from "recharts";
import { CompleteAnalysisReport } from "@/types/telemetry";
import { REFERENCE_RANGES } from "@/lib/researchReferences";
import { getChartPalette } from "@/lib/chartTheme";
import { useTheme } from "./ThemeProvider";

interface KinematicChartsProps {
  report: CompleteAnalysisReport;
}

const chartMargin = { top: 8, right: 12, left: -16, bottom: 4 };

function ChartEmptyState() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-xs text-muted">
      No valid tracked samples are available for this chart.
    </div>
  );
}

export const KinematicCharts: React.FC<KinematicChartsProps> = ({ report }) => {
  const { kinematics, frames, fps } = report;
  const palette = getChartPalette(useTheme().resolved);
  const { axis: AXIS_COLOR, grid: GRID_COLOR, left: LEFT_COLOR, right: RIGHT_COLOR, neutral: NEUTRAL_COLOR, band: BAND_COLOR } = palette;

  const chartData = kinematics.leftKneeAngles.map((leftKnee, idx) => {
    const timestamp = frames[idx] ? frames[idx].timestamp : idx / (fps || 30);
    const leftHip = kinematics.leftHipAngles[idx];
    const rightHip = kinematics.rightHipAngles[idx];
    const rightKnee = kinematics.rightKneeAngles[idx];
    const trunkLean = kinematics.trunkForwardLeanAngles[idx];
    const pelvicTilt = kinematics.hipLineImageTiltAngles[idx];
    const leftElbow = kinematics.leftElbowAngles[idx];
    const rightElbow = kinematics.rightElbowAngles[idx];
    return {
      time: Number(timestamp.toFixed(2)),
      leftKnee: leftKnee === null ? null : Number(leftKnee.toFixed(1)),
      rightKnee: rightKnee === null ? null : Number(rightKnee.toFixed(1)),
      leftHip: leftHip === null ? null : Number(leftHip.toFixed(1)),
      rightHip: rightHip === null ? null : Number(rightHip.toFixed(1)),
      trunkLean: trunkLean === null ? null : Number(trunkLean.toFixed(1)),
      pelvicTilt: pelvicTilt === null ? null : Number(pelvicTilt.toFixed(1)),
      leftElbow: leftElbow === null ? null : Number(leftElbow.toFixed(1)),
      rightElbow: rightElbow === null ? null : Number(rightElbow.toFixed(1)),
    };
  });

  const hasData = (...keys: (keyof (typeof chartData)[number])[]) =>
    chartData.some((row) => keys.some((key) => typeof row[key] === "number" && Number.isFinite(row[key])));

  const axisProps = {
    stroke: AXIS_COLOR,
    tick: { fill: AXIS_COLOR, fontSize: 11 },
    tickLine: { stroke: GRID_COLOR },
    axisLine: { stroke: GRID_COLOR },
  };
  const tooltipStyle = {
    backgroundColor: palette.tooltipBackground,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: 8,
    color: palette.tooltipText,
    fontSize: 12,
  };
  const leanBand = REFERENCE_RANGES.trunkLean;

  return (
    <section aria-labelledby="kinematic-heading" className="space-y-4">
      <div>
        <p className="eyebrow">Motion traces</p>
        <h3 id="kinematic-heading" className="mt-1 text-lg font-semibold text-ink">Kinematic time series</h3>
      </div>

      <article className="chart-panel">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-ink">Internal knee angle</h4>
          <p className="mt-0.5 text-xs text-muted">180° is a straight leg. Dips during stance show knee bend absorbing the landing.</p>
        </div>
        <div className="h-64 w-full sm:h-72">
          {hasData("leftKnee", "rightKnee") ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} {...axisProps} tickFormatter={(value: number) => `${value}s`} />
                <YAxis domain={[0, 180]} {...axisProps} unit="°" width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value}°`, name]} labelFormatter={(value: number) => `${value} s`} />
                <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 11, color: AXIS_COLOR }} />
                <Line type="linear" connectNulls={false} dataKey="leftKnee" name="Left" stroke={LEFT_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                <Line type="linear" connectNulls={false} dataKey="rightKnee" name="Right" stroke={RIGHT_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState />}
        </div>
      </article>

      <article className="chart-panel">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-ink">Forward trunk lean</h4>
          <p className="mt-0.5 text-xs text-muted">
            Positive values lean in the running direction. Shaded band: research-typical {leanBand.minimum}–{leanBand.maximum}°.
          </p>
        </div>
        <div className="h-56 w-full sm:h-64">
          {hasData("trunkLean") ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <ReferenceArea y1={leanBand.minimum} y2={leanBand.maximum} fill={BAND_COLOR} fillOpacity={0.1} stroke="none" ifOverflow="extendDomain" />
                <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} {...axisProps} tickFormatter={(value: number) => `${value}s`} />
                <YAxis domain={["auto", "auto"]} {...axisProps} unit="°" width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value}°`, name]} labelFormatter={(value: number) => `${value} s`} />
                <Line type="linear" connectNulls={false} dataKey="trunkLean" name="Forward trunk lean" stroke={NEUTRAL_COLOR} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState />}
        </div>
      </article>

      <article className="chart-panel">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-ink">Hip angle</h4>
          <p className="mt-0.5 text-xs text-muted">Angle between the trunk and thigh for each side.</p>
        </div>
        <div className="h-56 w-full sm:h-64">
          {hasData("leftHip", "rightHip") ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} {...axisProps} tickFormatter={(value: number) => `${value}s`} />
                <YAxis domain={["auto", "auto"]} {...axisProps} unit="°" width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value}°`, name]} labelFormatter={(value: number) => `${value} s`} />
                <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 11, color: AXIS_COLOR }} />
                <Line type="linear" connectNulls={false} dataKey="leftHip" name="Left hip" stroke={LEFT_COLOR} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                <Line type="linear" connectNulls={false} dataKey="rightHip" name="Right hip" stroke={RIGHT_COLOR} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState />}
        </div>
      </article>

      <article className="chart-panel">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-ink">Hip-line tilt and elbow angles</h4>
        </div>
        <div className="h-64 w-full sm:h-72">
          {hasData("pelvicTilt", "leftElbow", "rightElbow") ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} {...axisProps} tickFormatter={(value: number) => `${value}s`} />
                <YAxis domain={[0, 180]} {...axisProps} unit="°" width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value}°`, name]} labelFormatter={(value: number) => `${value} s`} />
                <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 11, color: AXIS_COLOR }} />
                <Line type="linear" connectNulls={false} dataKey="pelvicTilt" name="Hip-line image tilt" stroke={NEUTRAL_COLOR} strokeWidth={1.8} strokeDasharray="5 4" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                <Line type="linear" connectNulls={false} dataKey="leftElbow" name="Left elbow" stroke={LEFT_COLOR} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                <Line type="linear" connectNulls={false} dataKey="rightElbow" name="Right elbow" stroke={RIGHT_COLOR} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState />}
        </div>
      </article>
    </section>
  );
};
