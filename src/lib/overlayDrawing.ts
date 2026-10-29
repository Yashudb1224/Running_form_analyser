import { FacingDirection, Landmark } from "../types/telemetry";

/**
 * Canvas drawing shared by the live video overlay and the evidence snapshots, so both show the
 * measurement exactly as it was calculated. Coordinates are video pixels.
 */

export const OVERLAY_COLORS = {
  leftLeg: "#7FA7CF",
  rightLeg: "#E0A877",
  torso: "#E1E7EA",
  arms: "#B8C7D0",
  measure: "#F1D27A",
  reference: "rgba(255, 255, 255, 0.75)",
  badgeBackground: "rgba(15, 20, 28, 0.88)",
  badgeText: "#F8FAFC",
};

const MIN_VISIBILITY = 0.5;

/** Line widths and fonts are designed for 720p and scaled with the video's shorter side. */
export function overlayScale(videoWidth: number, videoHeight: number): number {
  return Math.max(1, Math.min(videoWidth, videoHeight) / 720);
}

function usable(point: Landmark | null | undefined): point is Landmark {
  return Boolean(point && (point.visibility ?? 0) >= MIN_VISIBILITY);
}

function midpoint(a: Landmark | null | undefined, b: Landmark | null | undefined): Landmark | null {
  if (!usable(a) || !usable(b)) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: null, visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0) };
}

const SEGMENTS: [number, number, keyof typeof OVERLAY_COLORS, number][] = [
  [11, 12, "torso", 4], [11, 23, "torso", 4], [12, 24, "torso", 4], [23, 24, "torso", 4],
  [11, 13, "arms", 3], [13, 15, "arms", 3], [12, 14, "arms", 3], [14, 16, "arms", 3],
  [23, 25, "leftLeg", 4], [25, 27, "leftLeg", 4], [27, 29, "leftLeg", 3], [29, 31, "leftLeg", 3], [27, 31, "leftLeg", 3],
  [24, 26, "rightLeg", 4], [26, 28, "rightLeg", 4], [28, 30, "rightLeg", 3], [30, 32, "rightLeg", 3], [28, 32, "rightLeg", 3],
];
const JOINTS: [number, keyof typeof OVERLAY_COLORS][] = [
  [11, "torso"], [12, "torso"], [23, "torso"], [24, "torso"],
  [13, "arms"], [14, "arms"], [15, "arms"], [16, "arms"],
  [25, "leftLeg"], [27, "leftLeg"], [26, "rightLeg"], [28, "rightLeg"],
];

/**
 * Draws the skeleton with opacity following landmark visibility, so the occluded far leg reads
 * fainter, and tags each foot L/R so left/right swaps by the pose model are easy to spot.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: (Landmark | null)[],
  scale: number,
  options: { opacity?: number; legTags?: boolean } = {}
) {
  const opacity = options.opacity ?? 1;
  ctx.save();
  ctx.lineCap = "round";
  for (const [from, to, color, width] of SEGMENTS) {
    const a = lm[from];
    const b = lm[to];
    if (!usable(a) || !usable(b)) continue;
    ctx.globalAlpha = opacity * Math.min(1, 0.35 + Math.min(a.visibility ?? 0, b.visibility ?? 0) * 0.65);
    ctx.strokeStyle = OVERLAY_COLORS[color];
    ctx.lineWidth = width * scale;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const [index, color] of JOINTS) {
    const point = lm[index];
    if (!usable(point)) continue;
    ctx.globalAlpha = opacity * Math.min(1, 0.35 + (point.visibility ?? 0) * 0.65);
    ctx.fillStyle = OVERLAY_COLORS[color];
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (options.legTags) {
    // Tags sit just above each ankle so they stay clear of the ground and of snapshot captions.
    const left = lm[27];
    const right = lm[28];
    if (usable(left)) drawTag(ctx, left.x, left.y - 22 * scale, "L", OVERLAY_COLORS.leftLeg, scale, opacity);
    if (usable(right)) drawTag(ctx, right.x, right.y - 22 * scale, "R", OVERLAY_COLORS.rightLeg, scale, opacity);
  }
}

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, scale: number, opacity: number) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0F141C";
  ctx.font = `700 ${10 * scale}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5 * scale);
  ctx.restore();
}

export function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  accent: string,
  scale: number,
  align: "left" | "right" = "left"
) {
  ctx.save();
  ctx.font = `600 ${12 * scale}px Inter, system-ui, sans-serif`;
  const padX = 7 * scale;
  const height = 22 * scale;
  const width = ctx.measureText(text).width + padX * 2;
  const left = Math.max(2, Math.min(ctx.canvas.width - width - 2, align === "left" ? x : x - width));
  const top = Math.max(2, Math.min(ctx.canvas.height - height - 2, y - height / 2));
  ctx.fillStyle = OVERLAY_COLORS.badgeBackground;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, 4 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = OVERLAY_COLORS.badgeText;
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + padX, top + height / 2 + 0.5 * scale);
  ctx.restore();
}

function dashedLine(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, scale: number) {
  ctx.save();
  ctx.strokeStyle = OVERLAY_COLORS.reference;
  ctx.lineWidth = 2 * scale;
  ctx.setLineDash([6 * scale, 5 * scale]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function measureLine(ctx: CanvasRenderingContext2D, from: Landmark, to: Landmark, scale: number) {
  ctx.save();
  ctx.strokeStyle = OVERLAY_COLORS.measure;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

/** Arc at `center` between two direction angles (radians), taking the shorter way round. */
function angleArc(ctx: CanvasRenderingContext2D, center: { x: number; y: number }, from: number, to: number, radius: number, scale: number) {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  ctx.save();
  ctx.strokeStyle = OVERLAY_COLORS.measure;
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, from, from + delta, delta < 0);
  ctx.stroke();
  ctx.restore();
}

/** Shin line against a vertical reference from the knee: the foot-strike (overstride) measurement. */
export function drawShankAngle(
  ctx: CanvasRenderingContext2D,
  lm: (Landmark | null)[],
  leg: "left" | "right",
  facing: FacingDirection | null,
  scale: number,
  label: string
): boolean {
  const knee = lm[leg === "left" ? 25 : 26];
  const ankle = lm[leg === "left" ? 27 : 28];
  if (!usable(knee) || !usable(ankle)) return false;
  const length = Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
  dashedLine(ctx, knee, { x: knee.x, y: knee.y + length }, scale);
  measureLine(ctx, knee, ankle, scale);
  angleArc(ctx, knee, Math.PI / 2, Math.atan2(ankle.y - knee.y, ankle.x - knee.x), length * 0.45, scale);
  const toFront = (facing ?? 1) === 1;
  drawBadge(ctx, knee.x + (toFront ? 1 : -1) * 18 * scale, knee.y + length * 0.35, label, OVERLAY_COLORS.measure, scale, toFront ? "left" : "right");
  return true;
}

/** Thigh line extended through the knee against the shin: knee flexion = the angle between them. */
export function drawKneeFlexion(
  ctx: CanvasRenderingContext2D,
  lm: (Landmark | null)[],
  leg: "left" | "right",
  facing: FacingDirection | null,
  scale: number,
  label: string
): boolean {
  const hip = lm[leg === "left" ? 23 : 24];
  const knee = lm[leg === "left" ? 25 : 26];
  const ankle = lm[leg === "left" ? 27 : 28];
  if (!usable(hip) || !usable(knee) || !usable(ankle)) return false;
  const thighX = knee.x - hip.x;
  const thighY = knee.y - hip.y;
  const thighLength = Math.hypot(thighX, thighY) || 1;
  const shinLength = Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
  const extension = { x: knee.x + (thighX / thighLength) * shinLength * 0.8, y: knee.y + (thighY / thighLength) * shinLength * 0.8 };
  measureLine(ctx, hip, knee, scale);
  measureLine(ctx, knee, ankle, scale);
  dashedLine(ctx, knee, extension, scale);
  angleArc(ctx, knee, Math.atan2(thighY, thighX), Math.atan2(ankle.y - knee.y, ankle.x - knee.x), shinLength * 0.35, scale);
  const toFront = (facing ?? 1) === 1;
  drawBadge(ctx, knee.x + (toFront ? 1 : -1) * 22 * scale, knee.y, label, OVERLAY_COLORS.measure, scale, toFront ? "left" : "right");
  return true;
}

/** Hip-to-shoulder line against a vertical reference from the hips: forward trunk lean. */
export function drawTrunkLean(
  ctx: CanvasRenderingContext2D,
  lm: (Landmark | null)[],
  facing: FacingDirection | null,
  scale: number,
  label: string
): boolean {
  const shoulders = midpoint(lm[11], lm[12]);
  const hips = midpoint(lm[23], lm[24]);
  if (!shoulders || !hips) return false;
  const length = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  dashedLine(ctx, hips, { x: hips.x, y: hips.y - length }, scale);
  measureLine(ctx, hips, shoulders, scale);
  angleArc(ctx, hips, -Math.PI / 2, Math.atan2(shoulders.y - hips.y, shoulders.x - hips.x), length * 0.4, scale);
  const toFront = (facing ?? 1) === 1;
  drawBadge(ctx, shoulders.x + (toFront ? 1 : -1) * 20 * scale, shoulders.y - 6 * scale, label, OVERLAY_COLORS.measure, scale, toFront ? "left" : "right");
  return true;
}

/** Caption bar along the bottom of an evidence snapshot. */
export function drawCaption(ctx: CanvasRenderingContext2D, text: string, scale: number) {
  const height = 32 * scale;
  const { width: canvasWidth, height: canvasHeight } = ctx.canvas;
  ctx.save();
  ctx.fillStyle = "rgba(10, 14, 20, 0.82)";
  ctx.fillRect(0, canvasHeight - height, canvasWidth, height);
  ctx.fillStyle = OVERLAY_COLORS.badgeText;
  ctx.font = `600 ${14 * scale}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12 * scale, canvasHeight - height / 2);
  ctx.restore();
}
