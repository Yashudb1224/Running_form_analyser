import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  COACH_CHAT_SYSTEM_PROMPT,
  COACH_RESPONSE_SCHEMA,
  COACH_SYSTEM_PROMPT,
  CoachChatRequest,
  CoachRequest,
  buildCoachChatContext,
  buildCoachPrompt,
  parseCoachAdvice,
  validateCoachChatRequest,
  validateCoachRequest,
} from "@/lib/coach";

export const runtime = "nodejs";

// Alias for the current Flash-Lite model: answers in seconds (full Flash took over a minute on the
// free tier) and keeps working when Google retires older model versions.
const DEFAULT_MODEL = "gemini-flash-lite-latest";
const REQUEST_TIMEOUT_MS = 45_000;
/** Minimum wait per user between requests, protecting the free quota. */
const MIN_INTERVAL_MS = { summary: 15_000, chat: 3_000 } as const;
const lastRequest = new Map<string, number>();

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

class CoachError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  contents: GeminiContent[],
  generationConfig: Record<string, unknown>
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig }),
    });
  } catch (fetchError) {
    const timedOut = fetchError instanceof Error && fetchError.name === "TimeoutError";
    throw new CoachError(timedOut ? "Gemini took too long to answer. Please try again." : "Could not reach Google Gemini. Check your internet connection.", 504);
  }
  if (!response.ok) {
    if (response.status === 429) throw new CoachError("The free Gemini quota is used up for now. Try again in a minute.", 429);
    const detail = await response.text().catch(() => "");
    if (/API key|API_KEY|permission/i.test(detail)) throw new CoachError("Gemini rejected the API key. Check GEMINI_API_KEY in .env.local.", 502);
    if (response.status === 404) throw new CoachError("The Gemini model is unavailable. Set GEMINI_MODEL in .env.local to a current model.", 502);
    throw new CoachError(`Gemini returned an error (${response.status}). Try again shortly.`, 502);
  }
  const data = (await response.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

/**
 * AI coaching with Google Gemini. Without `messages` it returns the structured coaching summary;
 * with `messages` it answers the runner's latest follow-up question. The API key stays on the
 * server; the browser sends only measurements and annotated evidence frames, never the video.
 */
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return error("AI coaching is not set up: add GEMINI_API_KEY to .env.local and restart the server.", 503);

  // With Clerk configured, only signed-in users may use the coach (protects the free quota).
  let userKey = "local";
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    const { userId } = await auth();
    if (!userId) return error("Please sign in to use the AI coach.", 401);
    userKey = userId;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Request body must be JSON.", 400);
  }
  const isChat = Boolean(body && typeof body === "object" && "messages" in body);
  const invalid = isChat ? validateCoachChatRequest(body) : validateCoachRequest(body);
  if (invalid) return error(invalid, 400);

  const mode = isChat ? "chat" : "summary";
  const now = Date.now();
  const limitKey = `${userKey}:${mode}`;
  if (now - (lastRequest.get(limitKey) ?? 0) < MIN_INTERVAL_MS[mode]) {
    return error(`Please wait ${MIN_INTERVAL_MS[mode] / 1000} seconds between ${isChat ? "questions" : "coaching requests"}.`, 429);
  }
  lastRequest.set(limitKey, now);
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  try {
    if (!isChat) {
      const coachRequest = body as CoachRequest;
      const text = await callGemini(apiKey, model, COACH_SYSTEM_PROMPT, [{
        role: "user",
        parts: [
          { text: buildCoachPrompt(coachRequest) },
          ...coachRequest.images.map((image) => ({ inlineData: { mimeType: "image/jpeg", data: image.data } })),
        ],
      }], { temperature: 0.4, responseMimeType: "application/json", responseSchema: COACH_RESPONSE_SCHEMA });
      const advice = parseCoachAdvice(text);
      if (!advice) return error("Gemini's answer could not be read. Please try again.", 502);
      return NextResponse.json({ advice, model });
    }

    // Follow-up: the analysis context comes first (frames omitted to keep answers fast), then the
    // conversation, with the coach's earlier replies as model turns.
    const chat = body as CoachChatRequest;
    const contents: GeminiContent[] = [
      { role: "user", parts: [{ text: `Here is my running analysis.\n${buildCoachChatContext(chat)}` }] },
      { role: "model", parts: [{ text: "Thanks, I have your measurements and coaching. What would you like to know?" }] },
      ...chat.messages.map((message): GeminiContent => ({
        role: message.role === "user" ? "user" : "model",
        parts: [{ text: message.text }],
      })),
    ];
    const reply = await callGemini(apiKey, model, COACH_CHAT_SYSTEM_PROMPT, contents, { temperature: 0.6, maxOutputTokens: 600 });
    if (!reply) return error("Gemini did not return an answer. Please try again.", 502);
    return NextResponse.json({ reply, model });
  } catch (coachError) {
    if (coachError instanceof CoachError) return error(coachError.message, coachError.status);
    return error("The AI coach is unavailable right now.", 500);
  }
}
