import assert from "node:assert/strict";
import test from "node:test";
import { calculate2DAngle, calculatePelvicTilt, computeSequenceKinematics } from "../src/lib/biomechanics";
import { analyzeGaitCycles, findPeaks } from "../src/lib/gaitCycle";
import { calculateFormScore } from "../src/lib/formScorer";
import { metricCsvRow } from "../src/lib/csvReport";
import { evaluateSymmetryAndConsistency } from "../src/lib/symmetryAnalyzer";
import { convertMediaPipeLandmarks, createUnavailableFrame, hasCompleteTrackingCoverage } from "../src/lib/poseEstimator";
import { GaitMetrics, KinematicSequence, Landmark, metric, unavailableMetric } from "../src/types/telemetry";

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
    hipLineImageTiltAngles: missing(),
    leftAnkleY: missing(),
    rightAnkleY: missing(),
    pelvisCenterY: missing(),
    torsoHeightPx: missing(),
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
});

test("tracking quality gate rejects partial core-landmark coverage", () => {
  const unavailable = createUnavailableFrame(0, 0);
  const validPoints = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  const tracked = convertMediaPipeLandmarks(validPoints, 1, 0.1, 640, 480);
  assert.equal(hasCompleteTrackingCoverage([tracked]), true);
  assert.equal(hasCompleteTrackingCoverage([tracked, unavailable]), false);
  assert.equal(hasCompleteTrackingCoverage([]), false);
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

test("gait analysis does not manufacture cadence or contact times without events", () => {
  const gait = analyzeGaitCycles([], [], [], emptyKinematics(), []);
  assert.equal(gait.cadenceSpm.value, null);
  assert.equal(gait.avgStepTimeSec.value, null);
  assert.equal(gait.groundContactTimeMs.value, null);
  assert.equal(gait.pelvisVerticalRangeBodyHeightPct.value, null);
});

test("cadence is derived from detected events rather than substituted defaults", () => {
  const times = Array.from({ length: 50 }, (_, index) => index / 10);
  const eventFrames = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39];
  const left = times.map((_, index) => eventFrames.filter((_, event) => event % 2 === 0).includes(index) ? 10 : 0);
  const right = times.map((_, index) => eventFrames.filter((_, event) => event % 2 === 1).includes(index) ? 10 : 0);
  const gait = analyzeGaitCycles(times, left, right, emptyKinematics(times.length), []);
  assert.ok(gait.cadenceSpm.value !== null);
  assert.equal(gait.cadenceSpm.status, "algorithmically-estimated");
  assert.equal(gait.groundContactTimeMs.value, null);
});

test("unavailable symmetry inputs cannot become perfect scores", () => {
  const gait: GaitMetrics = {
    cadenceSpm: unavailableMetric("steps/min", "test"),
    avgStepTimeSec: unavailableMetric("s", "test"),
    groundContactTimeMs: unavailableMetric("ms", "test"),
    flightTimeMs: unavailableMetric("ms", "test"),
    dutyFactorPct: unavailableMetric("%", "test"),
    pelvisVerticalRangeBodyHeightPct: unavailableMetric("% body height", "test"),
    ankleHipOffsetBodyHeightPct: unavailableMetric("% body height", "test"),
    maxHipLineImageTiltDeg: unavailableMetric("deg", "test"),
    stepTimeCvPct: unavailableMetric("%", "test"),
    stancePct: unavailableMetric("%", "test"),
    swingPct: unavailableMetric("%", "test"),
    leftContacts: [],
    rightContacts: [],
  };
  const symmetry = evaluateSymmetryAndConsistency(emptyKinematics(), gait);
  const score = calculateFormScore(emptyKinematics(), gait, symmetry, true);
  assert.equal(symmetry.kneeAngleSymmetryScore.value, null);
  assert.equal(symmetry.strideConsistencyScore.value, null);
  assert.equal(score.overallScore.value, null);
});

test("the composite remains unavailable below the tracking-quality gate", () => {
  const kinematics = emptyKinematics();
  kinematics.trunkImagePlaneAngles = [10, -10];
  const unavailableGait = analyzeGaitCycles([], [], [], kinematics, []);
  const gait = {
    ...unavailableGait,
    cadenceSpm: metric(170, "algorithmically-estimated", "steps/min", "test"),
  };
  const unavailableSymmetry = evaluateSymmetryAndConsistency(kinematics, gait);
  const symmetry = {
    ...unavailableSymmetry,
    kneeAngleSymmetryScore: metric(95, "heuristic-estimate", "%", "test"),
    strideConsistencyScore: metric(96, "heuristic-estimate", "%", "test"),
  };
  const score = calculateFormScore(kinematics, gait, symmetry, false);
  assert.equal(score.overallScore.value, null);
  assert.equal(score.subScores.posture.value, 100);
});

test("CSV rows retain unavailable and estimated metric statuses", () => {
  assert.equal(
    metricCsvRow("Cadence", unavailableMetric("steps/min", "not enough events")),
    '"Cadence","Unavailable","unavailable (steps/min)"'
  );
  assert.equal(
    metricCsvRow("Cadence", { value: 172, status: "algorithmically-estimated", unit: "steps/min", explanation: "test" }),
    '"Cadence","172","algorithmically-estimated (steps/min)"'
  );
});
