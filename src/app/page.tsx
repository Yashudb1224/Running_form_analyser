"use client";

import React, { useEffect, useRef, useState } from "react";
import { AppShell, AppView } from "@/components/AppShell";
import { ReportDashboard } from "@/components/ReportDashboard";
import { DashHello, DashLauncher } from "@/components/DashLauncher";
import { VideoUploader } from "@/components/VideoUploader";
import { AICoach } from "@/components/AICoach";
import { MetricGuide } from "@/components/MetricGuide";
import { CompleteAnalysisReport, EvidenceFrame, FramePose } from "@/types/telemetry";
import { computeSequenceKinematics } from "@/lib/biomechanics";
import { analyzeGaitCycles } from "@/lib/gaitCycle";
import { evaluateSymmetryAndConsistency } from "@/lib/symmetryAnalyzer";
import { calculateFormScore } from "@/lib/formScorer";
import { buildAnalysisQuality } from "@/lib/analysisQuality";
import { captureEvidenceFrames } from "@/lib/evidenceFrames";
import { correctLegSwaps } from "@/lib/legTracking";
import { BrowserPoseEstimator, convertMediaPipeLandmarks, createUnavailableFrame } from "@/lib/poseEstimator";
import { Loader2, AlertTriangle, Dumbbell, LineChart } from "lucide-react";
import { Trainer } from "@/components/Trainer";
import { useAuth } from "@/components/AuthProvider";
import { SignInPanel } from "@/components/SignInPanel";
import { AnalysisHistory } from "@/components/AnalysisHistory";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { saveAnalysis, toAnalysisRecord } from "@/lib/analysisRecord";

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
  const [view, setView] = useState<AppView>("new");
  const [coachOpen, setCoachOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const auth = useAuth();
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = auth.user?.id ?? null;
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

  const analyzeVideo = async (url: string, videoName: string) => {
    const jobId = ++activeJobRef.current;
    setIsAnalyzing(true);
    setView("report");
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
      void saveToHistory(compiledReport, videoName);
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

  /** Saves the finished analysis for the signed-in user; the video itself is never uploaded. */
  const saveToHistory = async (analysis: CompleteAnalysisReport, videoName: string) => {
    const supabase = getSupabase();
    if (!supabase || !userIdRef.current) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const saved = await saveAnalysis(supabase, toAnalysisRecord(analysis, videoName));
      setSavedAnalysisId(saved.id);
      setSaveStatus("saved");
      setHistoryVersion((version) => version + 1);
    } catch (error) {
      setSaveStatus("error");
      setSaveError(getErrorMessage(error));
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
    void analyzeVideo(url, file.name);
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
    setSaveStatus("idle");
    setSaveError(null);
    setSavedAnalysisId(null);
    setView("new");
  };

  const downloadReportPdf = async () => {
    if (!report) return;
    const { downloadPdfReport } = await import("@/lib/pdfReport");
    downloadPdfReport(report, videoFile?.name ?? "running-analysis");
  };

  const navigate = (next: AppView) => {
    if (next === "new" && (report || isAnalyzing)) {
      if (!window.confirm("Start a new analysis? The current report will close (saved reports stay in Progress).")) return;
      resetAnalysis();
      return;
    }
    setView(next);
    window.scrollTo({ top: 0 });
  };

  const needsSignIn = auth.enabled && !auth.loading && !auth.user;
  const historyAvailable = Boolean(auth.user) && isSupabaseConfigured();
  const videoName = videoFile?.name ?? "Running video";
  const signIn = <SignInPanel onSignIn={() => void auth.signInWithGoogle()} error={auth.error} />;

  return (
    <AppShell view={view} onNavigate={navigate} reportLabel={report || isAnalyzing ? videoName : null}>
      {errorMessage && (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="flex-1"><strong>Analysis could not continue.</strong> {errorMessage}</div>
          <button onClick={resetAnalysis} className="text-xs font-semibold underline underline-offset-2">Reset</button>
        </div>
      )}

      {auth.enabled && auth.loading && view !== "guide" && (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Checking sign-in" /></div>
      )}

      {view === "new" && !auth.loading && (needsSignIn ? signIn : (
        <VideoUploader
          onVideoSelected={handleVideoSelected}
          samplingRateFps={SAMPLE_RATE_FPS}
          maxAnalyzedSeconds={MAX_SAMPLED_FRAMES / SAMPLE_RATE_FPS}
        />
      ))}

      {view === "report" && isAnalyzing && (
        <div className="pt-6 lg:pt-8">
          <div className="panel rise-in mx-auto my-8 max-w-xl p-5 sm:my-14 sm:p-8">
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-ink">Analysing {videoName}</h1>
                <p className="mt-1 text-xs text-body">{progressMessage}</p>
              </div>
            </div>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={analysisProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Video analysis progress">
              <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-300" style={{ width: `${analysisProgress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium tabular-nums text-body">{analysisProgress}%</span>
              <button onClick={resetAnalysis} className="quiet-button min-h-8">Cancel analysis</button>
            </div>
            <p className="mt-3 text-[11px] text-muted">Sampling at {SAMPLE_RATE_FPS} frames/s, up to {MAX_SAMPLED_FRAMES} samples from the first {MAX_SAMPLED_FRAMES / SAMPLE_RATE_FPS} seconds.</p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="panel space-y-3 p-4">
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-7 w-2/3" />
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-2 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The report stays mounted while open so the video position and scroll survive page switches. */}
      {report && videoUrl && !isAnalyzing && (
        <div className={view === "report" ? "" : "hidden"}>
          <ReportDashboard
            report={report}
            videoUrl={videoUrl}
            videoName={videoName}
            saveStatus={saveStatus}
            saveError={saveError}
            onExportPdf={() => void downloadReportPdf()}
            onNewAnalysis={() => navigate("new")}
            onOpenCoach={() => setCoachOpen(true)}
          />
        </div>
      )}

      {view === "progress" && !auth.loading && (needsSignIn ? signIn : (
        <div className="rise-in space-y-6 pt-6 lg:pt-8">
          <PageHeading icon={<LineChart className="h-5 w-5" aria-hidden="true" />} eyebrow="Your history" title="Progress" text="Every saved analysis, with your form score over time." />
          {historyAvailable
            ? <AnalysisHistory refreshKey={historyVersion} />
            : <p className="panel p-5 text-sm text-muted">Saved history needs sign-in and a configured database.</p>}
        </div>
      ))}

      {/* Dash floats in the corner; his chat panel stays mounted so a conversation survives closing it. */}
      {!auth.loading && (
        <DashLauncher open={coachOpen} onOpenChange={setCoachOpen}>
          {needsSignIn ? (
            <div className="space-y-6">
              <DashHello text="Hellooo! I'm Dash, your running buddy. Sign in and I'll coach you on every run!" />
              {signIn}
            </div>
          ) : <AICoach report={report} videoName={report ? videoName : null} analysisId={savedAnalysisId} />}
        </DashLauncher>
      )}

      {view === "trainer" && !auth.loading && (
        <div className="rise-in space-y-6 pt-6 lg:pt-8">
          <PageHeading
            icon={<Dumbbell className="h-5 w-5" aria-hidden="true" />}
            eyebrow="Strength & drills"
            title="Trainer"
            text="Exercises picked for your weakest measures, each with an animated demonstration."
          />
          <Trainer report={report} videoName={report ? videoName : null} onAskDash={() => setCoachOpen(true)} />
        </div>
      )}

      {view === "guide" && (
        <div className="rise-in pt-6 lg:pt-8">
          <MetricGuide />
        </div>
      )}
    </AppShell>
  );
}

function PageHeading({ icon, eyebrow, title, text }: { icon: React.ReactNode; eyebrow: string; title: string; text: string }) {
  return (
    <header className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-md">{icon}</span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </header>
  );
}
