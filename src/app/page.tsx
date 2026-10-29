"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { VideoUploader } from "@/components/VideoUploader";
import { TelemetryPlayer } from "@/components/TelemetryPlayer";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { CoachingFeed } from "@/components/CoachingFeed";
import { KinematicCharts } from "@/components/KinematicCharts";
import { SymmetryBreakdown } from "@/components/SymmetryBreakdown";
import { AnalysisQuality, CompleteAnalysisReport, FramePose } from "@/types/telemetry";
import { computeSequenceKinematics } from "@/lib/biomechanics";
import { analyzeGaitCycles } from "@/lib/gaitCycle";
import { evaluateSymmetryAndConsistency } from "@/lib/symmetryAnalyzer";
import { calculateFormScore } from "@/lib/formScorer";
import { buildCsvReport } from "@/lib/csvReport";
import { BrowserPoseEstimator, convertMediaPipeLandmarks, createUnavailableFrame, hasCompleteTrackingCoverage } from "@/lib/poseEstimator";
import { Download, RefreshCw, Loader2, AlertTriangle } from "lucide-react";

const SAMPLE_RATE_FPS = 10;
const MAX_SAMPLED_FRAMES = 600;
const METADATA_TIMEOUT_MS = 15000;
const SEEK_TIMEOUT_MS = 5000;
const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "avi", "webm"]);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected video-analysis error occurred.";
}

function loadVideoMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while reading video metadata. The file may be damaged or unsupported by this browser."));
    }, METADATA_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The browser could not decode this video. Try a browser-supported MP4 or WebM file."));
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.load();
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<number> {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve(video.currentTime);
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out while seeking to ${time.toFixed(1)} seconds.`));
    }, SEEK_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve(video.currentTime);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video decoding failed while seeking between sampled frames."));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = time;
  });
}

function validateVideoFile(file: File): string | null {
  if (file.size === 0) return "The selected file is empty.";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return "Choose an MP4, MOV, AVI, or WebM video.";
  if (file.type && !file.type.startsWith("video/")) return "The selected file is not identified as a video.";
  return null;
}

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<CompleteAnalysisReport | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "video" | "charts" | "symmetry">("summary");
  const activeJobRef = useRef(0);
  const estimatorRef = useRef<BrowserPoseEstimator | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const processingVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => () => {
    activeJobRef.current++;
    const processingVideo = processingVideoRef.current;
    processingVideoRef.current = null;
    if (processingVideo) {
      processingVideo.pause();
      processingVideo.removeAttribute("src");
      processingVideo.load();
    }
    const estimator = estimatorRef.current;
    estimatorRef.current = null;
    if (estimator) void estimator.close().catch((error: unknown) => console.error("Could not close MediaPipe Pose:", error));
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
  }, []);

  const analyzeVideo = async (url: string) => {
    const jobId = ++activeJobRef.current;
    setIsAnalyzing(true);
    setAnalysisProgress(1);
    setProgressMessage("Reading video metadata…");
    setErrorMessage(null);
    setReport(null);

    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    processingVideoRef.current = video;
    let estimator: BrowserPoseEstimator | null = null;

    try {
      await loadVideoMetadata(video);
      if (jobId !== activeJobRef.current) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
        throw new Error("The video has no valid duration or readable dimensions.");
      }

      const duration = video.duration;
      const analyzedDuration = Math.min(duration, MAX_SAMPLED_FRAMES / SAMPLE_RATE_FPS);
      const sampleCount = Math.min(MAX_SAMPLED_FRAMES, Math.max(1, Math.ceil(analyzedDuration * SAMPLE_RATE_FPS)));
      const frames: FramePose[] = [];
      let latestLandmarks: Parameters<typeof convertMediaPipeLandmarks>[0] = undefined;

      setProgressMessage("Loading MediaPipe Pose and model assets from jsDelivr…");
      estimator = new BrowserPoseEstimator();
      estimatorRef.current = estimator;
      await estimator.initialize((results) => {
        latestLandmarks = results.poseLandmarks;
      });
      if (jobId !== activeJobRef.current) return;

      for (let index = 0; index < sampleCount; index++) {
        if (jobId !== activeJobRef.current) return;
        const requestedTime = Math.min(index / SAMPLE_RATE_FPS, Math.max(0, duration - 0.001));
        setProgressMessage(`Seeking and tracking sample ${index + 1} of ${sampleCount}…`);
        const actualTime = await seekVideo(video, requestedTime);
        if (jobId !== activeJobRef.current) return;

        latestLandmarks = undefined;
        await estimator.sendFrame(video);
        if (jobId !== activeJobRef.current) return;
        frames.push(latestLandmarks
          ? convertMediaPipeLandmarks(latestLandmarks, index, actualTime, video.videoWidth, video.videoHeight)
          : createUnavailableFrame(index, actualTime));
        setAnalysisProgress(5 + Math.round(((index + 1) / sampleCount) * 85));
      }

      await estimator.close();
      estimatorRef.current = null;
      estimator = null;

      const trackedFrames = frames.filter((frame) => frame.tracked).length;
      const validTrackingPct = frames.length ? (trackedFrames / frames.length) * 100 : 0;
      const visibilities = frames
        .map((frame) => frame.meanVisibility)
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const meanLandmarkVisibility = visibilities.length
        ? visibilities.reduce((sum, value) => sum + value, 0) / visibilities.length
        : null;
      const sufficientForSummary = hasCompleteTrackingCoverage(frames);
      const quality: AnalysisQuality = {
        sampledFrames: frames.length,
        trackedFrames,
        validTrackingPct: Math.round(validTrackingPct * 10) / 10,
        meanLandmarkVisibility: meanLandmarkVisibility === null ? null : Math.round(meanLandmarkVisibility * 1000) / 1000,
        analyzedStartSec: frames[0]?.timestamp ?? 0,
        analyzedEndSec: frames[frames.length - 1]?.timestamp ?? 0,
        samplingRateFps: SAMPLE_RATE_FPS,
        sourceDurationSec: duration,
        sufficientForSummary,
        message: sufficientForSummary
          ? "All sampled frames met the core-landmark visibility threshold. Individual metrics may still be unavailable."
          : "Composite score withheld: every sampled frame must meet the core-landmark visibility threshold. Individual metrics may still be unavailable.",
      };

      setProgressMessage("Calculating landmark-derived metrics…");
      const kinematics = computeSequenceKinematics(frames);
      const gait = analyzeGaitCycles(
        frames.map((frame) => frame.timestamp),
        kinematics.leftAnkleY,
        kinematics.rightAnkleY,
        kinematics,
        frames
      );
      const symmetry = evaluateSymmetryAndConsistency(kinematics, gait);
      const formScore = calculateFormScore(kinematics, gait, symmetry, sufficientForSummary);
      const compiledReport: CompleteAnalysisReport = {
        totalFrames: frames.length,
        fps: SAMPLE_RATE_FPS,
        durationSec: duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        frames,
        kinematics,
        gait,
        symmetry,
        formScore,
        quality,
      };
      setReport(compiledReport);
      setAnalysisProgress(100);
      setProgressMessage("Analysis complete.");
    } catch (error) {
      if (jobId === activeJobRef.current) setErrorMessage(getErrorMessage(error));
    } finally {
      if (estimator) {
        try {
          await estimator.close();
        } catch (error) {
          console.error("Could not release MediaPipe Pose resources:", error);
        }
      }
      if (estimatorRef.current === estimator) estimatorRef.current = null;
      if (jobId === activeJobRef.current) setIsAnalyzing(false);
      video.removeAttribute("src");
      video.load();
      if (processingVideoRef.current === video) processingVideoRef.current = null;
    }
  };

  const handleVideoSelected = (file: File) => {
    const validationError = validateVideoFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setVideoFile(file);
    setErrorMessage(null);
    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setVideoUrl(url);
    void analyzeVideo(url);
  };

  const resetAnalysis = () => {
    activeJobRef.current++;
    const processingVideo = processingVideoRef.current;
    processingVideoRef.current = null;
    if (processingVideo) {
      processingVideo.pause();
      processingVideo.removeAttribute("src");
      processingVideo.load();
    }
    const estimator = estimatorRef.current;
    estimatorRef.current = null;
    if (estimator) void estimator.close().catch((error: unknown) => console.error("Could not close MediaPipe Pose:", error));
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current = null;
    setVideoFile(null);
    setVideoUrl(null);
    setReport(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setProgressMessage("");
    setActiveTab("summary");
  };

  const downloadCSVReport = () => {
    if (!report) return;
    const csv = buildCsvReport(report);
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "running_form_telemetry_report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <div className="min-h-screen pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-6">
        {!videoFile && !isAnalyzing && <VideoUploader onVideoSelected={handleVideoSelected} />}

        {errorMessage && (
          <div role="alert" className="my-6 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-red-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-danger" />
            <div className="flex-1"><strong>Analysis could not continue.</strong> {errorMessage}</div>
            <button onClick={resetAnalysis} className="underline underline-offset-2">Reset</button>
          </div>
        )}

        {isAnalyzing && (
          <div className="max-w-xl mx-auto my-20 bg-surface border border-border rounded-2xl p-8 text-center shadow-xl">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-100 mb-2">Analyzing Video Biomechanics</h3>
            <p className="text-xs text-slate-400 mb-6">{progressMessage}</p>
            <div className="w-full bg-card h-2.5 rounded-full overflow-hidden border border-border">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${analysisProgress}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-mono text-primary font-semibold">{analysisProgress}% Complete</span>
              <button onClick={resetAnalysis} className="text-xs text-slate-300 underline underline-offset-2">Cancel analysis</button>
            </div>
            <p className="text-[11px] text-slate-500 mt-4">
              Samples at {SAMPLE_RATE_FPS} fps, up to {MAX_SAMPLED_FRAMES} frames (first {MAX_SAMPLED_FRAMES / SAMPLE_RATE_FPS} seconds).
            </p>
          </div>
        )}

        {report && videoUrl && !isAnalyzing && (
          <div className="space-y-6">
            <AnalysisQualityPanel quality={report.quality} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(["summary", "video", "charts", "symmetry"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === tab ? "bg-primary text-black shadow-lg" : "bg-surface border border-border text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "summary" && "Coaching Summary"}
                    {tab === "video" && "Annotated Video Overlay"}
                    {tab === "charts" && "Kinematic Charts"}
                    {tab === "symmetry" && "Gait & Symmetry Breakdown"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={downloadCSVReport} className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-border/50 text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-primary" /> Download Report
                </button>
                <button onClick={resetAnalysis} className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-border/50 text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" /> New Analysis
                </button>
              </div>
            </div>

            {activeTab === "summary" && <div className="space-y-6"><ExecutiveSummary report={report} /><CoachingFeed report={report} /></div>}
            {activeTab === "video" && <TelemetryPlayer videoUrl={videoUrl} frames={report.frames} kinematics={report.kinematics} fps={report.fps} />}
            {activeTab === "charts" && <KinematicCharts report={report} />}
            {activeTab === "symmetry" && <SymmetryBreakdown report={report} />}
          </div>
        )}
      </main>
    </div>
  );
}

function AnalysisQualityPanel({ quality }: { quality: AnalysisQuality }) {
  return (
    <section className={`rounded-2xl border p-5 ${quality.sufficientForSummary ? "border-border bg-surface" : "border-warning/50 bg-warning/5"}`} aria-label="Analysis data quality">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-100">Data quality & analysis coverage</h2>
          <p className="text-sm text-slate-300 mt-1">{quality.message}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${quality.sufficientForSummary ? "border-success/30 text-success" : "border-warning/30 text-warning"}`}>
          {quality.sufficientForSummary ? "Complete core tracking" : "Incomplete core tracking"}
        </span>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-xs">
        <QualityValue label="Sampled frames" value={`${quality.sampledFrames}`} />
        <QualityValue label="Fully tracked" value={`${quality.trackedFrames}`} />
        <QualityValue label="Valid core tracking" value={`${quality.validTrackingPct}%`} />
        <QualityValue label="Mean landmark visibility" value={quality.meanLandmarkVisibility === null ? "Unavailable" : `${(quality.meanLandmarkVisibility * 100).toFixed(1)}%`} />
        <QualityValue label="Analyzed interval" value={`${quality.analyzedStartSec.toFixed(1)}–${quality.analyzedEndSec.toFixed(1)}s of ${quality.sourceDurationSec.toFixed(1)}s`} />
      </dl>
      <p className="text-[11px] text-slate-500 mt-4">
        MediaPipe visibility is the mean of exposed visibility values for core landmarks, not a model-accuracy score. Sampling: {quality.samplingRateFps} frames/s; maximum {MAX_SAMPLED_FRAMES} samples. Metrics identify whether they are landmark-derived, algorithmically estimated, heuristic, or unavailable.
        The video is processed locally and not uploaded; MediaPipe scripts/model assets from jsDelivr and the Google Fonts stylesheet may generate third-party asset requests.
      </p>
    </section>
  );
}

function QualityValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="font-mono font-semibold text-slate-200 mt-1">{value}</dd></div>;
}
