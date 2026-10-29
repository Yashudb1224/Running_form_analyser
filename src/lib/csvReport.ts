import { CompleteAnalysisReport, MetricResult } from "../types/telemetry";

function escapeCsv(value: string | number | null): string {
  const text = value === null ? "Unavailable" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function metricCsvRow(label: string, value: MetricResult): string {
  const displayValue = value.value === null ? null : value.value;
  const status = `${value.status} (${value.unit})`;
  return [label, displayValue, status].map(escapeCsv).join(",");
}

function averageAbsolute(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + Math.abs(value), 0) / valid.length : null;
}

export function buildCsvReport(report: CompleteAnalysisReport): string {
  const trunkLean = averageAbsolute(report.kinematics.trunkImagePlaneAngles);
  const lines = [
    ["Metric", "Value", "Status / Unit"].map(escapeCsv).join(","),
    ["Analysis status", report.quality.sufficientForSummary ? "Complete core tracking" : "Incomplete core tracking", "status"].map(escapeCsv).join(","),
    ["Sampled frames", report.quality.sampledFrames, "count"].map(escapeCsv).join(","),
    ["Tracked frames", report.quality.trackedFrames, "count"].map(escapeCsv).join(","),
    ["Valid tracking", report.quality.validTrackingPct, "%"].map(escapeCsv).join(","),
    ["Mean exposed core-landmark visibility", report.quality.meanLandmarkVisibility, "MediaPipe visibility; not model accuracy"].map(escapeCsv).join(","),
    ["Analyzed start", report.quality.analyzedStartSec, "s"].map(escapeCsv).join(","),
    ["Analyzed end", report.quality.analyzedEndSec, "s"].map(escapeCsv).join(","),
    ["Source duration", report.quality.sourceDurationSec, "s"].map(escapeCsv).join(","),
    ["Sampling rate", report.quality.samplingRateFps, "samples/s"].map(escapeCsv).join(","),
    metricCsvRow("Composite demonstration score", report.formScore.overallScore),
    metricCsvRow("Estimated cadence", report.gait.cadenceSpm),
    metricCsvRow("Mean step interval", report.gait.avgStepTimeSec),
    metricCsvRow("Ground contact time", report.gait.groundContactTimeMs),
    metricCsvRow("Flight time", report.gait.flightTimeMs),
    metricCsvRow("Duty factor", report.gait.dutyFactorPct),
    metricCsvRow("Vertical pelvis range", report.gait.pelvisVerticalRangeBodyHeightPct),
    metricCsvRow("Ankle-hip image offset", report.gait.ankleHipOffsetBodyHeightPct),
    metricCsvRow("Maximum hip-line image tilt", report.gait.maxHipLineImageTiltDeg),
    metricCsvRow("Step-time coefficient of variation", report.gait.stepTimeCvPct),
    metricCsvRow("Knee-angle asymmetry index", report.symmetry.kneeAngleAsymmetryPct),
    metricCsvRow("Stride consistency index", report.symmetry.strideConsistencyScore),
    metricCsvRow("Left maximum internal knee angle", report.symmetry.kneeAngleMaxLeftDeg),
    metricCsvRow("Right maximum internal knee angle", report.symmetry.kneeAngleMaxRightDeg),
    metricCsvRow("Left minimum internal knee angle", report.symmetry.kneeAngleMinLeftDeg),
    metricCsvRow("Right minimum internal knee angle", report.symmetry.kneeAngleMinRightDeg),
    metricCsvRow("Elbow-angle comparison", report.symmetry.elbowAngleSimilarityPct),
  ];
  lines.push([
    "Mean absolute trunk image-plane angle",
    trunkLean === null ? "Unavailable" : trunkLean.toFixed(2),
    "landmark-derived (deg; camera orientation uncalibrated)",
  ].map(escapeCsv).join(","));
  return lines.join("\r\n");
}
