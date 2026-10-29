import { AnalysisQuality, FramePose, GaitMetrics, KinematicSequence } from "../types/telemetry";
import { assessCameraView } from "./biomechanics";
import { MIN_TRACKING_COVERAGE, hasSufficientTrackingCoverage } from "./poseEstimator";

const MIN_STEPS_FOR_RELIABLE_SUMMARY = 6;

interface SamplingInfo {
  samplingRateFps: number;
  sourceDurationSec: number;
}

export function buildAnalysisQuality(
  frames: FramePose[],
  kinematics: KinematicSequence,
  gait: GaitMetrics,
  sampling: SamplingInfo
): AnalysisQuality {
  const trackedFrames = frames.filter((frame) => frame.tracked).length;
  const validTrackingPct = frames.length ? (trackedFrames / frames.length) * 100 : 0;
  const visibilities = frames
    .map((frame) => frame.meanVisibility)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const meanLandmarkVisibility = visibilities.length
    ? visibilities.reduce((sum, value) => sum + value, 0) / visibilities.length
    : null;
  const { view, bodyWidthRatio } = assessCameraView(frames.filter((frame) => frame.tracked));
  const coverageOk = hasSufficientTrackingCoverage(frames);

  const warnings: string[] = [];
  if (!coverageOk) {
    warnings.push(`Only ${validTrackingPct.toFixed(0)}% of frames had all core landmarks visible (${Math.round(MIN_TRACKING_COVERAGE * 100)}% needed). Keep the whole body in frame with good lighting.`);
  }
  if (view === "front-or-back") {
    warnings.push("The runner appears to be filmed from the front or back. Foot-strike, knee and trunk angles need a side-on view.");
  } else if (view === "oblique") {
    warnings.push("The camera looks partly diagonal to the runner. Angles are most accurate with the camera perpendicular to the running direction.");
  }
  if (kinematics.facingDirection === null) {
    warnings.push("Running direction could not be determined, so forward lean and foot-strike angles are unavailable.");
  }
  if (gait.stepCount < MIN_STEPS_FOR_RELIABLE_SUMMARY) {
    warnings.push(`Only ${gait.stepCount} consistent steps were detected; at least ${MIN_STEPS_FOR_RELIABLE_SUMMARY} give more stable averages. Use a clip with 5+ seconds of steady running.`);
  }

  const sufficientForSummary = coverageOk && view !== "front-or-back" && view !== "unknown";

  return {
    sampledFrames: frames.length,
    trackedFrames,
    validTrackingPct: Math.round(validTrackingPct * 10) / 10,
    meanLandmarkVisibility: meanLandmarkVisibility === null ? null : Math.round(meanLandmarkVisibility * 1000) / 1000,
    analyzedStartSec: frames[0]?.timestamp ?? 0,
    analyzedEndSec: frames[frames.length - 1]?.timestamp ?? 0,
    samplingRateFps: sampling.samplingRateFps,
    sourceDurationSec: sampling.sourceDurationSec,
    cameraView: view,
    bodyWidthRatio,
    facingDirection: kinematics.facingDirection,
    sufficientForSummary,
    message: sufficientForSummary
      ? "Tracking coverage and camera view meet the requirements for an overall score."
      : "Overall score withheld: tracking coverage or camera view did not meet the requirements.",
    warnings,
  };
}
