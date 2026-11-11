import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, CoachAdvice, CoachRequest } from "./coach";

const TABLE = "coach_conversations";

/** Context stored with a conversation: what the coach saw, minus the images. */
export type CoachContext = Omit<CoachRequest, "images">;

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  analysis_id: string | null;
  messageCount: number;
}

export interface Conversation extends Omit<ConversationSummary, "messageCount"> {
  context: CoachContext;
  advice: CoachAdvice | null;
  messages: ChatMessage[];
}

export function toCoachContext(request: CoachRequest): CoachContext {
  return { overallScore: request.overallScore, category: request.category, metrics: request.metrics };
}

export async function listConversations(supabase: SupabaseClient, limit = 50): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, title, created_at, updated_at, analysis_id, messages")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    analysis_id: (row.analysis_id as string | null) ?? null,
    messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
  }));
}

export async function getConversation(supabase: SupabaseClient, id: string): Promise<Conversation> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as Conversation;
}

export async function createConversation(
  supabase: SupabaseClient,
  conversation: { title: string; context: CoachContext; advice: CoachAdvice | null; analysisId: string | null }
): Promise<Conversation> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      title: conversation.title,
      context: conversation.context,
      advice: conversation.advice,
      analysis_id: conversation.analysisId,
      messages: [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Conversation;
}

export async function saveConversationMessages(supabase: SupabaseClient, id: string, messages: ChatMessage[]): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ messages, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteConversation(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
