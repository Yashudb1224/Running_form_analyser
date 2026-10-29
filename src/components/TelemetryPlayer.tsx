import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, Eye, EyeOff, Keyboard } from "lucide-react";
import { FacingDirection, FootStrikeEvent, FramePose, KinematicSequence, Landmark } from "@/types/telemetry";
import {
  OVERLAY_COLORS,
  drawBadge,
  drawKneeFlexion,
  drawShankAngle,
  drawSkeleton,
  drawTrunkLean,
  overlayScale,
} from "@/lib/overlayDrawing";

const SPEEDS = [0.1, 0.25, 0.5, 1] as const;
const TRAIL_LENGTH = 12;

export interface SeekRequest {
  time: number;
  /** Changes on every request so repeated jumps to the same time still seek. */
  id: number;
}

interface TelemetryPlayerProps {
  videoUrl: string;
  frames: FramePose[];
  kinematics: KinematicSequence;
  events: FootStrikeEvent[];
  fps?: number;
  seekRequest?: SeekRequest | null;
}

interface OverlayOptions {
  skeleton: boolean;
  angles: boolean;
  trails: boolean;
}

export const TelemetryPlayer: React.FC<TelemetryPlayerProps> = ({
  videoUrl,
  frames,
  kinematics,
  events,
  fps = 30,
  seekRequest = null,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.25);
  const [options, setOptions] = useState<OverlayOptions>({ skeleton: true, angles: true, trails: false });
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const strikeFrames = useMemo(() => [...events].sort((a, b) => a.strikeFrame - b.strikeFrame), [events]);
  const analyzedEnd = frames.length ? frames[frames.length - 1].timestamp : 0;
  const untrackedRuns = useMemo(() => findUntrackedRuns(frames), [frames]);
  const currentEvent = useMemo(() => eventAtFrame(events, currentFrameIdx), [events, currentFrameIdx]);

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
      const withinAnalyzedInterval = mediaTime <= frames[frames.length - 1].timestamp + 1 / fps;
      const landmarks = withinAnalyzedInterval ? getInterpolatedLandmarks(frames, currentIdx, nextIdx, fraction) : null;
      drawOverlay(canvas, video, landmarks, kinematics, events, displayIdx, frames, options);
    };

    const handleVideoFrame = (_now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => {
      // mediaTime is the frame's start; samples are timestamped mid-frame.
      renderAtTime(metadata.mediaTime + 0.5 / fps);
      callbackId = requestVideoFrame(video, handleVideoFrame);
    };
    const fallbackRenderLoop = () => {
      if (video.duration) renderAtTime(video.currentTime);
      animId = !video.paused && !video.ended ? requestAnimationFrame(fallbackRenderLoop) : null;
    };
    const startFallbackLoop = () => {
      if (animId === null) animId = requestAnimationFrame(fallbackRenderLoop);
    };
    const renderNow = () => renderAtTime(video.currentTime);

    if (hasVideoFrameCallback(video)) {
      callbackId = requestVideoFrame(video, handleVideoFrame);
      video.addEventListener("seeked", renderNow);
    } else {
      video.addEventListener("play", startFallbackLoop);
      video.addEventListener("seeked", renderNow);
    }
    video.addEventListener("loadeddata", renderNow);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) renderNow();

    return () => {
      video.removeEventListener("play", startFallbackLoop);
      video.removeEventListener("seeked", renderNow);
      video.removeEventListener("loadeddata", renderNow);
      if (callbackId !== null && Reflect.has(video, "cancelVideoFrameCallback")) {
        (video as HTMLVideoElement & { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback(callbackId);
      }
      if (animId !== null) cancelAnimationFrame(animId);
    };
  }, [frames, kinematics, events, fps, options]);

  const seekToFrame = useCallback((index: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const clamped = Math.min(frames.length - 1, Math.max(0, index));
    video.currentTime = frames[clamped]?.timestamp ?? 0;
    setCurrentFrameIdx(clamped);
  }, [frames]);

  useEffect(() => {
    if (!seekRequest) return;
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.currentTime = seekRequest.time;
  }, [seekRequest]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
      return;
    }
    setPlaybackError(null);
    video.playbackRate = playbackSpeed;
    video.play().then(() => setIsPlaying(true)).catch((error: unknown) => {
      setPlaybackError(error instanceof Error ? error.message : "The browser could not play this video.");
    });
  }, [playbackSpeed]);

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
  };

  const jumpToStrike = useCallback((direction: 1 | -1) => {
    const candidates = direction === 1
      ? strikeFrames.filter((event) => event.strikeFrame > currentFrameIdx)
      : strikeFrames.filter((event) => event.strikeFrame < currentFrameIdx).reverse();
    if (candidates[0]) seekToFrame(candidates[0].strikeFrame);
  }, [strikeFrames, currentFrameIdx, seekToFrame]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) && target.getAttribute("type") !== "range") return;
      // Space on a focused button already clicks it.
      if (event.key === " " && target?.tagName === "BUTTON") return;
      if (event.key === " ") togglePlay();
      else if (event.key === "ArrowRight") seekToFrame(currentFrameIdx + 1);
      else if (event.key === "ArrowLeft") seekToFrame(currentFrameIdx - 1);
      else if (event.key === "]") jumpToStrike(1);
      else if (event.key === "[") jumpToStrike(-1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, seekToFrame, jumpToStrike, currentFrameIdx]);

  const toggle = (key: keyof OverlayOptions) => setOptions((previous) => ({ ...previous, [key]: !previous[key] }));
  const toPercent = (time: number) => (analyzedEnd > 0 ? Math.min(100, Math.max(0, (time / analyzedEnd) * 100)) : 0);
  const currentFrame = frames[currentFrameIdx];

  return (
    <section className="panel p-3 sm:p-5" aria-label="Pose overlay video player">
      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">
            Pose overlay
            <span className="ml-2 text-xs font-medium text-muted">{fps} samples/s</span>
          </h3>
          <p className="mt-1 text-xs text-muted">
            Foot strikes and midstance show the measured angle. Step through them with the timeline or the [ ] keys.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["skeleton", "Skeleton"],
            ["angles", "Measurements"],
            ["trails", "Ankle trails"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              aria-pressed={options[key]}
              className={`control-button min-h-8 px-2.5 ${options[key] ? "border-primary/50 text-primary" : ""}`}
            >
              {key === "skeleton" && (options.skeleton ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />)}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#111827]">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted
          className="h-full w-full object-contain"
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onError={() => setPlaybackError("The browser could not decode this video for playback.")}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 h-full w-full object-contain" />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {currentEvent && (
            <span className="rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
              {currentEvent.event.side === "left" ? "Left" : "Right"} {currentEvent.type === "strike" ? "foot strike" : "midstance"}
            </span>
          )}
          {currentFrame && !currentFrame.tracked && currentFrame.timestamp <= analyzedEnd && (
            <span className="rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-amber-200">Low-confidence pose</span>
          )}
        </div>
      </div>
      {playbackError && <p role="alert" className="mt-3 text-xs text-danger">{playbackError}</p>}

      <div className="mt-4 flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={currentFrameIdx}
          onChange={(event) => seekToFrame(parseInt(event.target.value, 10))}
          aria-label="Seek to sampled frame"
          className="h-1.5 w-full cursor-pointer accent-primary"
        />
        <div className="relative h-7 w-full rounded-md bg-subtle" aria-label="Detected foot strikes">
          {untrackedRuns.map(([start, end]) => (
            <span
              key={`gap-${start}`}
              className="absolute inset-y-0 bg-border-strong/50"
              style={{ left: `${toPercent(frames[start].timestamp)}%`, width: `${Math.max(0.4, toPercent(frames[end].timestamp) - toPercent(frames[start].timestamp))}%` }}
              title="Low-confidence pose"
            />
          ))}
          {strikeFrames.map((event) => (
            <button
              key={`${event.side}-${event.strikeFrame}`}
              type="button"
              onClick={() => seekToFrame(event.strikeFrame)}
              title={`${event.side === "left" ? "Left" : "Right"} foot strike at ${frames[event.strikeFrame]?.timestamp.toFixed(2)} s`}
              aria-label={`${event.side === "left" ? "Left" : "Right"} foot strike at ${frames[event.strikeFrame]?.timestamp.toFixed(2)} seconds`}
              className={`absolute w-1.5 -translate-x-1/2 rounded-full transition-transform hover:scale-x-150 ${event.side === "left" ? "top-1 h-2.5 bg-leg-left" : "bottom-1 h-2.5 bg-leg-right"} ${
                currentEvent?.event === event ? "ring-2 ring-ink" : ""
              }`}
              style={{ left: `${toPercent(frames[event.strikeFrame]?.timestamp ?? 0)}%` }}
            />
          ))}
          <span
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink"
            style={{ left: `${toPercent(currentFrame?.timestamp ?? 0)}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-leg-left" />Left foot strike</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-leg-right" />Right foot strike</span>
          {untrackedRuns.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-border-strong/50" />Low-confidence pose</span>}
        </div>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary transition-colors hover:bg-primary-hover"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <button onClick={() => jumpToStrike(-1)} className="control-button h-9 min-h-0 px-2" aria-label="Previous foot strike" title="Previous foot strike ([)">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button onClick={() => seekToFrame(currentFrameIdx - 1)} className="control-button h-9 w-9 min-h-0 px-0" aria-label="Previous frame" title="Previous frame (←)">
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={() => seekToFrame(currentFrameIdx + 1)} className="control-button h-9 w-9 min-h-0 px-0" aria-label="Next frame" title="Next frame (→)">
              <SkipForward className="h-4 w-4" />
            </button>
            <button onClick={() => jumpToStrike(1)} className="control-button h-9 min-h-0 px-2" aria-label="Next foot strike" title="Next foot strike (])">
              <ChevronsRight className="h-4 w-4" />
            </button>
            <span className="ml-1 text-xs tabular-nums text-body sm:ml-2">
              {(currentFrame?.timestamp ?? 0).toFixed(2)} s <span className="text-muted">· frame {currentFrameIdx + 1}/{frames.length}</span>
            </span>
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => changeSpeed(speed)}
                aria-pressed={playbackSpeed === speed}
                className={`min-h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                  playbackSpeed === speed ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-body hover:bg-subtle"
                }`}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
        <p className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
          <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
          Space play/pause · ← → step a frame · [ ] previous/next foot strike
        </p>
      </div>
    </section>
  );
};

function findUntrackedRuns(frames: FramePose[]): [number, number][] {
  const runs: [number, number][] = [];
  let start: number | null = null;
  frames.forEach((frame, index) => {
    if (!frame.tracked && start === null) start = index;
    if ((frame.tracked || index === frames.length - 1) && start !== null) {
      runs.push([start, frame.tracked ? index - 1 : index]);
      start = null;
    }
  });
  return runs;
}

function eventAtFrame(events: FootStrikeEvent[], frameIndex: number): { event: FootStrikeEvent; type: "strike" | "midstance" } | null {
  for (const event of events) {
    if (event.strikeFrame === frameIndex) return { event, type: "strike" };
  }
  for (const event of events) {
    if (event.midstanceFrame === frameIndex) return { event, type: "midstance" };
  }
  return null;
}

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

type FrameCallback = (now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => void;

function hasVideoFrameCallback(video: HTMLVideoElement): boolean {
  return Reflect.has(video, "requestVideoFrameCallback");
}

function requestVideoFrame(video: HTMLVideoElement, callback: FrameCallback): number | null {
  if (!hasVideoFrameCallback(video)) return null;
  return (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: FrameCallback) => number }).requestVideoFrameCallback(callback);
}

/** Interpolates only between observed samples for overlay display; this does not add detections. */
function getInterpolatedLandmarks(frames: FramePose[], idx1: number, idx2: number, fraction: number): (Landmark | null)[] | null {
  const lm1 = frames[idx1]?.landmarks;
  const lm2 = frames[idx2]?.landmarks;
  if (!lm1) return null;
  if (!lm2 || fraction <= 0.001 || idx1 === idx2) return lm1;
  return lm1.map((p1, index) => {
    const p2 = lm2[index];
    if (!p1 || !p2) return null;
    return {
      x: p1.x + (p2.x - p1.x) * fraction,
      y: p1.y + (p2.y - p1.y) * fraction,
      z: p1.z !== null && p2.z !== null ? p1.z + (p2.z - p1.z) * fraction : null,
      visibility: p1.visibility !== null && p2.visibility !== null ? Math.min(p1.visibility, p2.visibility) : null,
    };
  });
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  lm: (Landmark | null)[] | null,
  kinematics: KinematicSequence,
  events: FootStrikeEvent[],
  frameIdx: number,
  allFrames: FramePose[],
  options: OverlayOptions
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !video.videoWidth || !video.videoHeight) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm || !options.skeleton) return;
  const scale = overlayScale(canvas.width, canvas.height);
  const facing: FacingDirection | null = kinematics.facingDirection;

  if (options.trails) drawAnkleTrails(ctx, allFrames, frameIdx, scale);

  const marker = eventAtFrame(events, frameIdx);
  drawSkeleton(ctx, lm, scale, { opacity: marker ? 0.6 : 1, legTags: true });
  if (!options.angles) return;

  if (marker?.type === "strike" && marker.event.shankAngleDeg !== null) {
    drawShankAngle(ctx, lm, marker.event.leg, facing, scale, `Shin ${marker.event.shankAngleDeg.toFixed(1)}°`);
    return;
  }
  if (marker?.type === "midstance" && marker.event.midstanceKneeFlexionDeg !== null) {
    drawKneeFlexion(ctx, lm, marker.event.leg, facing, scale, `Knee flexion ${marker.event.midstanceKneeFlexionDeg.toFixed(1)}°`);
    return;
  }

  const lean = kinematics.trunkForwardLeanAngles[frameIdx];
  if (lean !== null && lean !== undefined) drawTrunkLean(ctx, lm, facing, scale, `Lean ${lean.toFixed(0)}°`);
  for (const [leg, kneeIndex, color] of [["left", 25, OVERLAY_COLORS.leftLeg], ["right", 26, OVERLAY_COLORS.rightLeg]] as const) {
    const angle = leg === "left" ? kinematics.leftKneeAngles[frameIdx] : kinematics.rightKneeAngles[frameIdx];
    const knee = lm[kneeIndex];
    if (angle === null || angle === undefined || !knee || (knee.visibility ?? 0) < 0.5) continue;
    const toFront = (facing ?? 1) === 1;
    drawBadge(ctx, knee.x + (toFront ? -1 : 1) * 16 * scale, knee.y, `${leg === "left" ? "L" : "R"} knee ${angle.toFixed(0)}°`, color, scale, toFront ? "right" : "left");
  }
}

function drawAnkleTrails(ctx: CanvasRenderingContext2D, frames: FramePose[], frameIdx: number, scale: number) {
  const start = Math.max(0, frameIdx - TRAIL_LENGTH);
  ctx.save();
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = "round";
  for (let index = start; index < frameIdx; index++) {
    const previous = frames[index]?.landmarks;
    const next = frames[index + 1]?.landmarks;
    if (!previous || !next) continue;
    ctx.globalAlpha = ((index - start + 1) / TRAIL_LENGTH) * 0.6;
    for (const [landmark, color] of [[27, OVERLAY_COLORS.leftLeg], [28, OVERLAY_COLORS.rightLeg]] as const) {
      const a = previous[landmark];
      const b = next[landmark];
      if (!a || !b || (a.visibility ?? 0) < 0.5 || (b.visibility ?? 0) < 0.5) continue;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}
