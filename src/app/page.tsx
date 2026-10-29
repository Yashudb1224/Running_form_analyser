"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { VideoUploader } from "@/components/VideoUploader";
import { TelemetryPlayer } from "@/components/TelemetryPlayer";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { MetricGuide } from "@/components/MetricGuide";
import { KinematicCharts } from "@/components/KinematicCharts";
import { SymmetryBreakdown } from "@/components/SymmetryBreakdown";
import { AnalysisQuality, CompleteAnalysisReport, FramePose } from "@/types/telemetry";
import { computeSequenceKinematics } from "@/lib/biomechanics";
import { analyzeGaitCycles } from "@/lib/gaitCycle";
import { evaluateSymmetryAndConsistency } from "@/lib/symmetryAnalyzer";
import { calculateFormScore } from "@/lib/formScorer";
import { BrowserPoseEstimator, convertMediaPipeLandmarks, createUnavailableFrame, hasCompleteTrackingCoverage } from "@/lib/poseEstimator";
import { FileText, RefreshCw, Loader2, AlertTriangle } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"summary" | "video" | "charts" | "symmetry" | "guide">("summary");
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

  const downloadReportPdf = async () => {
    if (!report) return;
    const { downloadPdfReport } = await import("@/lib/pdfReport");
    downloadPdfReport(report, videoFile?.name ?? "running-analysis");
  };

  return (
    <div className="app-shell pb-12">
      <Header />
      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {!videoFile && !isAnalyzing && <VideoUploader onVideoSelected={handleVideoSelected} />}

        {errorMessage && (
          <div role="alert" className="my-6 flex items-start gap-3 border border-danger/30 bg-red-50 p-4 text-sm text-red-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div className="flex-1"><strong>Analysis could not continue.</strong> {errorMessage}</div>
            <button onClick={resetAnalysis} className="text-xs font-semibold underline underline-offset-2">Reset</button>
          </div>
        )}

        {isAnalyzing && (
          <div className="panel mx-auto my-12 max-w-xl p-5 sm:my-20 sm:p-8">
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">Analyzing running video</h3>
                <p className="mt-1 text-xs text-slate-600">{progressMessage}</p>
              </div>
            </div>
            <div className="mt-5 h-1.5 w-full overflow-hidden bg-slate-100" role="progressbar" aria-valuenow={analysisProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Video analysis progress">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${analysisProgress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-xs font-medium text-slate-600">{analysisProgress}%</span>
              <button onClick={resetAnalysis} className="quiet-button min-h-8">Cancel analysis</button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Sampling at {SAMPLE_RATE_FPS} frames/s, up to {MAX_SAMPLED_FRAMES} samples from the first {MAX_SAMPLED_FRAMES / SAMPLE_RATE_FPS} seconds.</p>
          </div>
        )}

        {report && videoUrl && !isAnalyzing && (
          <div className="space-y-5 pb-8">
            <div className="flex flex-col gap-3 border-b border-border py-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Analysis report</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{videoFile?.name ?? "Running video"}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {report.quality.analyzedStartSec.toFixed(1)}–{report.quality.analyzedEndSec.toFixed(1)} s analyzed
                  <span className="px-2 text-slate-300">·</span>{report.quality.sampledFrames} sampled frames
                  <span className="px-2 text-slate-300">·</span>{report.quality.samplingRateFps} samples/s
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={downloadReportPdf} className="primary-button min-h-9">
                  <FileText className="h-4 w-4" /> Export PDF
                </button>
                <button onClick={resetAnalysis} className="control-button">
                  <RefreshCw className="h-4 w-4" /> New analysis
                </button>
              </div>
            </div>
            <AnalysisQualityPanel quality={report.quality} />
            <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Analysis report sections">
                {(["summary", "video", "charts", "symmetry", "guide"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls={`${tab}-report-panel`}
                    id={`${tab}-report-tab`}
                    className={`min-h-10 shrink-0 border-b-2 px-3 text-xs font-semibold transition-colors sm:px-4 ${
                      activeTab === tab ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab === "summary" && "Summary"}
                    {tab === "video" && "Video analysis"}
                    {tab === "charts" && "Kinematics"}
                    {tab === "symmetry" && "Gait & symmetry"}
                    {tab === "guide" && "Metric guide"}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "summary" && <div role="tabpanel" id="summary-report-panel" aria-labelledby="summary-report-tab" className="pt-2"><ExecutiveSummary report={report} /></div>}
            {activeTab === "video" && <div role="tabpanel" id="video-report-panel" aria-labelledby="video-report-tab" className="pt-2"><TelemetryPlayer videoUrl={videoUrl} frames={report.frames} kinematics={report.kinematics} fps={report.fps} /></div>}
            {activeTab === "charts" && <div role="tabpanel" id="charts-report-panel" aria-labelledby="charts-report-tab" className="pt-2"><KinematicCharts report={report} /></div>}
            {activeTab === "symmetry" && <div role="tabpanel" id="symmetry-report-panel" aria-labelledby="symmetry-report-tab" className="pt-2"><SymmetryBreakdown report={report} /></div>}
            {activeTab === "guide" && <div role="tabpanel" id="guide-report-panel" aria-labelledby="guide-report-tab" className="pt-2"><MetricGuide /></div>}
          </div>
        )}
      </main>
    </div>
  );
}

function AnalysisQualityPanel({ quality }: { quality: AnalysisQuality }) {
  return (
    <section className={`border px-4 py-3 ${quality.sufficientForSummary ? "border-border bg-surface" : "border-warning/40 bg-amber-50/60"}`} aria-label="Analysis data quality">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-slate-800">Data quality & coverage</h2>
        </div>
        <span className={`shrink-0 text-[11px] font-semibold ${quality.sufficientForSummary ? "text-success" : "text-warning"}`}>
          {quality.sufficientForSummary ? "Complete tracking" : "Incomplete tracking"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
        <QualityValue label="Sampled frames" value={`${quality.sampledFrames}`} />
        <QualityValue label="Fully tracked" value={`${quality.trackedFrames}`} />
        <QualityValue label="Valid core tracking" value={`${quality.validTrackingPct}%`} />
        <QualityValue label="Mean landmark visibility" value={quality.meanLandmarkVisibility === null ? "Unavailable" : `${(quality.meanLandmarkVisibility * 100).toFixed(1)}%`} />
        <QualityValue label="Analyzed interval" value={`${quality.analyzedStartSec.toFixed(1)}–${quality.analyzedEndSec.toFixed(1)}s of ${quality.sourceDurationSec.toFixed(1)}s`} />
      </dl>
    </section>
  );
}

function QualityValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 font-mono font-medium text-slate-800">{value}</dd></div>;
}
