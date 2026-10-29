import React, { useRef, useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, FastForward, Eye, EyeOff, Sparkles } from "lucide-react";
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
  const [showTrails, setShowTrails] = useState<boolean>(true);
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
    <div className="bg-surface rounded-2xl border border-border p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Sampled Pose Overlay
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold uppercase">
              {fps} Samples / sec
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Landmark detections are sampled at {fps} frames per second; lines between samples are visual interpolation, not new detections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              showSkeleton
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-slate-400"
            }`}
          >
            {showSkeleton ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Skeleton
          </button>
          <button
            onClick={() => setShowTrails(!showTrails)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              showTrails
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-card border-border text-slate-400"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Motion Trails
          </button>
          <button
            onClick={() => setShowAngles(!showAngles)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              showAngles
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-slate-400"
            }`}
          >
            Angle Labels
          </button>
        </div>
      </div>

      {/* Video & Canvas Container */}
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-border shadow-inner">
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
      {playbackError && <p role="alert" className="mt-3 text-xs text-red-300">{playbackError}</p>}

      {/* Interactive Controls Bar */}
      <div className="mt-4 flex flex-col gap-3">
        {/* Seek Bar */}
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
          className="w-full accent-primary h-1.5 bg-card rounded-lg cursor-pointer"
        />

        {/* Buttons Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button
              onClick={() => stepFrame(-1)}
              className="p-2 rounded-xl bg-card border border-border hover:bg-border/50 text-slate-300 transition-colors"
              title="Previous Frame"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="p-2 rounded-xl bg-card border border-border hover:bg-border/50 text-slate-300 transition-colors"
              title="Next Frame"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-slate-400 ml-2">
              Frame {currentFrameIdx + 1} / {frames.length} ({(frames[currentFrameIdx]?.timestamp ?? 0).toFixed(2)}s)
            </span>
          </div>

          {/* Speed Selectors */}
          <div className="flex items-center gap-1.5">
            <FastForward className="w-4 h-4 text-slate-400 mr-1" />
            {[0.25, 0.5, 1.0].map((speed) => (
              <button
                key={speed}
                onClick={() => changeSpeed(speed)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  playbackSpeed === speed
                    ? "bg-primary border-primary text-black font-bold"
                    : "bg-card border-border text-slate-400 hover:text-slate-200"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
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

/**
 * High-tech Cyberpunk Canvas Renderer with Neon Glow, Depth Opacity, and Motion Trails.
 */
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

  const COLOR_LEFT_LEG = "#00E5FF";   // Neon Cyan
  const COLOR_RIGHT_LEG = "#FF00AA";  // Neon Magenta
  const COLOR_TORSO = "#FFD700";      // Neon Amber/Gold
  const COLOR_ARMS = "#A855F7";       // Neon Purple

  // 1. Render Motion Trails for Ankle & Knee Stride Trajectories
  if (drawTrails && frameIdx > 2) {
    const trailLength = 8;
    const startIdx = Math.max(0, frameIdx - trailLength);

    ctx.save();
    for (let i = startIdx; i < frameIdx; i++) {
      const prevLm = allFrames[i]?.landmarks;
      const nextLm = allFrames[i + 1]?.landmarks;
      if (!prevLm || !nextLm) continue;

      const alpha = ((i - startIdx) / trailLength) * 0.45;

      // Left Ankle Trail (27)
      if (prevLm[27] && nextLm[27] && (prevLm[27].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && (nextLm[27].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY) {
        ctx.strokeStyle = COLOR_LEFT_LEG;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(prevLm[27].x, prevLm[27].y);
        ctx.lineTo(nextLm[27].x, nextLm[27].y);
        ctx.stroke();
      }

      // Right Ankle Trail (28)
      if (prevLm[28] && nextLm[28] && (prevLm[28].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && (nextLm[28].visibility ?? 0) >= MIN_OVERLAY_VISIBILITY) {
        ctx.strokeStyle = COLOR_RIGHT_LEG;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(prevLm[28].x, prevLm[28].y);
        ctx.lineTo(nextLm[28].x, nextLm[28].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 2. Draw Glowing Cyberpunk Connecting Bones
  const drawGlowingBone = (p1Idx: number, p2Idx: number, baseColor: string, baseWidth: number = 4) => {
    const p1 = lm[p1Idx];
    const p2 = lm[p2Idx];

    if (p1 && p2 && (p1.visibility ?? 0) >= MIN_OVERLAY_VISIBILITY && (p2.visibility ?? 0) >= MIN_OVERLAY_VISIBILITY) {
      // Depth opacity calculation based on Z coordinate
      const avgZ = p1.z !== null && p2.z !== null ? (p1.z + p2.z) / 2 : null;
      const opacity = avgZ === null ? 1 : Math.max(0.4, Math.min(1.0, 1.0 - avgZ * 0.4));

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = baseWidth;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
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
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;

      // Inner Solid Core
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer Glow Ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
    const trunkLean = kinematics.trunkImagePlaneAngles[frameIdx];

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
  ctx.font = "bold 13px Inter, sans-serif";
  const metrics = ctx.measureText(text);
  const padX = 8;
  const padY = 5;

  ctx.save();
  ctx.fillStyle = "rgba(11, 15, 23, 0.88)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.roundRect(x - padX, y - 14, metrics.width + padX * 2, 22, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#F8FAFC";
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y + 2);
  ctx.restore();
}
