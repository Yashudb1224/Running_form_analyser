import type { SupabaseClient } from "@supabase/supabase-js";
import { CompleteAnalysisReport } from "../types/telemetry";
import { meanForwardTrunkLean } from "./formScorer";

const TABLE = "analyses";

/** One saved analysis, as stored in the `analyses` table (see supabase/schema.sql). */
export interface AnalysisRecord {
  id: string;
  created_at: string;
  video_name: string;
  analysed_seconds: number | null;
  overall_score: number | null;
  category: string | null;
  cadence_spm: number | null;
  shank_angle_deg: number | null;
  knee_flexion_deg: number | null;
  trunk_lean_deg: number | null;
  stride_cv_pct: number | null;
  symmetry_index_pct: number | null;
  landing_offset_torso_pct: number | null;
  vertical_oscillation_torso_pct: number | null;
  details: {
    subScores?: Record<string, number | null>;
    observations?: string[];
    warnings?: string[];
  };
}

export type NewAnalysisRecord = Omit<AnalysisRecord, "id" | "created_at">;

/** Flattens a report into the row saved for the user's history. No video or images are included. */
export function toAnalysisRecord(report: CompleteAnalysisReport, videoName: string): NewAnalysisRecord {
  const { gait, symmetry, formScore, quality } = report;
  return {
    video_name: videoName,
    analysed_seconds: Math.round((quality.analyzedEndSec - quality.analyzedStartSec) * 10) / 10,
    overall_score: formScore.overallScore.value,
    category: formScore.category,
    cadence_spm: gait.cadenceSpm.value,
    shank_angle_deg: gait.footStrikeShankAngleDeg.value,
    knee_flexion_deg: gait.midstanceKneeFlexionDeg.value,
    trunk_lean_deg: meanForwardTrunkLean(report.kinematics),
    stride_cv_pct: gait.strideTimeCvPct.value,
    symmetry_index_pct: symmetry.symmetryIndexPct.value,
    landing_offset_torso_pct: gait.ankleAheadOfHipTorsoPct.value,
    vertical_oscillation_torso_pct: gait.verticalOscillationTorsoPct.value,
    details: {
      subScores: Object.fromEntries(Object.entries(formScore.subScores).map(([key, score]) => [key, score.value])),
      observations: formScore.observations,
      warnings: quality.warnings,
    },
  };
}

export async function saveAnalysis(supabase: SupabaseClient, record: NewAnalysisRecord): Promise<AnalysisRecord> {
  const { data, error } = await supabase.from(TABLE).insert(record).select().single();
  if (error) throw new Error(error.message);
  return data as AnalysisRecord;
}

export async function listAnalyses(supabase: SupabaseClient, limit = 50): Promise<AnalysisRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AnalysisRecord[];
}

export async function deleteAnalysis(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
