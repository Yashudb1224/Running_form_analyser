import { Landmark, FramePose } from "@/types/telemetry";

/**
 * Client-Side Browser MediaPipe Pose Estimator Wrapper.
 * Dynamically loads MediaPipe Pose script via CDN for zero-build WebGL rendering.
 */
export class BrowserPoseEstimator {
  private poseInstance: any = null;
  private isReady = false;

  async initialize(onResultsCallback: (results: any) => void): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      // Dynamically load MediaPipe Pose CDN script if not present
      if (!(window as any).Pose) {
        await this.loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js");
      }

      const PoseClass = (window as any).Pose;
      if (!PoseClass) {
        console.warn("MediaPipe Pose script failed to register on window.");
        return false;
      }

      this.poseInstance = new PoseClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      this.poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.poseInstance.onResults(onResultsCallback);
      await this.poseInstance.initialize();
      this.isReady = true;
      return true;
    } catch (err) {
      console.error("Error initializing MediaPipe Pose in browser:", err);
      return false;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  async sendFrame(imageElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<void> {
    if (this.poseInstance && this.isReady) {
      await this.poseInstance.send({ image: imageElement });
    }
  }

  close(): void {
    if (this.poseInstance) {
      try {
        this.poseInstance.close();
      } catch (e) {
        // ignore
      }
      this.poseInstance = null;
      this.isReady = false;
    }
  }
}

/**
 * Converts MediaPipe pose landmarks to typed FramePose.
 */
export function convertMediaPipeLandmarks(
  landmarks: any[],
  frameIdx: number,
  timestamp: number,
  videoWidth: number,
  videoHeight: number
): FramePose {
  const typedLandmarks: Landmark[] = new Array(33);

  for (let i = 0; i < 33; i++) {
    if (landmarks && landmarks[i]) {
      const lm = landmarks[i];
      typedLandmarks[i] = {
        x: lm.x * videoWidth,
        y: lm.y * videoHeight,
        z: lm.z || 0,
        visibility: lm.visibility !== undefined ? lm.visibility : 0.9
      };
    } else {
      typedLandmarks[i] = { x: 0, y: 0, z: 0, visibility: 0 };
    }
  }

  return {
    frameIndex: frameIdx,
    timestamp,
    landmarks: typedLandmarks
  };
}
