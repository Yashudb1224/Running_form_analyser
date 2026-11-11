import { CompleteAnalysisReport } from "../types/telemetry";
import { getMetricComparisons } from "./metricComparison";

/** Limits that keep a coaching request small and inside the free Gemini quota. */
export const COACH_LIMITS = {
  maxImages: 5,
  maxImageBase64Chars: 600_000,
  maxMetrics: 12,
} as const;

export interface CoachMetric {
  label: string;
  value: string;
  typical: string;
  status: string;
}

export interface CoachImage {
  title: string;
  /** Base64 JPEG without the data-URL prefix. */
  data: string;
}

export interface CoachRequest {
  overallScore: number | null;
  category: string;
  metrics: CoachMetric[];
  images: CoachImage[];
}

export interface CoachAdvice {
  headline: string;
  strengths: string[];
  priorities: { title: string; why: string; cue: string }[];
  drills: { name: string; how: string }[];
  note: string;
}

/**
 * Builds the coaching request from a finished report: the measured metrics and the annotated
 * evidence frames only. The video itself is never included.
 */
export function buildCoachRequest(report: CompleteAnalysisReport): CoachRequest {
  const metrics = getMetricComparisons(report)
    .filter((comparison) => comparison.observed.value !== null)
    .slice(0, COACH_LIMITS.maxMetrics)
    .map((comparison) => ({
      label: comparison.label,
      value: `${Number(comparison.observed.value).toFixed(1)} ${comparison.observed.unit}`,
      typical: comparison.referenceText,
      status: comparison.positionText,
    }));
  const images = report.evidence.slice(0, COACH_LIMITS.maxImages).map((frame) => ({
    title: `${frame.title}: ${frame.value.toFixed(1)}°`,
    data: frame.imageDataUrl.replace(/^data:image\/jpeg;base64,/, ""),
  }));
  return {
    overallScore: report.formScore.overallScore.value,
    category: report.formScore.category,
    metrics,
    images,
  };
}

/** Validates an incoming request body on the server; returns an error message or null. */
export function validateCoachRequest(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Request body must be a JSON object.";
  const request = body as Partial<CoachRequest>;
  if (!Array.isArray(request.metrics) || request.metrics.length === 0) return "No metrics were provided.";
  if (request.metrics.length > COACH_LIMITS.maxMetrics) return "Too many metrics.";
  if (!request.metrics.every((metric) => metric && typeof metric.label === "string" && typeof metric.value === "string")) {
    return "Metrics are malformed.";
  }
  if (!Array.isArray(request.images) || request.images.length > COACH_LIMITS.maxImages) return "Too many images.";
  for (const image of request.images) {
    if (!image || typeof image.data !== "string" || typeof image.title !== "string") return "Images are malformed.";
    if (image.data.length > COACH_LIMITS.maxImageBase64Chars) return "An image is too large.";
    if (!/^[A-Za-z0-9+/=]+$/.test(image.data)) return "Images must be base64 JPEG data.";
  }
  return null;
}

export const COACH_SYSTEM_PROMPT = `You are an experienced, encouraging running coach reviewing a recreational runner's form.
You receive measurements from a video gait analysis and annotated frames from the runner's video (shin angle at foot strike, knee bend at midstance, trunk lean).
Rules:
- Treat the provided measurements as correct. Do not invent new numbers or contradict them.
- Base priorities on measurements outside their typical range; ignore metrics marked "Observed only" unless clearly relevant.
- Use plain, friendly language a non-expert understands. Keep every item short (one or two sentences).
- Give practical cues a runner can think about while running, and simple drills.
- Never diagnose injuries or give medical advice; suggest seeing a professional if pain is mentioned or asymmetry is large.`;

/** JSON schema for Gemini structured output, matching CoachAdvice. */
export const COACH_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "One-sentence overall verdict." },
    strengths: { type: "ARRAY", items: { type: "STRING" }, description: "One or two things the runner does well." },
    priorities: {
      type: "ARRAY",
      description: "Up to three things to work on, most important first.",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          why: { type: "STRING", description: "Why it matters, referring to the measurement." },
          cue: { type: "STRING", description: "A short cue to think about while running." },
        },
        required: ["title", "why", "cue"],
      },
    },
    drills: {
      type: "ARRAY",
      description: "Two or three simple drills.",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, how: { type: "STRING" } },
        required: ["name", "how"],
      },
    },
    note: { type: "STRING", description: "A short closing note, e.g. to change one thing at a time." },
  },
  required: ["headline", "strengths", "priorities", "drills", "note"],
} as const;

export function buildCoachPrompt(request: CoachRequest): string {
  const lines = request.metrics.map((metric) => `- ${metric.label}: ${metric.value} (typical ${metric.typical}; ${metric.status})`);
  return [
    `Overall form score: ${request.overallScore ?? "unavailable"} / 100 (${request.category}).`,
    "Measurements:",
    ...lines,
    request.images.length ? `Annotated frames attached: ${request.images.map((image) => image.title).join("; ")}.` : "No frames attached.",
    "Write the coaching feedback.",
  ].join("\n");
}

/** Checks that Gemini's JSON matches the expected shape before it is shown. */
export function parseCoachAdvice(text: string): CoachAdvice | null {
  try {
    const value = JSON.parse(text) as Partial<CoachAdvice>;
    if (
      typeof value.headline !== "string" ||
      !Array.isArray(value.strengths) ||
      !Array.isArray(value.priorities) ||
      !Array.isArray(value.drills) ||
      typeof value.note !== "string"
    ) {
      return null;
    }
    return {
      headline: value.headline,
      strengths: value.strengths.filter((item): item is string => typeof item === "string").slice(0, 3),
      priorities: value.priorities
        .filter((item) => item && typeof item.title === "string" && typeof item.why === "string" && typeof item.cue === "string")
        .slice(0, 3),
      drills: value.drills.filter((item) => item && typeof item.name === "string" && typeof item.how === "string").slice(0, 3),
      note: value.note,
    };
  } catch {
    return null;
  }
}

export interface ChatMessage {
  role: "user" | "coach";
  text: string;
}

/** A follow-up question: the analysis context, the coaching already given, and the conversation so far. */
export interface CoachChatRequest extends CoachRequest {
  advice: CoachAdvice | null;
  messages: ChatMessage[];
}

export const CHAT_LIMITS = {
  maxMessages: 20,
  maxMessageChars: 1000,
} as const;

export const COACH_CHAT_SYSTEM_PROMPT = `You are the same friendly running coach, now answering the runner's follow-up questions.
Rules:
- Ground every answer in this runner's measurements and the coaching already given; refer to their numbers when relevant.
- Treat the measurements as correct and never invent new ones.
- Answer in plain language in at most about 120 words. Use short paragraphs or a short list when it helps.
- Stay on running, running form, training, drills, warm-ups and general fitness. Politely decline unrelated requests.
- Never diagnose injuries or prescribe treatment. If the runner mentions pain or injury, give general guidance and recommend seeing a physiotherapist or doctor.`;

export function validateCoachChatRequest(body: unknown): string | null {
  const base = validateCoachRequest(body);
  if (base) return base;
  const request = body as Partial<CoachChatRequest>;
  if (!Array.isArray(request.messages) || request.messages.length === 0) return "No question was provided.";
  if (request.messages.length > CHAT_LIMITS.maxMessages) return "This conversation is too long; start a new one.";
  for (const message of request.messages) {
    if (!message || (message.role !== "user" && message.role !== "coach") || typeof message.text !== "string") return "Messages are malformed.";
    if (!message.text.trim() || message.text.length > CHAT_LIMITS.maxMessageChars) return `Messages must be 1-${CHAT_LIMITS.maxMessageChars} characters.`;
  }
  if (request.messages[request.messages.length - 1].role !== "user") return "The last message must be a question.";
  return null;
}

/** Context sent before the conversation: the measurements plus the coaching summary already shown. */
export function buildCoachChatContext(request: CoachChatRequest): string {
  const advice = request.advice;
  const coaching = advice
    ? [
      `Coaching already given: ${advice.headline}`,
      ...advice.priorities.map((priority, index) => `Priority ${index + 1}: ${priority.title} (${priority.why}) Cue: ${priority.cue}`),
      ...advice.drills.map((drill) => `Drill: ${drill.name}: ${drill.how}`),
    ].join("\n")
    : "No coaching summary has been given yet.";
  return `${buildCoachPrompt(request).replace("Write the coaching feedback.", "")}\n${coaching}`;
}

export const SUGGESTED_QUESTIONS = [
  "How do I fix my biggest issue?",
  "What cadence should I aim for?",
  "Give me a 2-week plan to improve my form",
  "Which warm-up drills suit me?",
];
