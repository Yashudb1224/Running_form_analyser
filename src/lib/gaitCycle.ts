import { FootStrikeEvent, FramePose, GaitMetrics, KinematicSequence, Landmark, LegSummary, metric, unavailableMetric } from "../types/telemetry";
import { calculateShankAngle } from "./biomechanics";
import { smoothArray } from "./signalProcessor";

const MIN_VISIBILITY = 0.5;
/** Same-leg stance peaks are a full stride apart; even very high cadences leave more than 0.4 s. */
const SAME_LEG_MIN_SEPARATION_SEC = 0.4;
/** Fraction of the ankle's vertical range below its stance peak still treated as foot on the ground. */
const STANCE_WINDOW_FRACTION = 0.12;
const MAX_STANCE_HALF_WINDOW_SEC = 0.3;
const MIN_INTERVALS_FOR_CADENCE = 2;
const MIN_INTERVALS_FOR_VARIATION = 4;

function validPoint(point: Landmark | null | undefined): point is Landmark {
  return Boolean(point && point.visibility !== null && point.visibility >= MIN_VISIBILITY);
}

function finiteValues(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))))];
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

export function findPeaks(
  data: (number | null)[],
  timestamps: number[],
  minimumSeparationSec: number,
  prominence: number
): number[] {
  const peaks: number[] = [];
  let lastPeakTime = -Infinity;

  for (let index = 1; index < data.length - 1; index++) {
    const value = data[index];
    if (value === null || !Number.isFinite(value)) continue;
    let plateauEnd = index;
    while (plateauEnd + 1 < data.length && data[plateauEnd + 1] === value) plateauEnd++;
    const before = data[index - 1];
    const after = data[plateauEnd + 1];
    const peakIndex = Math.floor((index + plateauEnd) / 2);
    const time = timestamps[peakIndex];
    if (
      typeof before !== "number" ||
      typeof after !== "number" ||
      !Number.isFinite(value) ||
      !Number.isFinite(time) ||
      value <= before ||
      value <= after ||
      time - lastPeakTime < minimumSeparationSec
    ) {
      index = plateauEnd;
      continue;
    }

    const windowStart = Math.max(0, peakIndex - 3);
    const windowEnd = Math.min(data.length, peakIndex + 4);
    const neighborhood = finiteValues(data.slice(windowStart, windowEnd));
    if (neighborhood.length < 3) {
      index = plateauEnd;
      continue;
    }
    const localMinimum = Math.min(...neighborhood);
    if (value - localMinimum >= prominence) {
      peaks.push(peakIndex);
      lastPeakTime = time;
    }
    index = plateauEnd;
  }
  return peaks;
}

/**
 * Refines a sampled peak time by fitting a parabola through the peak and its two neighbours. At 30
 * samples/s this reduces event timing error well below the 33 ms frame interval.
 */
export function refinePeakTime(data: (number | null)[], timestamps: number[], index: number): number {
  const time = timestamps[index];
  const before = data[index - 1];
  const value = data[index];
  const after = data[index + 1];
  const previousTime = timestamps[index - 1];
  const nextTime = timestamps[index + 1];
  if (
    typeof before !== "number" || typeof value !== "number" || typeof after !== "number" ||
    !Number.isFinite(previousTime) || !Number.isFinite(nextTime)
  ) {
    return time;
  }
  const denominator = before - 2 * value + after;
  if (denominator === 0) return time;
  const offset = Math.max(-0.5, Math.min(0.5, (0.5 * (before - after)) / denominator));
  const step = (nextTime - previousTime) / 2;
  return time + offset * step;
}

function hipCenterAt(frame: FramePose | undefined, leg: "left" | "right"): Landmark | null {
  const left = frame?.landmarks[23];
  const right = frame?.landmarks[24];
  if (validPoint(left) && validPoint(right)) {
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: null, visibility: Math.min(left.visibility ?? 0, right.visibility ?? 0) };
  }
  const sameSide = leg === "left" ? left : right;
  return validPoint(sameSide) ? sameSide : null;
}

function detectLegEvents(
  leg: "left" | "right",
  smoothed: (number | null)[],
  timestamps: number[],
  prominence: number,
  kinematics: KinematicSequence,
  frames: FramePose[]
): FootStrikeEvent[] {
  const valid = finiteValues(smoothed);
  if (valid.length < 3) return [];
  const legRange = percentile(valid, 0.95) - percentile(valid, 0.05);
  const kneeAngles = leg === "left" ? kinematics.leftKneeAngles : kinematics.rightKneeAngles;
  const kneeIndex = leg === "left" ? 25 : 26;
  const ankleIndex = leg === "left" ? 27 : 28;
  const facing = kinematics.facingDirection;

  return findPeaks(smoothed, timestamps, SAME_LEG_MIN_SEPARATION_SEC, prominence).map((peak) => {
    const peakValue = smoothed[peak] as number;
    const threshold = peakValue - STANCE_WINDOW_FRACTION * legRange;
    const inStance = (index: number) => {
      const value = smoothed[index];
      return (
        value !== null && value >= threshold &&
        Math.abs(timestamps[index] - timestamps[peak]) <= MAX_STANCE_HALF_WINDOW_SEC
      );
    };
    let strikeFrame = peak;
    while (strikeFrame > 0 && inStance(strikeFrame - 1)) strikeFrame--;
    let toeOffFrame = peak;
    while (toeOffFrame < smoothed.length - 1 && inStance(toeOffFrame + 1)) toeOffFrame++;

    const flexions = finiteValues(kneeAngles.slice(strikeFrame, toeOffFrame + 1)).map((angle) => 180 - angle);
    const strike = frames[strikeFrame];
    const rawShank = calculateShankAngle(strike?.landmarks[kneeIndex], strike?.landmarks[ankleIndex]);
    const ankle = strike?.landmarks[ankleIndex];
    const hip = hipCenterAt(strike, leg);
    const torso = kinematics.torsoHeightPx[strikeFrame];

    return {
      leg,
      stanceFrame: peak,
      stanceTime: refinePeakTime(smoothed, timestamps, peak),
      strikeFrame,
      shankAngleDeg: rawShank === null || facing === null ? null : rawShank * facing,
      ankleAheadOfHipPct: validPoint(ankle) && hip && facing !== null && torso && torso > 0
        ? (((ankle.x - hip.x) * facing) / torso) * 100
        : null,
      midstanceKneeFlexionDeg: flexions.length ? Math.max(...flexions) : null,
    };
  });
}

function emptyLegSummary(reason: string): LegSummary {
  return {
    midstanceKneeFlexionDeg: unavailableMetric("deg", reason),
    footStrikeShankAngleDeg: unavailableMetric("deg", reason),
    stepTimeSec: unavailableMetric("s", reason),
    events: 0,
  };
}

function emptyGaitMetrics(reason: string): GaitMetrics {
  return {
    cadenceSpm: unavailableMetric("steps/min", reason),
    avgStepTimeSec: unavailableMetric("s", reason),
    groundContactTimeMs: unavailableMetric("ms", "Not directly measured by this video method."),
    flightTimeMs: unavailableMetric("ms", "Not directly measured by this video method."),
    dutyFactorPct: unavailableMetric("%", "Requires measured contact and flight events."),
    verticalOscillationTorsoPct: unavailableMetric("% torso", reason),
    ankleAheadOfHipTorsoPct: unavailableMetric("% torso", reason),
    footStrikeShankAngleDeg: unavailableMetric("deg", reason),
    midstanceKneeFlexionDeg: unavailableMetric("deg", reason),
    maxHipLineImageTiltDeg: unavailableMetric("deg", reason),
    stepTimeCvPct: unavailableMetric("%", reason),
    stepCount: 0,
    events: [],
    left: emptyLegSummary(reason),
    right: emptyLegSummary(reason),
    leftContacts: [],
    rightContacts: [],
  };
}

const FACING_REASON = "Running direction could not be determined, so forward and backward cannot be distinguished.";

function legSummary(leg: "left" | "right", events: FootStrikeEvent[], stepTimes: number[], facingKnown: boolean): LegSummary {
  const legEvents = events.filter((event) => event.leg === leg);
  const flexion = mean(finiteValues(legEvents.map((event) => event.midstanceKneeFlexionDeg)));
  const shank = mean(finiteValues(legEvents.map((event) => event.shankAngleDeg)));
  return {
    midstanceKneeFlexionDeg: metric(round1(flexion), "algorithmically-estimated", "deg", `Mean peak knee flexion during detected ${leg} stance phases.`),
    footStrikeShankAngleDeg: metric(
      round1(shank),
      "algorithmically-estimated",
      "deg",
      facingKnown ? `Mean ${leg} shank angle at approximate foot strike.` : FACING_REASON
    ),
    stepTimeSec: metric(mean(stepTimes), "algorithmically-estimated", "s", `Mean duration of steps ending on the ${leg} foot.`),
    events: legEvents.length,
  };
}

export function analyzeGaitCycles(
  timestamps: number[],
  leftAnkleY: (number | null)[],
  rightAnkleY: (number | null)[],
  kinematics: KinematicSequence,
  frames: FramePose[]
): GaitMetrics {
  const validAnkleY = [...finiteValues(leftAnkleY), ...finiteValues(rightAnkleY)];
  if (timestamps.length < 3 || validAnkleY.length < 6) {
    return emptyGaitMetrics("Insufficient valid ankle tracking to estimate this metric.");
  }

  const range = Math.max(...validAnkleY) - Math.min(...validAnkleY);
  if (!Number.isFinite(range) || range <= 0) {
    return emptyGaitMetrics("Ankle trajectory has no usable vertical range.");
  }

  const prominence = Math.max(1, range * 0.08);
  const leftSmooth = smoothArray(leftAnkleY, 3);
  const rightSmooth = smoothArray(rightAnkleY, 3);
  const events = [
    ...detectLegEvents("left", leftSmooth, timestamps, prominence, kinematics, frames),
    ...detectLegEvents("right", rightSmooth, timestamps, prominence, kinematics, frames),
  ].sort((a, b) => a.stanceTime - b.stanceTime);

  // Steps run between alternating-leg events; same-leg neighbours mean an event was missed.
  const steps: { duration: number; endLeg: "left" | "right"; start: FootStrikeEvent; end: FootStrikeEvent }[] = [];
  for (let index = 1; index < events.length; index++) {
    const start = events[index - 1];
    const end = events[index];
    const duration = end.stanceTime - start.stanceTime;
    if (start.leg !== end.leg && Number.isFinite(duration) && duration > 0) {
      steps.push({ duration, endLeg: end.leg, start, end });
    }
  }
  const rawMedian = median(steps.map((step) => step.duration));
  const keptSteps = rawMedian === null
    ? []
    : steps.filter((step) => step.duration >= rawMedian * 0.6 && step.duration <= rawMedian * 1.6);
  const durations = keptSteps.map((step) => step.duration);
  const hasCadence = durations.length >= MIN_INTERVALS_FOR_CADENCE;
  const medianStep = hasCadence ? median(durations) : null;
  const meanStep = hasCadence ? mean(durations) : null;
  const cadence = medianStep ? 60 / medianStep : null;
  const stepCv = durations.length >= MIN_INTERVALS_FOR_VARIATION && meanStep
    ? (Math.sqrt(durations.reduce((sum, duration) => sum + (duration - meanStep) ** 2, 0) / durations.length) / meanStep) * 100
    : null;
  const cadenceReason = "At least three alternating left/right stance events are needed for a cadence estimate.";

  // Vertical oscillation: pelvis range within each step, so slow drift across the clip is ignored.
  const torsoMedian = median(finiteValues(kinematics.torsoHeightPx));
  const stepRanges = keptSteps.flatMap((step) => {
    const values = finiteValues(kinematics.pelvisCenterY.slice(step.start.stanceFrame, step.end.stanceFrame + 1));
    return values.length >= 3 ? [Math.max(...values) - Math.min(...values)] : [];
  });
  const oscillationRange = median(stepRanges);
  const verticalOscillation = oscillationRange !== null && torsoMedian ? (oscillationRange / torsoMedian) * 100 : null;

  const facingKnown = kinematics.facingDirection !== null;
  const shanks = finiteValues(events.map((event) => event.shankAngleDeg));
  const offsets = finiteValues(events.map((event) => event.ankleAheadOfHipPct));
  const flexions = finiteValues(events.map((event) => event.midstanceKneeFlexionDeg));
  const pelvicValues = finiteValues(kinematics.hipLineImageTiltAngles);

  return {
    cadenceSpm: metric(
      hasCadence ? round1(cadence) : null,
      "algorithmically-estimated",
      "steps/min",
      hasCadence
        ? `60 / median step time over ${durations.length} alternating steps detected from ankle trajectories (sub-frame timing).`
        : cadenceReason
    ),
    avgStepTimeSec: metric(meanStep, "algorithmically-estimated", "s", hasCadence ? "Mean interval between alternating left/right stance events." : cadenceReason),
    groundContactTimeMs: unavailableMetric("ms", "Video sampling and 2D landmarks do not directly identify foot-ground contact."),
    flightTimeMs: unavailableMetric("ms", "Video sampling and 2D landmarks do not directly identify foot-ground contact."),
    dutyFactorPct: unavailableMetric("%", "Not calculated because contact and flight durations are unavailable."),
    verticalOscillationTorsoPct: metric(
      round1(verticalOscillation),
      "heuristic-estimate",
      "% torso",
      "Median per-step image-space pelvis vertical range divided by median shoulder-to-hip length; uncalibrated."
    ),
    ankleAheadOfHipTorsoPct: metric(
      offsets.length ? round1(mean(offsets)) : null,
      "algorithmically-estimated",
      "% torso",
      facingKnown
        ? "Mean horizontal distance the ankle lands ahead of the hip at approximate foot strike, relative to torso length."
        : FACING_REASON
    ),
    footStrikeShankAngleDeg: metric(
      shanks.length ? round1(mean(shanks)) : null,
      "algorithmically-estimated",
      "deg",
      facingKnown
        ? "Mean knee-to-ankle angle from vertical at approximate foot strike; positive means the ankle is ahead of the knee."
        : FACING_REASON
    ),
    midstanceKneeFlexionDeg: metric(
      flexions.length ? round1(mean(flexions)) : null,
      "algorithmically-estimated",
      "deg",
      "Mean peak knee flexion (180 deg minus the internal knee angle) within detected stance windows."
    ),
    maxHipLineImageTiltDeg: metric(
      pelvicValues.length ? round1(Math.max(...pelvicValues)) : null,
      "landmark-derived",
      "deg",
      "Maximum absolute image-plane angle of the line joining the two tracked hip landmarks."
    ),
    stepTimeCvPct: metric(
      round1(stepCv),
      "algorithmically-estimated",
      "%",
      stepCv === null
        ? `At least ${MIN_INTERVALS_FOR_VARIATION} consistent steps are needed to estimate variation.`
        : "Coefficient of variation of detected step intervals after removing missed-event outliers."
    ),
    stepCount: durations.length,
    events,
    left: legSummary("left", events, keptSteps.filter((step) => step.endLeg === "left").map((step) => step.duration), facingKnown),
    right: legSummary("right", events, keptSteps.filter((step) => step.endLeg === "right").map((step) => step.duration), facingKnown),
    leftContacts: events.filter((event) => event.leg === "left").map((event) => event.stanceFrame),
    rightContacts: events.filter((event) => event.leg === "right").map((event) => event.stanceFrame),
  };
}
