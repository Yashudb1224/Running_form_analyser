import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Dumbbell, Target } from "lucide-react";
import { CompleteAnalysisReport } from "@/types/telemetry";
import { AnalysisRecord, listAnalyses } from "@/lib/analysisRecord";
import {
  EXERCISES, Exercise, TrainerMetrics, Weakness, WeaknessId, detectWeaknesses, metricsFromRecord, metricsFromReport, recommendExercises,
} from "@/lib/exercises";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "./AuthProvider";
import { ExerciseFigure } from "./ExerciseFigure";
import { MASCOT_NAME, Mascot } from "./Mascot";

const WEAKNESS_LABELS: Record<WeaknessId, string> = {
  overstride: "Overstriding",
  lowCadence: "Low cadence",
  stiffKnee: "Stiff landing",
  crouchedKnee: "Sitting low",
  uprightTrunk: "Too upright",
  excessiveLean: "Leaning too far",
  irregularRhythm: "Uneven rhythm",
  asymmetry: "Imbalance",
};

function ExerciseCard({ exercise, reasons }: { exercise: Exercise; reasons: WeaknessId[] }) {
  return (
    <article className="panel panel-interactive flex flex-col overflow-hidden">
      <div className="relative bg-brand-soft">
        <ExerciseFigure animation={exercise.animation} label={exercise.name} className="mx-auto h-44 w-full max-w-[16rem]" />
        <span className="status-pill absolute right-3 top-3 bg-surface/90 text-ink shadow-card">{exercise.dose}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold text-ink">{exercise.name}</h3>
        {reasons.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {reasons.map((reason) => (
              <span key={reason} className="status-pill bg-warning/10 text-warning">Fixes: {WEAKNESS_LABELS[reason]}</span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs leading-relaxed text-body">{exercise.why}</p>
        <ul className="mt-3 space-y-1.5 border-t border-border/70 pt-3">
          {exercise.cues.map((cue) => (
            <li key={cue} className="flex gap-2 text-xs text-body">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />{cue}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/**
 * Exercise recommendations from the runner's weakest measures, using the open report or the latest
 * saved session, each demonstrated by an animated figure.
 */
export function Trainer({ report, videoName, onAskDash }: { report: CompleteAnalysisReport | null; videoName: string | null; onAskDash: () => void }) {
  const auth = useAuth();
  const [latest, setLatest] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (report || !auth.user || !isSupabaseConfigured() || !supabase) return;
    setLoading(true);
    listAnalyses(supabase, 1)
      .then((records) => setLatest(records[0] ?? null))
      .catch(() => setLatest(null))
      .finally(() => setLoading(false));
  }, [report, auth.user]);

  const source = useMemo((): { metrics: TrainerMetrics | null; label: string } => {
    if (report) return { metrics: metricsFromReport(report), label: `your current report (${videoName ?? "running video"})` };
    if (latest) {
      const date = new Date(latest.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      return { metrics: metricsFromRecord(latest), label: `your latest saved session (${latest.video_name}, ${date})` };
    }
    return { metrics: null, label: "" };
  }, [report, latest, videoName]);

  const weaknesses: Weakness[] = useMemo(() => (source.metrics ? detectWeaknesses(source.metrics) : []), [source.metrics]);
  const plan = useMemo(() => recommendExercises(weaknesses), [weaknesses]);

  return (
    <div className="space-y-6">
      <div className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Mascot size={56} mood={weaknesses.length ? "idle" : "happy"} className="-my-2 shrink-0" />
          <p className="text-sm leading-relaxed text-body">
            {loading ? "Loading your latest session…" : source.metrics
              ? <>Built from <strong className="font-semibold text-ink">{source.label}</strong>. {weaknesses.length ? `I found ${weaknesses.length} thing${weaknesses.length === 1 ? "" : "s"} to work on.` : "Everything is in range, so here's a routine to keep it that way!"}</>
              : "Analyse a video and I'll build exercises around your weak spots. Until then, here's a balanced starter routine."}
          </p>
        </div>
        <button type="button" onClick={onAskDash} className="control-button shrink-0">
          <Mascot size={18} /> Ask {MASCOT_NAME} for a weekly plan
        </button>
      </div>

      {weaknesses.length > 0 && (
        <section aria-labelledby="focus-heading">
          <h2 id="focus-heading" className="flex items-center gap-2 text-sm font-semibold text-ink"><Target className="h-4 w-4 text-primary" aria-hidden="true" />Focus areas</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {weaknesses.map((weakness, index) => (
              <li key={weakness.id} className="panel p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">{index + 1}</span>
                  <p className="text-sm font-semibold text-ink">{weakness.title}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-body">{weakness.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Dumbbell className="h-4 w-4 text-primary" aria-hidden="true" />
          {weaknesses.length ? "Your exercises" : "Starter routine"}
          <span className="text-xs font-normal text-muted">· 2–3 times a week, after an easy run or as a warm-up</span>
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plan.map(({ exercise, reasons }) => <ExerciseCard key={exercise.id} exercise={exercise} reasons={reasons} />)}
        </div>
      </section>

      <section>
        <button type="button" onClick={() => setShowLibrary((open) => !open)} className="control-button" aria-expanded={showLibrary}>
          <ChevronDown className={`h-4 w-4 transition-transform ${showLibrary ? "rotate-180" : ""}`} aria-hidden="true" />
          {showLibrary ? "Hide" : "Browse"} all {EXERCISES.length} exercises
        </button>
        {showLibrary && (
          <div className="rise-in mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {EXERCISES.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} reasons={[]} />)}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">Stop any exercise that causes pain, and check with a physiotherapist if you have an injury.</p>
    </div>
  );
}
