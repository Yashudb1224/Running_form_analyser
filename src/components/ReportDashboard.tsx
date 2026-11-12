import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, FileText, Loader2, PlusCircle, Sparkles } from "lucide-react";
import { AnalysisQuality, CompleteAnalysisReport } from "@/types/telemetry";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { EvidenceGallery, StepTimeline } from "./EvidenceGallery";
import { KinematicCharts } from "./KinematicCharts";
import { SymmetryBreakdown } from "./SymmetryBreakdown";
import { SeekRequest, TelemetryPlayer } from "./TelemetryPlayer";
import { MASCOT_NAME, Mascot } from "./Mascot";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ReportDashboardProps {
  report: CompleteAnalysisReport;
  videoUrl: string;
  videoName: string;
  saveStatus: SaveStatus;
  saveError: string | null;
  onExportPdf: () => void;
  onNewAnalysis: () => void;
  onOpenCoach: () => void;
}

const SECTIONS = [
  { id: "report-overview", label: "Overview" },
  { id: "report-video", label: "Video & evidence" },
  { id: "report-timing", label: "Stride timing" },
  { id: "report-charts", label: "Charts" },
  { id: "report-symmetry", label: "Symmetry" },
] as const;

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

function SaveBadge({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "saving") return <span className="status-pill bg-subtle text-body"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Saving</span>;
  if (status === "saved") return <span className="status-pill bg-success/10 text-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Saved to history</span>;
  if (status === "error") return <span className="status-pill bg-danger/10 text-danger" title={error ?? undefined}><CloudOff className="h-3.5 w-3.5" aria-hidden="true" />Not saved</span>;
  return null;
}

/** Highlights the section currently in view in the sticky section bar. */
function useActiveSection(): string {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);
  return active;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** The full analysis report as one dashboard page, with a sticky bar for jumping between sections. */
export function ReportDashboard({ report, videoUrl, videoName, saveStatus, saveError, onExportPdf, onNewAnalysis, onOpenCoach }: ReportDashboardProps) {
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);
  const activeSection = useActiveSection();

  const openInVideo = (time: number) => {
    setSeekRequest({ time, id: Date.now() });
    scrollToSection("report-video");
  };

  return (
    <div className="rise-in space-y-6 pt-6 lg:pt-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Analysis report</p>
          <h1 className="mt-1 truncate text-3xl font-bold tracking-tight text-ink">{videoName}</h1>
          <p className="mt-1 text-xs text-muted">
            {report.quality.analyzedStartSec.toFixed(1)}–{report.quality.analyzedEndSec.toFixed(1)} s analysed
            <span className="px-2 text-border-strong">·</span>{report.quality.sampledFrames} frames
            <span className="px-2 text-border-strong">·</span>{report.quality.samplingRateFps} frames/s
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveBadge status={saveStatus} error={saveError} />
          <button type="button" onClick={onExportPdf} className="control-button min-h-10">
            <FileText className="h-4 w-4" aria-hidden="true" /> Export PDF
          </button>
          <button type="button" onClick={onNewAnalysis} className="primary-button">
            <PlusCircle className="h-4 w-4" aria-hidden="true" /> New analysis
          </button>
        </div>
      </header>

      <RecordingWarnings quality={report.quality} />

      <nav aria-label="Report sections" className="sticky top-14 z-30 -mx-1 lg:top-3">
        <div className="panel flex gap-1 overflow-x-auto p-1">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              aria-current={activeSection === id ? "true" : undefined}
              className={`min-h-9 shrink-0 rounded-xl px-3 text-xs font-semibold transition duration-150 sm:px-4 ${
                activeSection === id ? "bg-button-gradient text-white shadow-md" : "text-body hover:bg-subtle hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={onOpenCoach} className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-primary transition hover:bg-brand-soft">
            <Mascot size={18} /> Ask {MASCOT_NAME}
          </button>
        </div>
      </nav>

      <section id="report-overview" className="scroll-mt-28 space-y-6">
        <ExecutiveSummary report={report} />
        <div className="gradient-border">
          <div className="flex flex-col gap-4 rounded-[14px] bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Mascot size={48} className="-my-1 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink">Want to know what to work on? Ask {MASCOT_NAME}!</p>
                <p className="mt-0.5 text-xs text-muted">Your AI running buddy turns these results into priorities, cues and drills, compares this run with your earlier ones, and answers your questions.</p>
              </div>
            </div>
            <button type="button" onClick={onOpenCoach} className="primary-button shrink-0">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Chat with {MASCOT_NAME}
            </button>
          </div>
        </div>
      </section>

      <section id="report-video" className="scroll-mt-28 space-y-3">
        <div>
          <p className="eyebrow">Proof</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Video and evidence</h2>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TelemetryPlayer
            videoUrl={videoUrl}
            frames={report.frames}
            kinematics={report.kinematics}
            events={report.gait.events}
            fps={report.fps}
            seekRequest={seekRequest}
          />
          <EvidenceGallery report={report} onOpenInVideo={openInVideo} layout="column" showTimeline={false} />
        </div>
      </section>

      <section id="report-timing" className="scroll-mt-28">
        <StepTimeline report={report} />
      </section>

      <section id="report-charts" className="scroll-mt-28">
        <KinematicCharts report={report} />
      </section>

      <section id="report-symmetry" className="scroll-mt-28">
        <SymmetryBreakdown report={report} />
      </section>
    </div>
  );
}
