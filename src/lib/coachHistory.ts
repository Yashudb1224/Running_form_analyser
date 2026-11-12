import type { ChatMessage, CoachAdvice } from "./coach";

/** Saved analysis fields the coach uses to compare sessions (a subset of the `analyses` row). */
export interface HistoryAnalysis {
  id: string;
  created_at: string;
  video_name: string;
  overall_score: number | null;
  cadence_spm: number | null;
  shank_angle_deg: number | null;
  knee_flexion_deg: number | null;
  trunk_lean_deg: number | null;
  stride_cv_pct: number | null;
  symmetry_index_pct: number | null;
  landing_offset_torso_pct: number | null;
}

/** Saved coach conversation fields used as memory of earlier chats. */
export interface HistoryConversation {
  id: string;
  created_at: string;
  title: string;
  advice: CoachAdvice | null;
  messages: ChatMessage[] | null;
}

export const HISTORY_LIMITS = {
  analyses: 30,
  conversations: 12,
  messagesPerConversation: 6,
  messageChars: 280,
} as const;

function value(number: number | null, unit: string, digits = 1): string {
  return number === null || number === undefined || !Number.isFinite(Number(number)) ? "n/a" : `${Number(number).toFixed(digits)}${unit}`;
}

function day(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Formats the runner's saved sessions and earlier chats as compact text for the model, oldest
 * session first so trends read naturally. The open conversation is excluded (it is sent in full).
 */
export function buildRunnerHistory(
  analyses: HistoryAnalysis[],
  conversations: HistoryConversation[],
  excludeConversationId: string | null = null
): string {
  const sessions = [...analyses]
    .slice(0, HISTORY_LIMITS.analyses)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const sessionLines = sessions.map((analysis, index) => [
    `${index + 1}. ${day(analysis.created_at)} · "${analysis.video_name}"`,
    `score ${analysis.overall_score ?? "n/a"}/100`,
    `cadence ${value(analysis.cadence_spm, " spm", 0)}`,
    `shin at strike ${value(analysis.shank_angle_deg, "°")}`,
    `knee flexion ${value(analysis.knee_flexion_deg, "°")}`,
    `trunk lean ${value(analysis.trunk_lean_deg, "°")}`,
    `stride variation ${value(analysis.stride_cv_pct, "%")}`,
    `symmetry index ${value(analysis.symmetry_index_pct, "%")}`,
    `foot ahead of hip ${value(analysis.landing_offset_torso_pct, "% torso")}`,
  ].join(" | "));

  const chats = conversations
    .filter((conversation) => conversation.id !== excludeConversationId)
    .slice(0, HISTORY_LIMITS.conversations)
    .map((conversation) => {
      const lines = [`- ${day(conversation.created_at)} · ${conversation.title}`];
      if (conversation.advice?.headline) lines.push(`  Coaching given: ${truncate(conversation.advice.headline, HISTORY_LIMITS.messageChars)}`);
      if (conversation.advice?.priorities?.length) {
        lines.push(`  Priorities: ${conversation.advice.priorities.map((priority) => priority.title).join("; ")}`);
      }
      for (const message of (conversation.messages ?? []).slice(-HISTORY_LIMITS.messagesPerConversation)) {
        lines.push(`  ${message.role === "user" ? "Runner" : "Coach"}: ${truncate(message.text.replace(/\s+/g, " "), HISTORY_LIMITS.messageChars)}`);
      }
      return lines.join("\n");
    });

  return [
    `RUNNER'S SAVED SESSIONS (${sessions.length}, oldest first):`,
    sessionLines.length ? sessionLines.join("\n") : "None saved yet.",
    "",
    `EARLIER COACHING CHATS (${chats.length}, newest first):`,
    chats.length ? chats.join("\n") : "None yet.",
  ].join("\n");
}
