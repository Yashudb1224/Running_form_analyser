import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, Dumbbell, History, Loader2, MessageCircle, MessageSquarePlus, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Send, Sparkles, Target, Trash2,
} from "lucide-react";
import { CompleteAnalysisReport } from "@/types/telemetry";
import { CHAT_LIMITS, ChatMessage, CoachAdvice, SUGGESTED_QUESTIONS, buildCoachRequest } from "@/lib/coach";
import {
  CoachContext, ConversationSummary, createConversation, deleteConversation, getConversation,
  listConversations, saveConversationMessages, toCoachContext,
} from "@/lib/coachConversations";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "./AuthProvider";

interface CoachState {
  conversationId: string | null;
  title: string;
  context: CoachContext;
  advice: CoachAdvice | null;
  messages: ChatMessage[];
  /** True when a saved conversation from another session is open instead of the current report. */
  fromHistory: boolean;
}

async function postCoach<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The AI coach is unavailable right now.");
  return data;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Renders the coach's plain-text replies: paragraphs, "- " list items and **bold** spans. */
function CoachText({ text }: { text: string }) {
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part
  );
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`} className="ml-4 list-disc space-y-1">{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) list.push(item[1]);
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function AdviceView({ advice }: { advice: CoachAdvice }) {
  return (
    <div className="rise-in space-y-5">
      <p className="text-base font-semibold leading-snug text-ink">{advice.headline}</p>
      {advice.strengths.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {advice.strengths.map((strength) => (
            <li key={strength} className="status-pill whitespace-normal bg-success/10 py-1 text-success">
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {strength}
            </li>
          ))}
        </ul>
      )}
      {advice.priorities.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-ink"><Target className="h-4 w-4 text-primary" aria-hidden="true" />What to work on</h4>
          <ol className="mt-3 grid gap-3 lg:grid-cols-3">
            {advice.priorities.map((priority, index) => (
              <li key={priority.title} className="panel p-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">{index + 1}</span>
                <p className="mt-2 text-sm font-semibold text-ink">{priority.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-body">{priority.why}</p>
                <p className="mt-3 flex gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs font-medium leading-relaxed text-ink">
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />“{priority.cue}”
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {advice.drills.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-ink"><Dumbbell className="h-4 w-4 text-primary" aria-hidden="true" />Drills to try</h4>
          <ul className="mt-3 grid gap-3 lg:grid-cols-3">
            {advice.drills.map((drill) => (
              <li key={drill.name} className="rounded-xl border border-border/70 bg-surface/70 p-4">
                <p className="text-sm font-semibold text-ink">{drill.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-body">{drill.how}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted">{advice.note} AI-generated suggestions; not medical advice.</p>
    </div>
  );
}

function HistoryPanel({
  conversations, loading, activeId, onOpen, onDelete, onNew,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (conversation: ConversationSummary) => void;
  onNew: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-border/70 bg-surface/80" aria-label="Coach chat history">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><History className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Chat history</span>
        <button type="button" onClick={onNew} className="quiet-button min-h-7 px-2 text-[11px]" title="New chat for this report">
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" /> New
        </button>
      </div>
      <div className="max-h-[28rem] flex-1 overflow-y-auto p-2">
        {loading && <p className="flex items-center gap-2 px-2 py-3 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Loading…</p>}
        {!loading && conversations.length === 0 && <p className="px-2 py-3 text-xs leading-relaxed text-muted">Your coaching chats will be saved here.</p>}
        <ul className="space-y-1">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="group relative">
              <button
                type="button"
                onClick={() => onOpen(conversation.id)}
                className={`w-full rounded-lg px-2.5 py-2 pr-8 text-left transition-colors ${
                  activeId === conversation.id ? "bg-brand-soft ring-1 ring-primary/30" : "hover:bg-subtle"
                }`}
              >
                <span className="block truncate text-xs font-semibold text-ink">{conversation.title}</span>
                <span className="mt-0.5 block text-[10px] text-muted">
                  {formatWhen(conversation.updated_at)} · {conversation.messageCount} message{conversation.messageCount === 1 ? "" : "s"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(conversation)}
                className="absolute right-1.5 top-2 rounded-md p-1 text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                aria-label={`Delete chat ${conversation.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function AICoach({ report, videoName, analysisId }: { report: CompleteAnalysisReport; videoName: string; analysisId: string | null }) {
  const auth = useAuth();
  const historyEnabled = Boolean(auth.user) && isSupabaseConfigured();
  const freshState = useCallback((): CoachState => ({
    conversationId: null,
    title: `${videoName} · ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
    context: toCoachContext(buildCoachRequest(report)),
    advice: null,
    messages: [],
    fromHistory: false,
  }), [report, videoName]);

  const [state, setState] = useState<CoachState>(freshState);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    const supabase = getSupabase();
    if (!historyEnabled || !supabase) return;
    setListLoading(true);
    try {
      setConversations(await listConversations(supabase));
    } catch (listError) {
      setError(listError instanceof Error ? `Chat history unavailable: ${listError.message}` : "Chat history unavailable.");
    } finally {
      setListLoading(false);
    }
  }, [historyEnabled]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.messages.length, chatLoading]);

  /** Saves the open conversation, creating its database row on first save. Failures are non-fatal. */
  const persist = async (next: CoachState): Promise<CoachState> => {
    const supabase = getSupabase();
    if (!historyEnabled || !supabase) return next;
    try {
      if (!next.conversationId) {
        const created = await createConversation(supabase, { title: next.title, context: next.context, advice: next.advice, analysisId });
        next = { ...next, conversationId: created.id };
      }
      if (next.messages.length) await saveConversationMessages(supabase, next.conversationId as string, next.messages);
      void refreshList();
    } catch (saveError) {
      setError(saveError instanceof Error ? `Not saved to history: ${saveError.message}` : "Not saved to history.");
    }
    return next;
  };

  const getCoaching = async () => {
    setSummaryLoading(true);
    setError(null);
    try {
      const { advice } = await postCoach<{ advice: CoachAdvice }>(buildCoachRequest(report));
      // New coaching always starts a new saved conversation for the current report.
      setState(await persist({ ...freshState(), advice }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The AI coach is unavailable right now.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const ask = async (question: string) => {
    const text = question.trim().slice(0, CHAT_LIMITS.maxMessageChars);
    if (!text || chatLoading) return;
    const asked: CoachState = { ...state, messages: [...state.messages, { role: "user", text }] };
    setState(asked);
    setDraft("");
    setChatLoading(true);
    setError(null);
    try {
      const { reply } = await postCoach<{ reply: string }>({
        ...asked.context,
        images: [],
        advice: asked.advice,
        messages: asked.messages.slice(-CHAT_LIMITS.maxMessages + 1),
      });
      const answered = { ...asked, messages: [...asked.messages, { role: "coach" as const, text: reply }] };
      setState(answered);
      setState(await persist(answered));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The AI coach is unavailable right now.");
      setState(state);
      setDraft(text);
    } finally {
      setChatLoading(false);
    }
  };

  const openConversation = async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setError(null);
    try {
      const conversation = await getConversation(supabase, id);
      setState({
        conversationId: conversation.id,
        title: conversation.title,
        context: conversation.context,
        advice: conversation.advice,
        messages: conversation.messages ?? [],
        fromHistory: conversation.analysis_id === null || conversation.analysis_id !== analysisId,
      });
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Could not open this chat.");
    }
  };

  const removeConversation = async (conversation: ConversationSummary) => {
    const supabase = getSupabase();
    if (!supabase || !window.confirm(`Delete the chat "${conversation.title}"? This cannot be undone.`)) return;
    try {
      await deleteConversation(supabase, conversation.id);
      if (state.conversationId === conversation.id) setState(freshState());
      void refreshList();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this chat.");
    }
  };

  const hasContent = Boolean(state.advice) || state.messages.length > 0;

  return (
    <section aria-labelledby="coach-heading" className="gradient-border shadow-raised">
      <div className="relative overflow-hidden rounded-[14px] bg-surface p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-brand-soft" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-md">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 id="coach-heading" className="text-lg font-bold tracking-tight text-ink">AI <span className="text-gradient">Coach</span></h3>
                <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted">
                  Coaching and answers from Google Gemini, based on your measurements and the annotated frames.
                  Only these are sent to Google, never your video.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {historyEnabled && (
                <button type="button" onClick={() => setPanelOpen((open) => !open)} className="control-button" aria-pressed={panelOpen}>
                  {panelOpen ? <PanelLeftClose className="h-4 w-4" aria-hidden="true" /> : <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />}
                  History
                </button>
              )}
              <button type="button" onClick={() => void getCoaching()} disabled={summaryLoading} className="primary-button">
                {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : state.advice && !state.fromHistory ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {summaryLoading ? "Coaching…" : state.advice && !state.fromHistory ? "New coaching" : "Get AI coaching"}
              </button>
            </div>
          </div>

          <div className={`mt-5 grid gap-4 ${historyEnabled && panelOpen ? "lg:grid-cols-[15rem_minmax(0,1fr)]" : ""}`}>
            {historyEnabled && panelOpen && (
              <HistoryPanel
                conversations={conversations}
                loading={listLoading}
                activeId={state.conversationId}
                onOpen={(id) => void openConversation(id)}
                onDelete={(conversation) => void removeConversation(conversation)}
                onNew={() => { setState(freshState()); setError(null); }}
              />
            )}

            <div className="min-w-0 space-y-5">
              {state.fromHistory && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-surface/80 px-3 py-2 text-xs text-body">
                  <span>Viewing saved chat <strong className="font-semibold text-ink">{state.title}</strong>. Answers use that session&apos;s measurements.</span>
                  <button type="button" onClick={() => setState(freshState())} className="quiet-button min-h-7 px-2 text-[11px]">Back to this report</button>
                </div>
              )}

              {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-ink">{error}</p>}

              {summaryLoading && !state.advice && (
                <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="space-y-2 rounded-xl bg-surface/70 p-4">
                      <div className="skeleton h-3 w-1/2" />
                      <div className="skeleton h-2 w-full" />
                      <div className="skeleton h-2 w-4/5" />
                    </div>
                  ))}
                </div>
              )}

              {state.advice && <AdviceView advice={state.advice} />}

              <div className="rounded-xl border border-border/70 bg-surface/80">
                <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
                  <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-ink">Ask your coach</h4>
                  {historyEnabled && state.conversationId && <span className="ml-auto text-[10px] text-muted">Saved to history</span>}
                </div>
                <div className="max-h-[26rem] space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                  {state.messages.length === 0 && (
                    <p className="text-xs text-muted">
                      {hasContent ? "Ask anything about your form, drills or training." : "Ask a question, or get your coaching summary first."}
                    </p>
                  )}
                  {state.messages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        message.role === "user" ? "bg-button-gradient text-white" : "border border-border/70 bg-surface text-body"
                      }`}>
                        {message.role === "user" ? message.text : <CoachText text={message.text} />}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-surface px-3.5 py-2.5 text-xs text-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Coach is typing…
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                {state.messages.length === 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pb-3">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button key={question} type="button" onClick={() => void ask(question)} disabled={chatLoading} className="control-button min-h-7 rounded-full px-3 text-[11px]">
                        {question}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  className="flex items-end gap-2 border-t border-border/70 p-3"
                  onSubmit={(event) => { event.preventDefault(); void ask(draft); }}
                >
                  <label htmlFor="coach-question" className="sr-only">Ask your coach a question</label>
                  <textarea
                    id="coach-question"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, CHAT_LIMITS.maxMessageChars))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void ask(draft);
                      }
                    }}
                    rows={1}
                    placeholder="e.g. How can I stop overstriding?"
                    className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary/50 focus:outline-none"
                  />
                  <button type="submit" disabled={chatLoading || !draft.trim()} className="primary-button min-h-10 px-3" aria-label="Send question">
                    {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
