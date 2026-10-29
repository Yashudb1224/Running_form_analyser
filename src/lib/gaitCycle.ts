import { FootStrikeEvent, FramePose, GaitMetrics, KinematicSequence, Landmark, LegSummary, metric, unavailableMetric } from "../types/telemetry";
import { calculateShankAngle } from "./biomechanics";
import { mergedLegFramePct } from "./legTracking";
import { smoothArray } from "./signalProcessor";

const MIN_VISIBILITY = 0.5;
/** Fraction of the ankle's vertical range below its stance peak still treated as foot on the ground. */
const STANCE_WINDOW_FRACTION = 0.12;
const MAX_STANCE_HALF_WINDOW_SEC = 0.3;
const MIN_INTERVALS_FOR_CADENCE = 2;
const MIN_INTERVALS_FOR_VARIATION = 4;
const SMOOTHING_WINDOW = 5;
/** 0.2 s per step is 300 steps/min, faster than elite sprinting. */
const MIN_STEP_SEC = 0.2;
const MIN_PLAUSIBLE_CADENCE = 100;
const MAX_PLAUSIBLE_CADENCE = 260;

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
  prominence: number,
  /** Neighbourhood (seconds either side) used to measure prominence; defaults to 3 samples. */
  prominenceWindowSec?: number
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

    const neighborhood = prominenceWindowSec === undefined
      ? finiteValues(data.slice(Math.max(0, peakIndex - 3), Math.min(data.length, peakIndex + 4)))
      : finiteValues(data.filter((_, index) => Math.abs(timestamps[index] - time) <= prominenceWindowSec));
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

/**
 * Builds one foot-contact event at a peak of the contact signal for the given leg: the stance window
 * around it, approximate foot strike, midstance knee flexion, shank angle and landing offset.
 */
function buildContactEvent(
  leg: "left" | "right",
  peak: number,
  contactSignal: (number | null)[],
  stanceThresholdDrop: number,
  timestamps: number[],
  kinematics: KinematicSequence,
  frames: FramePose[]
): FootStrikeEvent {
  const kneeAngles = leg === "left" ? kinematics.leftKneeAngles : kinematics.rightKneeAngles;
  const kneeIndex = leg === "left" ? 25 : 26;
  const ankleIndex = leg === "left" ? 27 : 28;
  const facing = kinematics.facingDirection;
  const threshold = (contactSignal[peak] as number) - stanceThresholdDrop;
  const inStance = (index: number) => {
    const value = contactSignal[index];
    return value !== null && value >= threshold && Math.abs(timestamps[index] - timestamps[peak]) <= MAX_STANCE_HALF_WINDOW_SEC;
  };
  let strikeFrame = peak;
  while (strikeFrame > 0 && inStance(strikeFrame - 1)) strikeFrame--;
  let toeOffFrame = peak;
  while (toeOffFrame < contactSignal.length - 1 && inStance(toeOffFrame + 1)) toeOffFrame++;

  let maxFlexion: number | null = null;
  let midstanceFrame = peak;
  for (let index = strikeFrame; index <= toeOffFrame; index++) {
    const angle = kneeAngles[index];
    if (angle === null || angle === undefined || !Number.isFinite(angle)) continue;
    if (maxFlexion === null || 180 - angle > maxFlexion) {
      maxFlexion = 180 - angle;
      midstanceFrame = index;
    }
  }
  const strike = frames[strikeFrame];
  const rawShank = calculateShankAngle(strike?.landmarks[kneeIndex], strike?.landmarks[ankleIndex]);
  const ankle = strike?.landmarks[ankleIndex];
  const hip = hipCenterAt(strike, leg);
  const torso = kinematics.torsoHeightPx[strikeFrame];

  return {
    leg,
    side: leg,
    stanceFrame: peak,
    stanceTime: refinePeakTime(contactSignal, timestamps, peak),
    strikeFrame,
    midstanceFrame,
    shankAngleDeg: rawShank === null || facing === null ? null : rawShank * facing,
    ankleAheadOfHipPct: validPoint(ankle) && hip && facing !== null && torso && torso > 0
      ? (((ankle.x - hip.x) * facing) / torso) * 100
      : null,
    midstanceKneeFlexionDeg: maxFlexion,
  };
}

/**
 * Assigns each contact to a physical leg. Feet always alternate, so within a run of evenly spaced
 * contacts every other contact is the same leg, whatever the pose model labelled it. A gap longer
 * than 1.5 steps (a missed contact) starts a new run, because the alternation may have slipped.
 * Each run's two alternating groups are named left/right by majority vote of the landmark labels.
 */
export function assignSides(events: Pick<FootStrikeEvent, "leg" | "stanceTime">[]): ("left" | "right")[] {
  if (!events.length) return [];
  const intervals = events.slice(1).map((event, index) => event.stanceTime - events[index].stanceTime);
  const typicalStep = median(intervals.filter((interval) => interval > 0)) ?? Infinity;
  const sides: ("left" | "right")[] = new Array(events.length);
  let runStart = 0;
  const closeRun = (runEnd: number) => {
    let vote = 0;
    for (let index = runStart; index <= runEnd; index++) {
      const parityIsEven = (index - runStart) % 2 === 0;
      vote += (events[index].leg === "left") === parityIsEven ? 1 : -1;
    }
    const evenSide = vote >= 0 ? "left" : "right";
    const oddSide = evenSide === "left" ? "right" : "left";
    for (let index = runStart; index <= runEnd; index++) sides[index] = (index - runStart) % 2 === 0 ? evenSide : oddSide;
  };
  for (let index = 1; index < events.length; index++) {
    if (intervals[index - 1] > typicalStep * 1.5) {
      closeRun(index - 1);
      runStart = index;
    }
  }
  closeRun(events.length - 1);
  return sides;
}

function emptyLegSummary(reason: string): LegSummary {
  return {
    midstanceKneeFlexionDeg: unavailableMetric("deg", reason),
    footStrikeShankAngleDeg: unavailableMetric("deg", reason),
    stepTimeSec: unavailableMetric("s", reason),
    landingOffsetTorsoPct: unavailableMetric("% torso", reason),
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
    strideTimeCvPct: unavailableMetric("%", reason),
    stepCount: 0,
    strideCount: 0,
    medianStrideSec: null,
    events: [],
    mergedLegFramesPct: null,
    left: emptyLegSummary(reason),
    right: emptyLegSummary(reason),
    leftContacts: [],
    rightContacts: [],
  };
}

const FACING_REASON = "Running direction could not be determined, so forward and backward cannot be distinguished.";

function legSummary(leg: "left" | "right", events: FootStrikeEvent[], stepTimes: number[], facingKnown: boolean): LegSummary {
  const legEvents = events.filter((event) => event.side === leg);
  const offset = mean(finiteValues(legEvents.map((event) => event.ankleAheadOfHipPct)));
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
    landingOffsetTorsoPct: metric(
      round1(offset),
      "algorithmically-estimated",
      "% torso",
      facingKnown ? `Mean distance the ${leg} foot lands ahead of the hips, relative to torso length.` : FACING_REASON
    ),
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
  const leftSmooth = smoothArray(leftAnkleY, SMOOTHING_WINDOW);
  const rightSmooth = smoothArray(rightAnkleY, SMOOTHING_WINDOW);

  // Contacts are found on a label-free signal: the lower of the two ankles in each frame (larger image
  // y). It is identical whether or not the pose model swapped the legs, and peaks once per landing.
  // Each landing is then attributed to whichever ankle is lower at that moment.
  // Combine before smoothing so a label flip never blends the two feet inside the smoothing window.
  const contactSignal = smoothArray(leftAnkleY.map((left, index) => {
    const right = rightAnkleY[index];
    if (left === null || !Number.isFinite(left)) return right;
    if (right === null || !Number.isFinite(right)) return left;
    return Math.max(left, right);
  }), SMOOTHING_WINDOW);
  const ankleRange = percentile(validAnkleY, 0.95) - percentile(validAnkleY, 0.05);
  const events = findPeaks(contactSignal, timestamps, MIN_STEP_SEC * 0.9, prominence, MIN_STEP_SEC).map((peak) => {
    const left = leftSmooth[peak];
    const right = rightSmooth[peak];
    const leg = right !== null && (left === null || right > left) ? "right" as const : "left" as const;
    return buildContactEvent(leg, peak, contactSignal, STANCE_WINDOW_FRACTION * ankleRange, timestamps, kinematics, frames);
  });
  assignSides(events).forEach((side, index) => {
    events[index].side = side;
  });

  // Steps run between alternating-leg events; same-leg neighbours mean an event was missed.
  const steps: { duration: number; endLeg: "left" | "right"; start: FootStrikeEvent; end: FootStrikeEvent }[] = [];
  for (let index = 1; index < events.length; index++) {
    const start = events[index - 1];
    const end = events[index];
    const duration = end.stanceTime - start.stanceTime;
    if (start.side !== end.side && Number.isFinite(duration) && duration > 0) {
      steps.push({ duration, endLeg: end.side, start, end });
    }
  }
  const rawMedian = median(steps.map((step) => step.duration));
  const keptSteps = rawMedian === null
    ? []
    : steps.filter((step) => step.duration >= rawMedian * 0.6 && step.duration <= rawMedian * 1.6);
  const durations = keptSteps.map((step) => step.duration);

  // A stride is measured from each contact to the contact after next, ignoring leg labels. That spans
  // one contact of each foot, so a constant timing error on one leg (typical for the partly hidden far
  // leg) cancels out, and left/right label swaps by the pose model cannot affect it. Left-to-right
  // step intervals, by contrast, alternate short/long under such an error.
  const strides: number[] = [];
  for (let index = 2; index < events.length; index++) {
    const duration = events[index].stanceTime - events[index - 2].stanceTime;
    if (Number.isFinite(duration) && duration > 0) strides.push(duration);
  }
  const rawStrideMedian = median(strides);
  // A missed contact turns a stride into three steps (1.5x) and an extra one into a single step (0.5x).
  const keptStrides = rawStrideMedian === null
    ? []
    : strides.filter((duration) => duration >= rawStrideMedian * 0.7 && duration <= rawStrideMedian * 1.3);

  const useStrides = keptStrides.length >= MIN_INTERVALS_FOR_CADENCE;
  const enoughSteps = useStrides || durations.length >= MIN_INTERVALS_FOR_CADENCE;
  const medianStepTime = useStrides
    ? (median(keptStrides) as number) / 2
    : enoughSteps ? median(durations) : null;
  const rawCadence = medianStepTime ? 60 / medianStepTime : null;
  const plausible = rawCadence !== null && rawCadence >= MIN_PLAUSIBLE_CADENCE && rawCadence <= MAX_PLAUSIBLE_CADENCE;
  const hasCadence = enoughSteps && plausible;
  const cadence = hasCadence ? rawCadence : null;
  const meanStep = !hasCadence ? null : useStrides ? (mean(keptStrides) as number) / 2 : mean(durations);
  const meanStride = mean(keptStrides);
  const strideCv = hasCadence && keptStrides.length >= MIN_INTERVALS_FOR_VARIATION && meanStride
    ? (Math.sqrt(keptStrides.reduce((sum, duration) => sum + (duration - meanStride) ** 2, 0) / keptStrides.length) / meanStride) * 100
    : null;
  const cadenceReason = enoughSteps && !plausible
    ? `The detected step rate (${rawCadence?.toFixed(0)} steps/min) is outside the plausible ${MIN_PLAUSIBLE_CADENCE}-${MAX_PLAUSIBLE_CADENCE} range, which indicates unreliable foot tracking.`
    : "At least four foot contacts are needed for a cadence estimate.";
  // Implausible timing means the events are not real steps, so nothing step-based is reported.
  const usableSteps = hasCadence ? keptSteps : [];

  // Vertical oscillation: pelvis range within each step, so slow drift across the clip is ignored.
  const torsoMedian = median(finiteValues(kinematics.torsoHeightPx));
  const stepRanges = usableSteps.flatMap((step) => {
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
  const mergedLegs = mergedLegFramePct(frames, kinematics.torsoHeightPx);

  return {
    cadenceSpm: metric(
      hasCadence ? round1(cadence) : null,
      "algorithmically-estimated",
      "steps/min",
      hasCadence
        ? useStrides
          ? `120 / median stride time over ${keptStrides.length} strides (each contact to the contact after next) detected from ankle trajectories with sub-frame timing.`
          : `60 / median step time over ${durations.length} alternating steps detected from ankle trajectories (sub-frame timing).`
        : cadenceReason
    ),
    avgStepTimeSec: metric(meanStep, "algorithmically-estimated", "s", hasCadence ? "Mean step time (half the mean stride time)." : cadenceReason),
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
    strideTimeCvPct: metric(
      round1(strideCv),
      "algorithmically-estimated",
      "%",
      strideCv === null
        ? `At least ${MIN_INTERVALS_FOR_VARIATION} consistent strides are needed to estimate variation.`
        : "Coefficient of variation of stride times (each contact to the contact after next) after removing missed-contact outliers."
    ),
    stepCount: usableSteps.length,
    strideCount: hasCadence ? keptStrides.length : 0,
    medianStrideSec: hasCadence && useStrides ? median(keptStrides) : null,
    events,
    mergedLegFramesPct: mergedLegs === null ? null : round1(mergedLegs),
    left: legSummary("left", events, usableSteps.filter((step) => step.endLeg === "left").map((step) => step.duration), facingKnown),
    right: legSummary("right", events, usableSteps.filter((step) => step.endLeg === "right").map((step) => step.duration), facingKnown),
    leftContacts: events.filter((event) => event.side === "left").map((event) => event.stanceFrame),
    rightContacts: events.filter((event) => event.side === "right").map((event) => event.stanceFrame),
  };
}
