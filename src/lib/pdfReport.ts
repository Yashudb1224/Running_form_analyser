import { jsPDF } from "jspdf";
import { CompleteAnalysisReport, MetricResult, metric } from "../types/telemetry";
import { getMetricComparisons } from "./metricComparison";
import { REFERENCE_RANGES } from "./researchReferences";

const PAGE_WIDTH = 210;
const LEFT = 16;
const RIGHT = PAGE_WIDTH - LEFT;
const CONTENT_WIDTH = RIGHT - LEFT;
const COLORS = {
  ink: [31, 43, 53] as const,
  muted: [101, 114, 125] as const,
  border: [218, 225, 230] as const,
  accent: [45, 101, 152] as const,
  second: [193, 123, 72] as const,
  light: [244, 247, 249] as const,
};

function cleanText(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[·•]/g, " | ")
    .replace(/°/g, " deg")
    .replace(/[^\x20-\x7E]/g, "");
}

export function formatPdfMetric(metric: MetricResult, digits = 1): string {
  if (metric.value === null || !Number.isFinite(metric.value)) return "Unavailable";
  const value = Number.isInteger(metric.value) ? String(metric.value) : metric.value.toFixed(digits);
  return `${value} ${cleanText(metric.unit)}`;
}

function setTextColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setTextColor(doc, COLORS.ink);
  doc.text(cleanText(title), LEFT, y);
  setDrawColor(doc, COLORS.border);
  doc.line(LEFT, y + 2.5, RIGHT, y + 2.5);
  return y + 8;
}

function writeTable(
  doc: jsPDF,
  rows: Array<[string, string, string]>,
  y: number,
  columns: [number, number] = [92, 48]
): number {
  const [valueWidth, statusWidth] = columns;
  const statusX = LEFT + valueWidth + statusWidth;
  const lineHeight = 5.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setTextColor(doc, COLORS.muted);
  doc.text("MEASURE", LEFT, y);
  doc.text("VALUE", LEFT + valueWidth, y);
  doc.text("STATUS", statusX, y);
  y += 3;
  setDrawColor(doc, COLORS.border);
  doc.line(LEFT, y, RIGHT, y);
  y += 4;

  for (const [label, value, status] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setTextColor(doc, COLORS.ink);
    doc.text(cleanText(label), LEFT, y);
    doc.text(cleanText(value), LEFT + valueWidth, y);
    doc.setFontSize(7);
    setTextColor(doc, COLORS.muted);
    doc.text(cleanText(status), statusX, y);
    y += lineHeight;
  }
  return y;
}

function metricRow(label: string, value: MetricResult): [string, string, string] {
  return [label, formatPdfMetric(value), value.status.replace(/-/g, " ")];
}

function drawHeader(doc: jsPDF, report: CompleteAnalysisReport, sourceName: string, pageLabel: string) {
  doc.setFillColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
  doc.rect(0, 0, PAGE_WIDTH, 27, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("STRIDE LAB", LEFT, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(210, 220, 228);
  doc.text(doc.splitTextToSize(cleanText(sourceName || "Running video analysis"), 105)[0], LEFT, 19);
  doc.text(pageLabel, RIGHT, 19, { align: "right" });
  doc.setFontSize(7);
  doc.text(
    `${report.quality.analyzedStartSec.toFixed(1)}-${report.quality.analyzedEndSec.toFixed(1)} s | ${report.quality.sampledFrames} samples`,
    RIGHT,
    12,
    { align: "right" }
  );
}

function drawFooter(doc: jsPDF, page: number, total: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  setDrawColor(doc, COLORS.border);
  doc.line(LEFT, pageHeight - 12, RIGHT, pageHeight - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, COLORS.muted);
  doc.text("2D landmark analysis | Estimated and heuristic metrics are identified by status.", LEFT, pageHeight - 7);
  doc.text(`${page} / ${total}`, RIGHT, pageHeight - 7, { align: "right" });
}

function additionalMetricRows(report: CompleteAnalysisReport): Array<[string, string, string]> {
  const { gait, symmetry } = report;
  return [
    metricRow("Mean step interval", gait.avgStepTimeSec),
    metricRow("Left midstance knee flexion", gait.left.midstanceKneeFlexionDeg),
    metricRow("Right midstance knee flexion", gait.right.midstanceKneeFlexionDeg),
    metricRow("Left foot-strike shank angle", gait.left.footStrikeShankAngleDeg),
    metricRow("Right foot-strike shank angle", gait.right.footStrikeShankAngleDeg),
    metricRow("Step-time symmetry index", symmetry.stepTimeSymmetryIndexPct),
  ];
}

function writeReferences(doc: jsPDF, y: number, bottom: number): number {
  const citations = new Map<string, string>();
  for (const reference of Object.values(REFERENCE_RANGES)) {
    for (const citation of reference.citations) citations.set(citation.short, citation.full);
  }
  y = writeSectionTitle(doc, "REFERENCES", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  setTextColor(doc, COLORS.muted);
  for (const full of citations.values()) {
    const lines = doc.splitTextToSize(cleanText(full), CONTENT_WIDTH) as string[];
    if (y + lines.length * 2.9 > bottom) break;
    doc.text(lines, LEFT, y);
    y += lines.length * 2.9 + 1.2;
  }
  return y;
}

function writeComparisonTable(doc: jsPDF, report: CompleteAnalysisReport, y: number): number {
  const observedX = LEFT + 55;
  const referenceX = LEFT + 93;
  const positionX = LEFT + 140;
  const observedWidth = 35;
  const referenceWidth = 44;
  const positionWidth = RIGHT - positionX;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  setTextColor(doc, COLORS.muted);
  doc.text("METRIC", LEFT, y);
  doc.text("OBSERVED", observedX, y);
  doc.text("RESEARCH REFERENCE", referenceX, y);
  doc.text("POSITION", positionX, y);
  setDrawColor(doc, COLORS.border);
  doc.line(LEFT, y + 2.2, RIGHT, y + 2.2);
  y += 7;

  for (const comparison of getMetricComparisons(report)) {
    const observed = doc.splitTextToSize(cleanText(formatPdfMetric(comparison.observed)), observedWidth) as string[];
    const reference = doc.splitTextToSize(cleanText(comparison.referenceText), referenceWidth) as string[];
    const positionLabel = comparison.score?.value != null
      ? `${comparison.positionText} | ${comparison.score.value}/100`
      : comparison.positionText;
    const position = doc.splitTextToSize(cleanText(positionLabel), positionWidth) as string[];
    const rowHeight = Math.max(7, Math.max(observed.length, reference.length, position.length) * 3.2 + 3.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.ink);
    doc.text(cleanText(comparison.label), LEFT, y);
    observed.forEach((line, index) => doc.text(line, observedX, y + index * 3.2));
    doc.setFontSize(5.8);
    setTextColor(doc, COLORS.muted);
    doc.text(comparison.observed.status.replace(/-/g, " "), observedX, y + 3.1);
    doc.setFontSize(7);
    reference.forEach((line, index) => doc.text(line, referenceX, y + index * 3.2));
    setTextColor(doc, COLORS.ink);
    position.forEach((line, index) => doc.text(line, positionX, y + index * 3.2));
    y += rowHeight;
  }
  return y;
}

function drawMetricChart(
  doc: jsPDF,
  title: string,
  series: Array<{ label: string; values: (number | null)[]; color: readonly [number, number, number] }>,
  timestamps: number[],
  y: number,
  chartHeight = 48
): number {
  const chartX = LEFT + 13;
  const chartWidth = CONTENT_WIDTH - 18;
  const chartY = y + 8;
  const plotHeight = chartHeight - 13;
  const observedValues = series.flatMap((item) =>
    item.values.filter((value): value is number => value !== null && Number.isFinite(value))
  );
  const minimum = Math.min(0, ...observedValues);
  const maximum = Math.max(180, ...observedValues);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextColor(doc, COLORS.ink);
  doc.text(cleanText(title), LEFT, y + 3);

  setDrawColor(doc, COLORS.border);
  doc.setLineWidth(0.2);
  for (let tick = 0; tick <= 3; tick++) {
    const lineY = chartY + (plotHeight * tick) / 3;
    doc.line(chartX, lineY, chartX + chartWidth, lineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    setTextColor(doc, COLORS.muted);
    doc.text(String(Math.round(maximum - ((maximum - minimum) * tick) / 3)), chartX - 2, lineY + 1, { align: "right" });
  }
  doc.line(chartX, chartY, chartX, chartY + plotHeight);

  const validTimes = timestamps.filter(Number.isFinite);
  const minTime = validTimes.length ? Math.min(...validTimes) : 0;
  const maxTime = validTimes.length ? Math.max(...validTimes) : 1;
  const timeRange = maxTime > minTime ? maxTime - minTime : 1;

  for (const item of series) {
    let previous: { x: number; y: number } | null = null;
    setDrawColor(doc, item.color);
    doc.setLineWidth(0.65);
    item.values.forEach((value, index) => {
      if (value === null || !Number.isFinite(value) || !Number.isFinite(timestamps[index])) {
        previous = null;
        return;
      }
      const x = chartX + ((timestamps[index] - minTime) / timeRange) * chartWidth;
      const pointY = chartY + (1 - (value - minimum) / (maximum - minimum)) * plotHeight;
      if (previous) doc.line(previous.x, previous.y, x, pointY);
      previous = { x, y: pointY };
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  let legendX = chartX;
  const legendY = chartY + plotHeight + 5;
  for (const item of series) {
    setDrawColor(doc, item.color);
    doc.setLineWidth(1);
    doc.line(legendX, legendY - 0.8, legendX + 6, legendY - 0.8);
    setTextColor(doc, COLORS.muted);
    doc.text(cleanText(item.label), legendX + 8, legendY);
    legendX += 10 + doc.getTextWidth(cleanText(item.label));
  }
  doc.setFontSize(6);
  setTextColor(doc, COLORS.muted);
  doc.text(`${minTime.toFixed(1)} s`, chartX, chartY + chartHeight, { align: "left" });
  doc.text(`${maxTime.toFixed(1)} s`, chartX + chartWidth, chartY + chartHeight, { align: "right" });
  return chartY + chartHeight;
}

export function createPdfReport(report: CompleteAnalysisReport, sourceName: string): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();

  drawHeader(doc, report, sourceName, "SESSION SUMMARY");
  let y = 35;
  y = writeSectionTitle(doc, "DATA QUALITY", y);
  const qualityRows: Array<[string, string, string]> = [
    ["Tracking coverage", `${report.quality.validTrackingPct}%`, `${report.quality.trackedFrames} / ${report.quality.sampledFrames} tracked`],
    ["Mean landmark visibility", report.quality.meanLandmarkVisibility === null ? "Unavailable" : `${(report.quality.meanLandmarkVisibility * 100).toFixed(1)}%`, "MediaPipe visibility"],
    ["Sampling", `${report.quality.samplingRateFps} samples/s`, `${report.quality.sampledFrames} samples`],
    ["Analyzed interval", `${report.quality.analyzedStartSec.toFixed(2)}-${report.quality.analyzedEndSec.toFixed(2)} s`, `Source ${report.quality.sourceDurationSec.toFixed(2)} s`],
    ["Camera view", report.quality.cameraView.replace(/-/g, " "), report.quality.bodyWidthRatio === null ? "Unavailable" : `Width ratio ${report.quality.bodyWidthRatio}`],
    ["Detected steps", `${report.gait.stepCount}`, report.quality.facingDirection === null ? "Direction unknown" : report.quality.facingDirection === 1 ? "Running left to right" : "Running right to left"],
    ["Composite gate", report.quality.sufficientForSummary ? "Requirements met" : "Requirements not met", report.quality.sufficientForSummary ? "Met" : "Not met"],
  ];
  y = writeTable(doc, qualityRows, y, [76, 43]);
  y += 5;
  y = writeSectionTitle(doc, "COMPOSITE FORM SCORE", y);
  y = writeTable(doc, [metricRow("Composite score", report.formScore.overallScore)], y, [94, 43]);
  y += 3;
  y = writeSectionTitle(doc, "METRIC COMPARISON", y);
  y = writeComparisonTable(doc, report, y);
  y += 3;
  y = writeSectionTitle(doc, "PER-LEG MEASUREMENTS", y);
  y = writeTable(doc, additionalMetricRows(report), y, [94, 43]);

  const notes = [...report.quality.warnings, ...report.formScore.observations];
  const noteY = Math.min(y + 5, pageHeight - 42);
  if (notes.length && y < pageHeight - 38) {
    y = writeSectionTitle(doc, "SESSION NOTES", noteY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.muted);
    for (const note of notes.slice(0, 4)) {
      const lines = doc.splitTextToSize(cleanText(note), CONTENT_WIDTH - 4) as string[];
      if (y + lines.length * 3.8 > pageHeight - 17) break;
      doc.text(lines, LEFT + 2, y);
      y += lines.length * 3.8 + 1.5;
    }
  }
  drawFooter(doc, 1, 2);

  doc.addPage();
  drawHeader(doc, report, sourceName, "KINEMATIC TRACES");
  y = 33;
  const times = report.frames.map((frame) => frame.timestamp);
  const charts = [
    {
      title: "Internal knee angle (deg)",
      series: [
        { label: "Left", values: report.kinematics.leftKneeAngles, color: COLORS.accent },
        { label: "Right", values: report.kinematics.rightKneeAngles, color: COLORS.second },
      ],
    },
    {
      title: "Hip and trunk angle (deg)",
      series: [
        { label: "Left hip", values: report.kinematics.leftHipAngles, color: COLORS.accent },
        { label: "Right hip", values: report.kinematics.rightHipAngles, color: COLORS.second },
        { label: "Forward trunk lean", values: report.kinematics.trunkForwardLeanAngles, color: COLORS.muted },
      ],
    },
    {
      title: "Hip-line tilt and elbow angle (deg)",
      series: [
        { label: "Hip-line tilt", values: report.kinematics.hipLineImageTiltAngles, color: COLORS.muted },
        { label: "Left elbow", values: report.kinematics.leftElbowAngles, color: COLORS.accent },
        { label: "Right elbow", values: report.kinematics.rightElbowAngles, color: COLORS.second },
      ],
    },
  ];
  for (const chart of charts) {
    y = drawMetricChart(doc, chart.title, chart.series, times, y, 46);
    y += 4;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, COLORS.muted);
  doc.text("X axis: source video time (s) | Y axis: image-space angle (deg)", LEFT, y + 1);
  writeReferences(doc, y + 9, pageHeight - 15);
  drawFooter(doc, 2, 2);
  return doc;
}

export function downloadPdfReport(report: CompleteAnalysisReport, sourceName: string): void {
  const doc = createPdfReport(report, sourceName);
  const safeName = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
  doc.save(`${safeName || "running-analysis"}-report.pdf`);
}
