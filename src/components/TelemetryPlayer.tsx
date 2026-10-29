import React, { useRef, useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, FastForward, Eye, EyeOff } from "lucide-react";
import { FramePose, KinematicSequence, Landmark } from "@/types/telemetry";

const MIN_OVERLAY_VISIBILITY = 0.5;

interface TelemetryPlayerProps {
  videoUrl: string;
  frames: FramePose[];
  kinematics: KinematicSequence;
  fps?: number;
}

export const TelemetryPlayer: React.FC<TelemetryPlayerProps> = ({
  videoUrl,
  frames,
  kinematics,
  fps = 30
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showAngles, setShowAngles] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Align sampled landmarks to browser media time.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || frames.length === 0) return;

    let callbackId: number | null = null;
    let animId: number | null = null;

    const renderAtTime = (mediaTime: number) => {
      const { currentIdx, nextIdx, fraction } = getFramePosition(frames, mediaTime);
      const displayIdx = fraction >= 0.5 ? nextIdx : currentIdx;
      setCurrentFrameIdx(displayIdx);

      const withinAnalyzedInterval = mediaTime <= frames[frames.length - 1].timestamp + (1 / fps);
      const interpolatedLandmarks = withinAnalyzedInterval
        ? getInterpolatedLandmarks(frames, currentIdx, nextIdx, fraction)
        : null;

      // Draw canvas overlay
      drawStylizedOverlay(
        canvas,
        video,
        interpolatedLandmarks,
        kinematics,
        displayIdx,
        frames,
        showSkeleton,
        showAngles,
        showTrails
      );
    };

    // Modern browsers provide media timestamps through requestVideoFrameCallback.
    const handleVideoFrame = (_now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => {
      renderAtTime(metadata.mediaTime);
      if (hasVideoFrameCallback(video)) {
        callbackId = (video as any).requestVideoFrameCallback(handleVideoFrame);
      }
    };

    // Fallback animation frame loop
    const fallbackRenderLoop = () => {
      if (video.duration) {
        renderAtTime(video.currentTime);
      }
      if (!video.paused && !video.ended) {
        animId = requestAnimationFrame(fallbackRenderLoop);
      } else {
        animId = null;
      }
    };
    const startFallbackLoop = () => {
      if (animId === null) animId = requestAnimationFrame(fallbackRenderLoop);
    };
    const renderAfterSeek = () => renderAtTime(video.currentTime);

    if (hasVideoFrameCallback(video)) {
      callbackId = (video as any).requestVideoFrameCallback(handleVideoFrame);
    } else {
      renderAtTime(video.currentTime);
      video.addEventListener("play", startFallbackLoop);
      video.addEventListener("seeked", renderAfterSeek);
    }

    return () => {
      video.removeEventListener("play", startFallbackLoop);
      video.removeEventListener("seeked", renderAfterSeek);
      if (callbackId !== null && Reflect.has(video, "cancelVideoFrameCallback")) {
        (video as any).cancelVideoFrameCallback(callbackId);
      }
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
    };
  }, [frames, kinematics, fps, showSkeleton, showAngles, showTrails]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      setPlaybackError(null);
      videoRef.current.play().then(() => setIsPlaying(true)).catch((error: unknown) => {
        setPlaybackError(error instanceof Error ? error.message : "The browser could not play this video.");
      });
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const stepFrame = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);

    const newFrame = Math.min(frames.length - 1, Math.max(0, currentFrameIdx + delta));
    videoRef.current.currentTime = frames[newFrame]?.timestamp ?? 0;
  };

  return (
    <section className="panel p-3 sm:p-5" aria-label="Sampled pose video player">
      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">
            Pose overlay
            <span className="ml-2 text-xs font-medium text-muted">{fps} samples/s</span>
          </h3>
          <p className="mt-1 text-xs text-muted">
            Landmark detections are sampled at {fps} frames per second; lines between samples are visual interpolation, not new detections.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            aria-pressed={showSkeleton}
            className={`control-button min-h-8 px-2.5 ${showSkeleton ? "border-primary/50 text-primary" : ""}`}
          >
            {showSkeleton ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Skeleton
          </button>
          <button
            onClick={() => setShowTrails(!showTrails)}
            aria-pressed={showTrails}
            className={`control-button min-h-8 px-2.5 ${showTrails ? "border-primary/50 text-primary" : ""}`}
          >
            Motion Trails
          </button>
          <button
            onClick={() => setShowAngles(!showAngles)}
            aria-pressed={showAngles}
            className={`control-button min-h-8 px-2.5 ${showAngles ? "border-primary/50 text-primary" : ""}`}
          >
            Angle Labels
          </button>
        </div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#111827]">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          className="w-full h-full object-contain"
          onEnded={() => setIsPlaying(false)}
          onError={() => setPlaybackError("The browser could not decode this video for playback.")}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none object-contain"
        />
      </div>
      {playbackError && <p role="alert" className="mt-3 text-xs text-danger">{playbackError}</p>}

      <div className="mt-4 flex flex-col gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={currentFrameIdx}
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10);
            if (videoRef.current) {
              videoRef.current.currentTime = frames[idx]?.timestamp ?? 0;
              setCurrentFrameIdx(idx);
            }
          }}
          aria-label="Seek to sampled frame"
          className="h-1.5 w-full cursor-pointer accent-primary"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary transition-colors hover:bg-primary-hover"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <button
              onClick={() => stepFrame(-1)}
              className="control-button h-9 w-9 min-h-0 px-0"
              aria-label="Previous sampled frame"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="control-button h-9 w-9 min-h-0 px-0"
              aria-label="Next sampled frame"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <span className="ml-1 text-xs tabular-nums text-body sm:ml-2">
              Sample {currentFrameIdx + 1} / {frames.length} <span className="text-muted">·</span> {(frames[currentFrameIdx]?.timestamp ?? 0).toFixed(2)} s
            </span>
          </div>

          <div className="flex items-center gap-1">
            <FastForward className="mr-1 h-3.5 w-3.5 text-muted" aria-hidden="true" />
            {[0.25, 0.5, 1.0].map((speed) => (
              <button
                key={speed}
                onClick={() => changeSpeed(speed)}
                aria-pressed={playbackSpeed === speed}
                className={`min-h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                  playbackSpeed === speed
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border bg-surface text-body hover:bg-subtle"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

function getFramePosition(frames: FramePose[], time: number): { currentIdx: number; nextIdx: number; fraction: number } {
  if (frames.length === 0) return { currentIdx: 0, nextIdx: 0, fraction: 0 };
  if (time <= frames[0].timestamp) return { currentIdx: 0, nextIdx: 0, fraction: 0 };
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (frames[middle].timestamp < time) low = middle + 1;
    else high = middle;
  }

  const nextIdx = low;
  const currentIdx = Math.max(0, nextIdx - 1);
  const interval = frames[nextIdx].timestamp - frames[currentIdx].timestamp;
  return {
    currentIdx,
    nextIdx,
    fraction: interval > 0 ? Math.max(0, Math.min(1, (time - frames[currentIdx].timestamp) / interval)) : 0,
  };
}

function hasVideoFrameCallback(video: HTMLVideoElement): boolean {
  return Reflect.has(video, "requestVideoFrameCallback");
}

/**
 * Interpolates only between observed samples for overlay display; this does not add detections.
 */
function getInterpolatedLandmarks(
  frames: FramePose[],
  idx1: number,
  idx2: number,
  fraction: number
): (Landmark | null)[] | null {
  const lm1 = frames[idx1]?.landmarks;
  const lm2 = frames[idx2]?.landmarks;
  if (!lm1) return null;
  if (!lm2 || fraction <= 0.001 || idx1 === idx2) return lm1;

  const interpolated: (Landmark | null)[] = new Array(33);
  for (let i = 0; i < 33; i++) {
    const p1 = lm1[i];
    const p2 = lm2[i];

    if (p1 && p2) {
      interpolated[i] = {
        x: p1.x + (p2.x - p1.x) * fraction,
        y: p1.y + (p2.y - p1.y) * fraction,
        z: p1.z !== null && p2.z !== null ? p1.z + (p2.z - p1.z) * fraction : null,
        visibility: p1.visibility !== null && p2.visibility !== null ? Math.min(p1.visibility, p2.visibility) : null,
      };
    } else {
      interpolated[i] = null;
    }
  }

  return interpolated;
}

function drawStylizedOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  lm: (Landmark | null)[] | null,
  kinematics: KinematicSequence,
  frameIdx: number,
  allFrames: FramePose[],
  drawSkeleton: boolean,
  drawAngleLabels: boolean,
  drawTrails: boolean
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !video.videoWidth || !video.videoHeight) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!lm || !drawSkeleton) return;

  const COLOR_LEFT_LEG = "#7FA7CF";
  const COLOR_RIGHT_LEG = "#E0A877";
  const COLOR_TORSO = "#E1E7EA";
  const COLOR_ARMS = "#B8C7D0";

  // 1. Render Motion Trails for Ankle & Knee Stride Trajectories
  if (drawTrails && frameIdx > 2) {
    const trailLength = 8;
    const startIdx = Math.max(0, frameIdx - trailLength);

    ctx.save();
    for (let i = startIdx; i < frameIdx; i++) {
      const prevLm = allFrames[i]?.landmarks;
      const nextLm = allFrames[i + 1]?.landmarks;
      if (!prevLm || !nextLm) continue;

      const alpha = ((i - startIdx) / trailLength) * 0.2;

      // Left Ankle Trail (27)
      if (prevLm[27] && nextLm[27] && (prevLm[27].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && (nextLm[27].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY) {
        ctx.strokeStyle = COLOR_LEFT_LEG;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prevLm[27].x, prevLm[27].y);
        ctx.lineTo(nextLm[27].x, nextLm[27].y);
        ctx.stroke();
      }

      // Right Ankle Trail (28)
      if (prevLm[28] && nextLm[28] && (prevLm[28].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && (nextLm[28].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY) {
        ctx.strokeStyle = COLOR_RIGHT_LEG;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prevLm[28].x, prevLm[28].y);
        ctx.lineTo(nextLm[28].x, nextLm[28].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 2. Skeleton segments
  const drawGlowingBone = (p1Idx: number, p2Idx: number, baseColor: string, baseWidth: number = 4) => {
    const p1 = lm[p1Idx];
    const p2 = lm[p2Idx];

    if (p1 && p2 && (p1.visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && (p2.visibility ?? 0) >= MIN_OVERLAY_VISIBILITY) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = Math.max(2, baseWidth - 1);
      ctx.lineCap = "round";
      ctx.stroke();
    }
  };

  // Connect Torso
  drawGlowingBone(11, 12, COLOR_TORSO, 5);
  drawGlowingBone(11, 23, COLOR_TORSO, 5);
  drawGlowingBone(12, 24, COLOR_TORSO, 5);
  drawGlowingBone(23, 24, COLOR_TORSO, 5);

  // Connect Left Arm
  drawGlowingBone(11, 13, COLOR_ARMS, 4);
  drawGlowingBone(13, 15, COLOR_ARMS, 4);

  // Connect Right Arm
  drawGlowingBone(12, 14, COLOR_ARMS, 4);
  drawGlowingBone(14, 16, COLOR_ARMS, 4);

  // Connect Left Leg
  drawGlowingBone(23, 25, COLOR_LEFT_LEG, 5);
  drawGlowingBone(25, 27, COLOR_LEFT_LEG, 5);
  drawGlowingBone(27, 31, COLOR_LEFT_LEG, 4);

  // Connect Right Leg
  drawGlowingBone(24, 26, COLOR_RIGHT_LEG, 5);
  drawGlowingBone(26, 28, COLOR_RIGHT_LEG, 5);
  drawGlowingBone(28, 32, COLOR_RIGHT_LEG, 4);

  // 3. Render Pulsing Joint Rings & Nodes
  const drawJointPulse = (idx: number, color: string, radius: number = 6) => {
    const p = lm[idx];
    if (p && (p.visibility ?? 0) >= MIN_OVERLAY_VISIBILITY) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, radius - 2), 0, Math.PI * 2);
      ctx.fill();

    }
  };

  // Joints
  [11, 12, 23, 24].forEach((i) => drawJointPulse(i, COLOR_TORSO, 5));
  [25, 27].forEach((i) => drawJointPulse(i, COLOR_LEFT_LEG, 6));
  [26, 28].forEach((i) => drawJointPulse(i, COLOR_RIGHT_LEG, 6));
  [13, 14, 15, 16].forEach((i) => drawJointPulse(i, COLOR_ARMS, 4));

  // 4. Render Telemetry HUD Angle Badges
  if (drawAngleLabels) {
    const lKneeAng = kinematics.leftKneeAngles[frameIdx];
    const rKneeAng = kinematics.rightKneeAngles[frameIdx];
    const trunkLean = kinematics.trunkForwardLeanAngles[frameIdx] ?? kinematics.trunkImagePlaneAngles[frameIdx];

    if (lm[25] && (lm[25].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && lKneeAng !== undefined && lKneeAng !== null) {
      drawAngleBadge(ctx, lm[25].x - 65, lm[25].y - 12, `L Knee: ${lKneeAng.toFixed(0)}°`, COLOR_LEFT_LEG);
    }
    if (lm[26] && (lm[26].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && rKneeAng !== undefined && rKneeAng !== null) {
      drawAngleBadge(ctx, lm[26].x + 12, lm[26].y - 12, `R Knee: ${rKneeAng.toFixed(0)}°`, COLOR_RIGHT_LEG);
    }
    if (lm[11] && (lm[11].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && trunkLean !== undefined && trunkLean !== null) {
      drawAngleBadge(ctx, lm[11].x - 65, lm[11].y - 30, `Trunk: ${trunkLean.toFixed(0)}°`, COLOR_TORSO);
    }
  }
}

function drawAngleBadge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.font = "600 12px Inter, sans-serif";
  const metrics = ctx.measureText(text);
  const padX = 8;
  const padY = 5;

  ctx.save();
  ctx.fillStyle = "rgba(18, 23, 28, 0.92)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.roundRect(x - padX, y - 14, metrics.width + padX * 2, 22, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(text, x, y + 2);
  ctx.restore();
}
