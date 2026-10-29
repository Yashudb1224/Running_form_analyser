"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { VideoUploader } from "@/components/VideoUploader";
import { SeekRequest, TelemetryPlayer } from "@/components/TelemetryPlayer";
import { EvidenceGallery } from "@/components/EvidenceGallery";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { MetricGuide } from "@/components/MetricGuide";
import { KinematicCharts } from "@/components/KinematicCharts";
import { SymmetryBreakdown } from "@/components/SymmetryBreakdown";
import { AnalysisQuality, CompleteAnalysisReport, EvidenceFrame, FramePose } from "@/types/telemetry";
import { computeSequenceKinematics } from "@/lib/biomechanics";
import { analyzeGaitCycles } from "@/lib/gaitCycle";
import { evaluateSymmetryAndConsistency } from "@/lib/symmetryAnalyzer";
import { calculateFormScore } from "@/lib/formScorer";
import { buildAnalysisQuality } from "@/lib/analysisQuality";
import { captureEvidenceFrames } from "@/lib/evidenceFrames";
import { correctLegSwaps } from "@/lib/legTracking";
import { BrowserPoseEstimator, convertMediaPipeLandmarks, createUnavailableFrame } from "@/lib/poseEstimator";
import { FileText, RefreshCw, Loader2, AlertTriangle } from "lucide-react";

// A running step lasts ~0.3 s, so 30 samples/s are needed to time steps and catch foot strike.
const SAMPLE_RATE_FPS = 30;
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
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);
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
      const rawFrames: FramePose[] = [];
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
        // Seek to the middle of each sample interval: a seek to a frame's exact start time can round
        // down to the previous frame, which would misalign landmarks, overlay and evidence frames.
        const requestedTime = Math.min((index + 0.5) / SAMPLE_RATE_FPS, Math.max(0, duration - 0.001));
        setProgressMessage(`Seeking and tracking sample ${index + 1} of ${sampleCount}…`);
        const actualTime = await seekVideo(video, requestedTime);
        if (jobId !== activeJobRef.current) return;

        latestLandmarks = undefined;
        await estimator.sendFrame(video);
        if (jobId !== activeJobRef.current) return;
        rawFrames.push(latestLandmarks
          ? convertMediaPipeLandmarks(latestLandmarks, index, actualTime, video.videoWidth, video.videoHeight)
          : createUnavailableFrame(index, actualTime));
        setAnalysisProgress(5 + Math.round(((index + 1) / sampleCount) * 85));
      }

      await estimator.close();
      estimatorRef.current = null;
      estimator = null;

      setProgressMessage("Calculating landmark-derived metrics…");
      // Fix left/right leg swaps from the pose model before anything is measured.
      const { frames, swapEpisodes } = correctLegSwaps(rawFrames);
      const kinematics = computeSequenceKinematics(frames);
      const gait = analyzeGaitCycles(
        frames.map((frame) => frame.timestamp),
        kinematics.leftAnkleY,
        kinematics.rightAnkleY,
        kinematics,
        frames
      );
      const quality = buildAnalysisQuality(frames, kinematics, gait, {
        samplingRateFps: SAMPLE_RATE_FPS,
        sourceDurationSec: duration,
        legSwapEpisodes: swapEpisodes,
      });
      const symmetry = evaluateSymmetryAndConsistency(kinematics, gait);
      const formScore = calculateFormScore(kinematics, gait, symmetry, quality.sufficientForSummary);

      setProgressMessage("Capturing evidence frames from the video…");
      setAnalysisProgress(95);
      let evidence: EvidenceFrame[] = [];
      try {
        evidence = await captureEvidenceFrames(video, { frames, kinematics, gait }, (time) => seekVideo(video, time));
      } catch (error) {
        console.error("Could not capture evidence frames:", error);
      }
      if (jobId !== activeJobRef.current) return;

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
        evidence,
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

  const openInVideo = (time: number) => {
    setSeekRequest({ time, id: Date.now() });
    setActiveTab("video");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    setSeekRequest(null);
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
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {!videoFile && !isAnalyzing && (
          <VideoUploader
            onVideoSelected={handleVideoSelected}
            samplingRateFps={SAMPLE_RATE_FPS}
            maxAnalyzedSeconds={MAX_SAMPLED_FRAMES / SAMPLE_RATE_FPS}
          />
        )}

        {errorMessage && (
          <div role="alert" className="my-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-ink">
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
                <h3 className="text-base font-semibold text-ink">Analysing running video</h3>
                <p className="mt-1 text-xs text-body">{progressMessage}</p>
              </div>
            </div>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={analysisProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Video analysis progress">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${analysisProgress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium tabular-nums text-body">{analysisProgress}%</span>
              <button onClick={resetAnalysis} className="quiet-button min-h-8">Cancel analysis</button>
            </div>
            <p className="mt-3 text-[11px] text-muted">Sampling at {SAMPLE_RATE_FPS} frames/s, up to {MAX_SAMPLED_FRAMES} samples from the first {MAX_SAMPLED_FRAMES / SAMPLE_RATE_FPS} seconds.</p>
          </div>
        )}

        {report && videoUrl && !isAnalyzing && (
          <div className="space-y-5 pb-8">
            <div className="flex flex-col gap-3 pt-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="eyebrow">Analysis report</p>
                <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink">{videoFile?.name ?? "Running video"}</h2>
                <p className="mt-1 text-xs text-muted">
                  {report.quality.analyzedStartSec.toFixed(1)}–{report.quality.analyzedEndSec.toFixed(1)} s analyzed
                  <span className="px-2 text-border-strong">·</span>{report.quality.sampledFrames} sampled frames
                  <span className="px-2 text-border-strong">·</span>{report.quality.samplingRateFps} samples/s
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
            <RecordingWarnings quality={report.quality} />
            <div className="max-w-full overflow-x-auto">
              <div className="inline-flex gap-1 rounded-xl border border-border bg-surface p-1 shadow-card" role="tablist" aria-label="Analysis report sections">
                {(["summary", "video", "charts", "symmetry", "guide"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setSeekRequest(null);
                      setActiveTab(tab);
                    }}
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls={`${tab}-report-panel`}
                    id={`${tab}-report-tab`}
                    className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors sm:px-4 ${
                      activeTab === tab ? "bg-primary text-on-primary" : "text-body hover:bg-subtle hover:text-ink"
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

            {activeTab === "summary" && (
              <div role="tabpanel" id="summary-report-panel" aria-labelledby="summary-report-tab" className="space-y-8 pt-2">
                <ExecutiveSummary report={report} />
                <EvidenceGallery report={report} onOpenInVideo={openInVideo} />
              </div>
            )}
            {activeTab === "video" && (
              <div role="tabpanel" id="video-report-panel" aria-labelledby="video-report-tab" className="pt-2">
                <TelemetryPlayer
                  videoUrl={videoUrl}
                  frames={report.frames}
                  kinematics={report.kinematics}
                  events={report.gait.events}
                  fps={report.fps}
                  seekRequest={seekRequest}
                />
              </div>
            )}
            {activeTab === "charts" && <div role="tabpanel" id="charts-report-panel" aria-labelledby="charts-report-tab" className="pt-2"><KinematicCharts report={report} /></div>}
            {activeTab === "symmetry" && <div role="tabpanel" id="symmetry-report-panel" aria-labelledby="symmetry-report-tab" className="pt-2"><SymmetryBreakdown report={report} /></div>}
            {activeTab === "guide" && <div role="tabpanel" id="guide-report-panel" aria-labelledby="guide-report-tab" className="pt-2"><MetricGuide /></div>}
          </div>
        )}
      </main>
    </div>
  );
}

/** Shown only when something about the recording needs attention; otherwise nothing is rendered. */
function RecordingWarnings({ quality }: { quality: AnalysisQuality }) {
  if (!quality.warnings.length) return null;
  return (
    <section className="panel border-warning/40 p-4" aria-label="Recording warnings">
      <ul className="space-y-1.5">
        {quality.warnings.map((warning) => (
          <li key={warning} className="flex gap-2 text-xs leading-relaxed text-body">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
            {warning}
          </li>
        ))}
      </ul>
    </section>
  );
}
