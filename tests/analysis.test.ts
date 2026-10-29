import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCameraView,
  calculate2DAngle,
  calculatePelvicTilt,
  calculateShankAngle,
  computeSequenceKinematics,
  detectFacingDirection,
} from "../src/lib/biomechanics";
import { analyzeGaitCycles, assignSides, findPeaks, refinePeakTime } from "../src/lib/gaitCycle";
import { calculateFormScore } from "../src/lib/formScorer";
import { getMetricComparisons } from "../src/lib/metricComparison";
import { createPdfReport, formatPdfMetric } from "../src/lib/pdfReport";
import { evaluateSymmetryAndConsistency, symmetryIndex } from "../src/lib/symmetryAnalyzer";
import { buildAnalysisQuality } from "../src/lib/analysisQuality";
import { selectEvidenceMoments } from "../src/lib/evidenceFrames";
import { correctLegSwaps, mergedLegFramePct } from "../src/lib/legTracking";
import { REFERENCE_RANGES, MIN_COMPONENT_SCORE, getReferencePosition, scoreAgainstReference } from "../src/lib/researchReferences";
import { convertMediaPipeLandmarks, createUnavailableFrame, hasSufficientTrackingCoverage } from "../src/lib/poseEstimator";
import { CompleteAnalysisReport, FramePose, GaitMetrics, KinematicSequence, Landmark, metric } from "../src/types/telemetry";

const landmark = (x: number, y: number, visibility = 0.99): Landmark => ({ x, y, z: 0, visibility });

function emptyKinematics(length = 0): KinematicSequence {
  const missing = () => Array.from({ length }, () => null);
  return {
    leftKneeAngles: missing(),
    rightKneeAngles: missing(),
    leftHipAngles: missing(),
    rightHipAngles: missing(),
    leftElbowAngles: missing(),
    rightElbowAngles: missing(),
    trunkImagePlaneAngles: missing(),
    trunkForwardLeanAngles: missing(),
    hipLineImageTiltAngles: missing(),
    leftAnkleY: missing(),
    rightAnkleY: missing(),
    pelvisCenterY: missing(),
    torsoHeightPx: missing(),
    facingDirection: null,
  };
}

/** Side-view runner facing +x: nose ahead of ears, toes ahead of heels, shoulders slightly ahead of hips. */
function sideViewFrame(index: number, timestamp: number, options: { leftAnkleY?: number; rightAnkleY?: number; facing?: 1 | -1 } = {}): FramePose {
  const facing = options.facing ?? 1;
  const cx = 300;
  const points: (Landmark | null)[] = Array.from({ length: 33 }, () => landmark(cx, 300));
  points[0] = landmark(cx + 20 * facing, 100);
  points[7] = landmark(cx, 102);
  points[8] = landmark(cx + 2, 102);
  points[11] = landmark(cx + 18 * facing, 150);
  points[12] = landmark(cx + 22 * facing, 150);
  points[23] = landmark(cx, 300);
  points[24] = landmark(cx + 4, 300);
  points[25] = landmark(cx + 10 * facing, 400);
  points[26] = landmark(cx + 12 * facing, 400);
  points[27] = landmark(cx + 20 * facing, options.leftAnkleY ?? 500);
  points[28] = landmark(cx + 22 * facing, options.rightAnkleY ?? 500);
  points[29] = landmark(cx + 10 * facing, 510);
  points[30] = landmark(cx + 12 * facing, 510);
  points[31] = landmark(cx + 40 * facing, 512);
  points[32] = landmark(cx + 42 * facing, 512);
  return { frameIndex: index, timestamp, landmarks: points, tracked: true, meanVisibility: 0.99 };
}

function reportFrom(kinematics: KinematicSequence, gait: GaitMetrics, frames: FramePose[], sufficient: boolean): CompleteAnalysisReport {
  const symmetry = evaluateSymmetryAndConsistency(kinematics, gait);
  const formScore = calculateFormScore(kinematics, gait, symmetry, sufficient);
  const quality = buildAnalysisQuality(frames, kinematics, gait, { samplingRateFps: 30, sourceDurationSec: 1 });
  return {
    totalFrames: frames.length,
    fps: 30,
    durationSec: 1,
    videoWidth: 640,
    videoHeight: 480,
    frames,
    kinematics,
    gait,
    symmetry,
    formScore,
    quality: { ...quality, sufficientForSummary: sufficient },
    evidence: [],
  };
}

test("internal knee geometry reports a straight configuration near 180 degrees", () => {
  assert.equal(calculate2DAngle(landmark(0, 0), landmark(1, 0), landmark(2, 0)), 180);
});

test("joint angles are unavailable for low visibility, missing, and degenerate landmarks", () => {
  assert.equal(calculate2DAngle(landmark(0, 0, 0.2), landmark(1, 0), landmark(2, 0)), null);
  assert.equal(calculate2DAngle(null, landmark(1, 0), landmark(2, 0)), null);
  assert.equal(calculate2DAngle(landmark(1, 0), landmark(1, 0), landmark(2, 0)), null);
});

test("hip-line image tilt is invariant to left/right screen orientation", () => {
  const uprightSlope = calculatePelvicTilt(landmark(0, 0), landmark(10, 5));
  const mirroredSlope = calculatePelvicTilt(landmark(10, 5), landmark(0, 0));
  assert.ok(uprightSlope !== null && mirroredSlope !== null);
  assert.ok(Math.abs(uprightSlope - mirroredSlope) < 1e-10);
  assert.ok(Math.abs(uprightSlope - 26.565051177) < 1e-6);
});

test("shank angle is positive when the ankle is at larger x than the knee", () => {
  const angle = calculateShankAngle(landmark(0, 0), landmark(10, 100));
  assert.ok(angle !== null && Math.abs(angle - 5.7106) < 1e-3);
  assert.ok((calculateShankAngle(landmark(0, 0), landmark(-10, 100)) ?? 0) < 0);
});

test("non-finite metric values become unavailable rather than retaining measured provenance", () => {
  const invalid = metric(Number.NaN, "landmark-derived", "deg", "invalid value");
  assert.equal(invalid.value, null);
  assert.equal(invalid.status, "unavailable");
});

test("missing pose frames remain missing through kinematic calculation", () => {
  const frame = createUnavailableFrame(0, 0);
  const sequence = computeSequenceKinematics([frame]);
  assert.equal(frame.tracked, false);
  assert.equal(frame.landmarks[25], null);
  assert.equal(sequence.leftKneeAngles[0], null);
  assert.equal(sequence.trunkImagePlaneAngles[0], null);
  assert.equal(sequence.facingDirection, null);
});

test("facing direction is detected and forward lean is signed by it", () => {
  const right = Array.from({ length: 5 }, (_, index) => sideViewFrame(index, index / 30, { facing: 1 }));
  const left = Array.from({ length: 5 }, (_, index) => sideViewFrame(index, index / 30, { facing: -1 }));
  assert.equal(detectFacingDirection(right), 1);
  assert.equal(detectFacingDirection(left), -1);
  const rightLean = computeSequenceKinematics(right).trunkForwardLeanAngles[0];
  const leftLean = computeSequenceKinematics(left).trunkForwardLeanAngles[0];
  assert.ok(rightLean !== null && rightLean > 0);
  assert.ok(leftLean !== null && leftLean > 0);
});

test("camera view classification separates side-on from frontal recordings", () => {
  const side = [sideViewFrame(0, 0)];
  assert.equal(assessCameraView(side).view, "side");
  const frontal = sideViewFrame(0, 0);
  frontal.landmarks[11] = landmark(240, 150);
  frontal.landmarks[12] = landmark(360, 150);
  frontal.landmarks[23] = landmark(260, 300);
  frontal.landmarks[24] = landmark(340, 300);
  assert.equal(assessCameraView([frontal]).view, "front-or-back");
});

test("tracking quality gate requires most frames to have core landmarks", () => {
  const unavailable = createUnavailableFrame(0, 0);
  const validPoints = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  const tracked = convertMediaPipeLandmarks(validPoints, 1, 0.1, 640, 480);
  assert.equal(hasSufficientTrackingCoverage([tracked]), true);
  assert.equal(hasSufficientTrackingCoverage([tracked, unavailable]), false);
  assert.equal(hasSufficientTrackingCoverage([...Array.from({ length: 9 }, () => tracked), unavailable]), true);
  assert.equal(hasSufficientTrackingCoverage([]), false);
});

test("MediaPipe conversion does not promote absent or low-visibility landmarks to valid tracking", () => {
  const missing = convertMediaPipeLandmarks(undefined, 0, 0, 640, 480);
  assert.equal(missing.tracked, false);
  assert.equal(missing.meanVisibility, null);
  assert.equal(missing.landmarks[27], null);

  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  points[27] = { x: 0.5, y: 0.5, z: 0, visibility: 0.1 };
  const partial = convertMediaPipeLandmarks(points, 1, 0.1, 640, 480);
  assert.equal(partial.tracked, false);
  assert.equal(partial.landmarks[27]?.visibility, 0.1);
});

test("peak detection uses actual timestamps and respects event separation", () => {
  const times = Array.from({ length: 40 }, (_, index) => index / 10);
  const values = times.map((_, index) => [3, 9, 15, 21, 27, 33].includes(index) ? 10 : 0);
  const peaks = findPeaks(values, times, 0.25, 1);
  assert.deepEqual(peaks, [3, 9, 15, 21, 27, 33]);
});

test("parabolic refinement recovers a peak between samples", () => {
  const times = [0, 1 / 30, 2 / 30];
  const truePeak = 1 / 30 + 0.01;
  const values = times.map((time) => 100 - ((time - truePeak) * 1000) ** 2);
  assert.ok(Math.abs(refinePeakTime(values, times, 1) - truePeak) < 1e-6);
});

test("gait analysis does not manufacture cadence or contact times without events", () => {
  const gait = analyzeGaitCycles([], [], [], emptyKinematics(), []);
  assert.equal(gait.cadenceSpm.value, null);
  assert.equal(gait.avgStepTimeSec.value, null);
  assert.equal(gait.groundContactTimeMs.value, null);
  assert.equal(gait.verticalOscillationTorsoPct.value, null);
  assert.equal(gait.stepCount, 0);
});

test("cadence from a 30 fps ankle trajectory is accurate to within 1 step/min", () => {
  const cadence = 172;
  const strideSec = 120 / cadence;
  const times = Array.from({ length: 300 }, (_, index) => index / 30);
  const left = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec));
  const right = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec + Math.PI));
  const gait = analyzeGaitCycles(times, left, right, emptyKinematics(times.length), []);
  assert.ok(gait.cadenceSpm.value !== null);
  assert.ok(Math.abs(gait.cadenceSpm.value - cadence) < 1, `cadence ${gait.cadenceSpm.value}`);
  assert.equal(gait.cadenceSpm.status, "algorithmically-estimated");
  assert.ok(gait.stepCount >= 10);
  assert.ok(gait.strideTimeCvPct.value !== null && gait.strideTimeCvPct.value < 2);
  assert.equal(gait.groundContactTimeMs.value, null);
});

test("missed events do not halve the cadence estimate", () => {
  const times = Array.from({ length: 300 }, (_, index) => index / 30);
  const strideSec = 120 / 170;
  const left = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec));
  const right = times.map((time, index) =>
    index > 120 && index < 150 ? null : 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec + Math.PI)
  );
  const gait = analyzeGaitCycles(times, left, right, emptyKinematics(times.length), []);
  assert.ok(gait.cadenceSpm.value !== null && Math.abs(gait.cadenceSpm.value - 170) < 2);
});

test("foot-strike events report shank angle, knee flexion and landing offset in the running direction", () => {
  const strideSec = 0.7;
  const frames = Array.from({ length: 150 }, (_, index) => {
    const time = index / 30;
    return sideViewFrame(index, time, {
      leftAnkleY: 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec),
      rightAnkleY: 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec + Math.PI),
    });
  });
  const kinematics = computeSequenceKinematics(frames);
  const gait = analyzeGaitCycles(frames.map((frame) => frame.timestamp), kinematics.leftAnkleY, kinematics.rightAnkleY, kinematics, frames);
  assert.ok(gait.events.length >= 6);
  assert.ok(gait.footStrikeShankAngleDeg.value !== null && gait.footStrikeShankAngleDeg.value > 0);
  assert.ok(gait.midstanceKneeFlexionDeg.value !== null && gait.midstanceKneeFlexionDeg.value >= 0);
  assert.ok(gait.ankleAheadOfHipTorsoPct.value !== null && gait.ankleAheadOfHipTorsoPct.value > 0);
  assert.ok(gait.left.events > 0 && gait.right.events > 0);
});

test("symmetry index compares per-leg events and flags differences over 10%", () => {
  assert.equal(symmetryIndex(40, 40), 0);
  assert.ok(Math.abs((symmetryIndex(44, 40) ?? 0) - 9.5238) < 1e-3);
  assert.equal(symmetryIndex(null, 40), null);
  const gait = analyzeGaitCycles([], [], [], emptyKinematics(), []);
  gait.left.midstanceKneeFlexionDeg = metric(45, "algorithmically-estimated", "deg", "test");
  gait.right.midstanceKneeFlexionDeg = metric(36, "algorithmically-estimated", "deg", "test");
  gait.left.stepTimeSec = metric(0.36, "algorithmically-estimated", "s", "test");
  gait.right.stepTimeSec = metric(0.36, "algorithmically-estimated", "s", "test");
  gait.left.landingOffsetTorsoPct = metric(44, "algorithmically-estimated", "% torso", "test");
  gait.right.landingOffsetTorsoPct = metric(40, "algorithmically-estimated", "% torso", "test");
  const symmetry = evaluateSymmetryAndConsistency(emptyKinematics(), gait);
  assert.equal(symmetry.kneeFlexionSymmetryIndexPct.value, 22.2, "knee flexion SI is reported");
  assert.equal(symmetry.stepTimeSymmetryIndexPct.value, 0);
  assert.equal(symmetry.landingOffsetSymmetryIndexPct.value, 9.5);
  // Scored from the mean of step time (0%) and landing (9.52%), not from knee flexion.
  assert.equal(symmetry.symmetryIndexPct.value, 4.8);
  assert.equal(symmetry.symmetryScore.value, 100);
});

test("reference scoring is 100 inside the band and decreases outside it", () => {
  const cadence = REFERENCE_RANGES.cadence;
  assert.equal(scoreAgainstReference(cadence, 170), 100);
  assert.equal(scoreAgainstReference(cadence, cadence.minimum), 100);
  assert.equal(scoreAgainstReference(cadence, cadence.minimum - 5), 100 - 5 * cadence.penaltyPerUnit);
  assert.equal(scoreAgainstReference(cadence, 20), MIN_COMPONENT_SCORE);
  assert.equal(getReferencePosition(cadence, 150), "below");
  assert.equal(getReferencePosition(cadence, 200), "above");
  for (const reference of Object.values(REFERENCE_RANGES)) {
    assert.ok(reference.citations.length > 0, `${reference.id} must cite a source`);
    assert.ok(reference.minimum < reference.maximum);
  }
});

test("unavailable inputs cannot become perfect scores", () => {
  const gait = analyzeGaitCycles([], [], [], emptyKinematics(), []);
  const symmetry = evaluateSymmetryAndConsistency(emptyKinematics(), gait);
  const score = calculateFormScore(emptyKinematics(), gait, symmetry, true);
  assert.equal(symmetry.symmetryScore.value, null);
  assert.equal(symmetry.consistencyScore.value, null);
  assert.equal(score.overallScore.value, null);
});

test("the composite is withheld below the quality gate and computed above it", () => {
  const kinematics = emptyKinematics(2);
  kinematics.facingDirection = 1;
  kinematics.trunkForwardLeanAngles = [8, 9];
  const gait = {
    ...analyzeGaitCycles([], [], [], kinematics, []),
    cadenceSpm: metric(170, "algorithmically-estimated", "steps/min", "test"),
    midstanceKneeFlexionDeg: metric(42, "algorithmically-estimated", "deg", "test"),
    footStrikeShankAngleDeg: metric(14, "algorithmically-estimated", "deg", "test"),
  };
  const symmetry = evaluateSymmetryAndConsistency(kinematics, gait);
  assert.equal(calculateFormScore(kinematics, gait, symmetry, false).overallScore.value, null);
  const score = calculateFormScore(kinematics, gait, symmetry, true);
  assert.equal(score.subScores.posture.value, 100);
  assert.equal(score.subScores.footStrike.value, 100 - 6 * REFERENCE_RANGES.footStrikeShank.penaltyPerUnit);
  assert.ok(score.overallScore.value !== null && score.overallScore.value < 100);
  assert.ok(score.observations.some((note) => note.startsWith("Shank angle at foot strike")));
});

test("metric comparisons use cited reference ranges and mark unreferenced metrics as observed only", () => {
  const kinematics = emptyKinematics(2);
  kinematics.facingDirection = 1;
  kinematics.trunkForwardLeanAngles = [8, 9];
  const gait = {
    ...analyzeGaitCycles([], [], [], kinematics, []),
    cadenceSpm: metric(155, "algorithmically-estimated", "steps/min", "test"),
  };
  const frames = [createUnavailableFrame(0, 0), createUnavailableFrame(1, 0.1)];
  const comparisons = getMetricComparisons(reportFrom(kinematics, gait, frames, true));

  assert.equal(comparisons.length, 8);
  assert.equal(comparisons[0].referenceText, "160-185 steps/min");
  assert.equal(comparisons[0].position, "below");
  assert.equal(comparisons[0].score?.value, scoreAgainstReference(REFERENCE_RANGES.cadence, 155));
  assert.equal(comparisons[3].observed.value, 8.5);
  assert.equal(comparisons[3].position, "within");
  assert.equal(comparisons[6].reference, null);
  assert.equal(comparisons[6].position, "unavailable");
});

test("PDF values preserve unavailable and estimated metric values", () => {
  assert.equal(formatPdfMetric(metric(null, "unavailable", "steps/min", "not enough events")), "Unavailable");
  assert.equal(
    formatPdfMetric({ value: 172, status: "algorithmically-estimated", unit: "steps/min", explanation: "test" }),
    "172 steps/min"
  );
});

test("PDF report contains a structured summary, kinematic traces and references", () => {
  const kinematics = emptyKinematics(2);
  const gait = analyzeGaitCycles([], [], [], kinematics, []);
  const frames = [createUnavailableFrame(0, 0), createUnavailableFrame(1, 0.1)];
  const pdf = createPdfReport(reportFrom(kinematics, gait, frames, false), "test.mp4");
  assert.equal(pdf.getNumberOfPages(), 2);
  const output = pdf.output();
  assert.ok(output.length > 1000);
  assert.ok(output.includes("METRIC COMPARISON"));
  assert.ok(output.includes("RESEARCH REFERENCE"));
  assert.ok(output.includes("REFERENCES"));
});

test("evidence moments pick the most representative foot strike, midstance and trunk frame", () => {
  const strideSec = 0.7;
  const frames = Array.from({ length: 150 }, (_, index) => {
    const time = index / 30;
    return sideViewFrame(index, time, {
      leftAnkleY: 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec),
      rightAnkleY: 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec + Math.PI),
    });
  });
  const kinematics = computeSequenceKinematics(frames);
  const gait = analyzeGaitCycles(frames.map((frame) => frame.timestamp), kinematics.leftAnkleY, kinematics.rightAnkleY, kinematics, frames);
  const moments = selectEvidenceMoments({ frames, kinematics, gait });
  assert.deepEqual(moments.map((moment) => moment.id), ["foot-strike-left", "foot-strike-right", "midstance-left", "midstance-right", "trunk-lean"]);
  const leftStrikes = gait.events.filter((event) => event.leg === "left" && event.shankAngleDeg !== null);
  assert.ok(leftStrikes.some((event) => event.strikeFrame === moments[0].frameIndex));
  for (const event of gait.events) {
    assert.ok(event.midstanceFrame >= event.strikeFrame);
  }
});

test("evidence selection returns nothing when no events or lean were measured", () => {
  const gait = analyzeGaitCycles([], [], [], emptyKinematics(), []);
  assert.deepEqual(selectEvidenceMoments({ frames: [], kinematics: emptyKinematics(), gait }), []);
});

function runningFrames(count: number, strideSec: number, options: { swapFrom?: number; mergeLegs?: boolean } = {}): FramePose[] {
  return Array.from({ length: count }, (_, index) => {
    const time = (index + 0.5) / 30;
    const phase = (2 * Math.PI * time) / strideSec;
    const frame = sideViewFrame(index, time, {
      leftAnkleY: 500 + 40 * Math.cos(phase),
      rightAnkleY: 500 + 40 * Math.cos(phase + Math.PI),
    });
    // Legs swing forward and back out of phase, like a real side view.
    frame.landmarks[25] = landmark(300 + 40 * Math.sin(phase), 400);
    frame.landmarks[26] = landmark(300 - 40 * Math.sin(phase), 400);
    frame.landmarks[27] = landmark(320 + 80 * Math.sin(phase), 500 + 40 * Math.cos(phase));
    frame.landmarks[28] = landmark(320 - 80 * Math.sin(phase), 500 + 40 * Math.cos(phase + Math.PI));
    if (options.mergeLegs) {
      for (const [left, right] of [[25, 26], [27, 28], [29, 30], [31, 32]]) frame.landmarks[right] = frame.landmarks[left];
    }
    if (options.swapFrom !== undefined && index >= options.swapFrom) {
      for (const [left, right] of [[25, 26], [27, 28], [29, 30], [31, 32]]) {
        const swap = frame.landmarks[left];
        frame.landmarks[left] = frame.landmarks[right];
        frame.landmarks[right] = swap;
      }
    }
    return frame;
  });
}

function gaitFor(frames: FramePose[]) {
  const kinematics = computeSequenceKinematics(frames);
  return analyzeGaitCycles(frames.map((frame) => frame.timestamp), kinematics.leftAnkleY, kinematics.rightAnkleY, kinematics, frames);
}

test("a persistent left/right swap by the pose model is detected and undone", () => {
  const clean = runningFrames(150, 0.72);
  const swapped = runningFrames(150, 0.72, { swapFrom: 40 });
  const { frames, swapEpisodes } = correctLegSwaps(swapped);
  assert.equal(swapEpisodes, 1);
  assert.deepEqual(frames[100].landmarks[27], clean[100].landmarks[27]);
  assert.deepEqual(frames[100].landmarks[28], clean[100].landmarks[28]);
  assert.equal(correctLegSwaps(clean).swapEpisodes, 0);
});

test("both legs tracked on one leg does not multiply the cadence and withholds symmetry", () => {
  const frames = runningFrames(240, 120 / 170, { mergeLegs: true });
  const gait = gaitFor(frames);
  assert.ok(gait.cadenceSpm.value === null || gait.cadenceSpm.value < 200, `cadence ${gait.cadenceSpm.value}`);
  assert.ok((gait.mergedLegFramesPct ?? 0) > 50);
  const symmetry = evaluateSymmetryAndConsistency(computeSequenceKinematics(frames), gait);
  assert.equal(symmetry.symmetryScore.value, null);
  assert.ok(mergedLegFramePct(runningFrames(60, 0.7), computeSequenceKinematics(runningFrames(60, 0.7)).torsoHeightPx)! < 30);
});

test("duplicate contacts seen in both ankle tracks are merged into one step", () => {
  const times = Array.from({ length: 300 }, (_, index) => (index + 0.5) / 30);
  const strideSec = 120 / 170;
  const left = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec));
  const right = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec + Math.PI));
  // Each ankle track also shows a faint copy of the other foot's landing 0.1 s later.
  const echo = (own: number[], other: number[]) => own.map((value, index) => Math.max(value, (other[index - 3] ?? 0) - 2));
  const gait = analyzeGaitCycles(times, echo(left, right), echo(right, left), emptyKinematics(times.length), []);
  assert.ok(gait.cadenceSpm.value !== null && Math.abs(gait.cadenceSpm.value - 170) < 3, `cadence ${gait.cadenceSpm.value}`);
});

test("implausible step rates are reported as unavailable rather than as a number", () => {
  const times = Array.from({ length: 300 }, (_, index) => (index + 0.5) / 30);
  const strideSec = 0.42; // 0.21 s steps -> 286 steps/min
  const left = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec));
  const right = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec + Math.PI));
  const gait = analyzeGaitCycles(times, left, right, emptyKinematics(times.length), []);
  assert.equal(gait.cadenceSpm.value, null);
  assert.match(gait.cadenceSpm.explanation, /plausible/);
  assert.equal(gait.strideTimeCvPct.value, null);
});

test("a constant timing offset on the far leg does not inflate stride variation or the symmetry score", () => {
  const times = Array.from({ length: 300 }, (_, index) => (index + 0.5) / 30);
  const strideSec = 120 / 175;
  const left = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec));
  // Right contacts detected 60 ms late every time: steps alternate ~0.28 s / ~0.40 s.
  const right = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * (time - 0.06)) / strideSec + Math.PI));
  const gait = analyzeGaitCycles(times, left, right, emptyKinematics(times.length), []);
  assert.ok(gait.cadenceSpm.value !== null && Math.abs(gait.cadenceSpm.value - 175) < 1.5, `cadence ${gait.cadenceSpm.value}`);
  assert.ok(gait.strideTimeCvPct.value !== null && gait.strideTimeCvPct.value < 2, `cv ${gait.strideTimeCvPct.value}`);
  assert.ok(gait.medianStrideSec !== null && Math.abs(gait.medianStrideSec - strideSec) < 0.01);
  const symmetry = evaluateSymmetryAndConsistency(emptyKinematics(times.length), gait);
  // The right foot really does land 60 ms late in this signal, so step-time asymmetry is reported and scored.
  assert.ok((symmetry.stepTimeSymmetryIndexPct.value ?? 0) > 20, "step-time SI reflects the offset");
  assert.ok(symmetry.symmetryScore.value !== null && symmetry.symmetryScore.value < 100);
});

test("stride timing ignores leg labels, so mislabelled contacts do not distort cadence or variation", () => {
  const times = Array.from({ length: 300 }, (_, index) => (index + 0.5) / 30);
  const strideSec = 120 / 175;
  const left = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * time) / strideSec));
  const right = times.map((time) => 500 + 40 * Math.cos((2 * Math.PI * (time - 0.06)) / strideSec + Math.PI));
  // Swap the two ankle tracks for scattered stretches, as an imperfect swap correction would leave them.
  const swapped = (index: number) => Math.floor(index / 23) % 3 === 1;
  const labelledLeft = times.map((_, index) => (swapped(index) ? right[index] : left[index]));
  const labelledRight = times.map((_, index) => (swapped(index) ? left[index] : right[index]));
  const gait = analyzeGaitCycles(times, labelledLeft, labelledRight, emptyKinematics(times.length), []);
  assert.ok(gait.cadenceSpm.value !== null && Math.abs(gait.cadenceSpm.value - 175) < 2, `cadence ${gait.cadenceSpm.value}`);
  assert.ok(gait.strideTimeCvPct.value !== null && gait.strideTimeCvPct.value < 4, `cv ${gait.strideTimeCvPct.value}`);
});

test("contacts are assigned to physical legs by alternation, regardless of pose-model labels", () => {
  const truth = Array.from({ length: 16 }, (_, index) => (index % 2 === 0 ? "left" : "right") as "left" | "right");
  // Labels flipped for a stretch in the middle, as after an uncorrected swap.
  const events = truth.map((side, index) => ({
    stanceTime: index * 0.36,
    leg: (index >= 6 && index < 9 ? (side === "left" ? "right" : "left") : side) as "left" | "right",
  }));
  assert.deepEqual(assignSides(events), truth);
  // A missed contact (gap of two steps) starts a new run that is re-synchronised from the labels.
  const withGap = events.filter((_, index) => index !== 10).map((event, index) => ({ ...event, leg: (index < 10 ? truth[index] : truth[index + 1]) as "left" | "right" }));
  assert.deepEqual(assignSides(withGap), truth.filter((_, index) => index !== 10));
  assert.deepEqual(assignSides([]), []);
});
