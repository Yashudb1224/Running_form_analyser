import { FramePose, Landmark } from "../types/telemetry";

interface MediaPipeLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

interface MediaPipeResults {
  poseLandmarks?: MediaPipeLandmark[];
}

interface MediaPipePoseInstance {
  setOptions(options: Record<string, unknown>): void;
  onResults(callback: (results: MediaPipeResults) => void): void;
  initialize(): Promise<void>;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement }): Promise<void>;
  close(): void | Promise<void>;
}

interface MediaPipePoseConstructor {
  new (options: { locateFile: (file: string) => string }): MediaPipePoseInstance;
}

// Pinned so model behaviour cannot change underneath the analysis between visits.
const POSE_VERSION = "0.5.1675469404";
const POSE_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}`;
const POSE_SCRIPT = `${POSE_BASE_URL}/pose.js`;
const CORE_LANDMARKS = [11, 12, 23, 24, 25, 26, 27, 28];

export class BrowserPoseEstimator {
  private poseInstance: MediaPipePoseInstance | null = null;
  private isReady = false;

  async initialize(onResultsCallback: (results: MediaPipeResults) => void): Promise<void> {
    if (typeof window === "undefined") throw new Error("Pose estimation is only available in a browser.");

    if (!(window as Window & { Pose?: MediaPipePoseConstructor }).Pose) {
      await this.loadScript(POSE_SCRIPT);
    }

    const PoseClass = (window as Window & { Pose?: MediaPipePoseConstructor }).Pose;
    if (!PoseClass) throw new Error("MediaPipe Pose did not register after its script loaded.");

    const pose = new PoseClass({
      locateFile: (file) => `${POSE_BASE_URL}/${file}`,
    });
    this.poseInstance = pose;
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults(onResultsCallback);
    await pose.initialize();
    this.isReady = true;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      const created = !script;
      if (!script) {
        script = document.createElement("script");
        script.src = src;
        script.crossOrigin = "anonymous";
      }

      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while downloading the MediaPipe Pose script."));
      }, 20000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        script?.removeEventListener("load", onLoad);
        script?.removeEventListener("error", onError);
      };
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        if (created) script?.remove();
        reject(new Error("Could not download MediaPipe Pose from jsDelivr."));
      };

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (created) document.head.appendChild(script);
    });
  }

  async sendFrame(imageElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<void> {
    if (!this.poseInstance || !this.isReady) throw new Error("MediaPipe Pose is not initialized.");
    const pose = this.poseInstance;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("MediaPipe Pose timed out while processing a video sample.")), 15000);
      pose.send({ image: imageElement }).then(resolve, reject).finally(() => window.clearTimeout(timeout));
    });
  }

  async close(): Promise<void> {
    const pose = this.poseInstance;
    this.poseInstance = null;
    this.isReady = false;
    if (pose) await pose.close();
  }
}

export function convertMediaPipeLandmarks(
  landmarks: MediaPipeLandmark[] | undefined,
  frameIdx: number,
  timestamp: number,
  videoWidth: number,
  videoHeight: number
): FramePose {
  const typedLandmarks: (Landmark | null)[] = Array.from({ length: 33 }, (_, index) => {
    const point = landmarks?.[index];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return {
      x: point.x * videoWidth,
      y: point.y * videoHeight,
      z: typeof point.z === "number" && Number.isFinite(point.z) ? point.z : null,
      visibility: typeof point.visibility === "number" && Number.isFinite(point.visibility) ? point.visibility : null,
    };
  });
  const visibleCore = CORE_LANDMARKS
    .map((index) => typedLandmarks[index])
    .filter((point): point is Landmark => Boolean(point && point.visibility !== null));
  const meanVisibility = visibleCore.length
    ? visibleCore.reduce((sum, point) => sum + (point.visibility ?? 0), 0) / visibleCore.length
    : null;
  const tracked = CORE_LANDMARKS.every((index) => {
    const point = typedLandmarks[index];
    return Boolean(point && point.visibility !== null && point.visibility >= 0.5);
  });

  return { frameIndex: frameIdx, timestamp, landmarks: typedLandmarks, tracked, meanVisibility };
}

export function createUnavailableFrame(frameIdx: number, timestamp: number): FramePose {
  return {
    frameIndex: frameIdx,
    timestamp,
    landmarks: Array.from({ length: 33 }, () => null),
    tracked: false,
    meanVisibility: null,
  };
}

/** Minimum share of sampled frames with all core landmarks visible before an overall score is given. */
export const MIN_TRACKING_COVERAGE = 0.85;

export function hasSufficientTrackingCoverage(frames: FramePose[]): boolean {
  return frames.length > 0 && frames.filter((frame) => frame.tracked).length / frames.length >= MIN_TRACKING_COVERAGE;
}
