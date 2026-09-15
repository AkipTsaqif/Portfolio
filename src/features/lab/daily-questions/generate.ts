import "server-only";
import {
  ANTI_REPEAT_WINDOW,
  GENERATION_ATTEMPTS,
  GENERATION_DEADLINE_MS,
  GENERATION_TIMEOUT_MS,
  getOmniRouteConfig,
} from "./env";
import { generatedQuestionSchemaFor } from "./schema";
import type { GeneratedQuestion, QuestionKind } from "./types";

/**
 * One question per `(UTC date, kind)`, asked of the OmniRoute gateway.
 *
 * Deliberately conservative about the wire format: OmniRoute fronts a few
 * hundred upstream providers, so anything model-specific is a liability.
 * No `response_format`, no `temperature`, no `max_tokens` — the prompt asks for
 * JSON, a tolerant parser reads it, and zod decides whether it is usable. If it
 * is not, the next attempt simply asks for a different question.
 */

export type GenerationResult =
  | { ok: true; question: GeneratedQuestion; model: string }
  | { ok: false; reason: string };

const SYSTEM_PROMPT = `You write the single daily question for a small private journaling app shared by couples and friends.

Return ONLY a JSON object. No markdown, no code fences, no commentary before or after.

{
  "prompt":     { "en": string, "id": string },
  "category":   string | null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "answer":     { "en": string, "id": string } | null
}

Rules that apply to every question:
- English and Indonesian must ask exactly the same thing.
- The Indonesian must read as a native speaker wrote it. Never a literal translation.
- Never repeat or paraphrase any of the recent questions listed at the end.
- Never reply with prose, an apology, a refusal, or an explanation of your reasoning. Reply with the JSON object only.

Rules for kind = "knowledge":
- Every subject is open. Biology, chemistry, physics, astrophysics, earth science, mathematics, technology, engineering, medicine, history, geography, economics, law, linguistics, literature, art, music, film, sport, food, philosophy, and anything else that yields a real question.
- Politics, religion, current events and contested subjects are allowed too, on one condition: the question must have a settled, checkable, factual answer, and you must state it neutrally without taking a side or asking the reader to judge.
- "category": one short label, for example "Astrophysics" or "Medieval history".
- "difficulty": honest. "easy" is something most adults know. "medium" needs a moment's thought. "hard" needs real domain knowledge.
- "answer": 2 to 4 sentences. Give the answer first, then the explanation. No hedging, no "I think", no invented citations, no fake precision.
- Do not ask about a record that changes, and do not ask anything whose answer is only true in one particular year.

Rules for kind = "reflective":
- Open, specific and warm. Answerable in a few sentences.
- No yes/no questions. No right answer. Nothing to look up.
- Ask about the reader's own life: a memory, a preference, a habit, a small decision, a point of view.
- No advice, no therapy-speak, no diagnosing, no "how do you feel about your childhood".
- "category", "difficulty" and "answer" must all be null.`;

function buildUserPrompt(
  kind: QuestionKind,
  date: string,
  recentPrompts: string[],
  avoidTopics: string[],
): string {
  const lines = [
    `kind: ${kind}`,
    `date: ${date}`,
    "",
    kind === "knowledge"
      ? "Write a knowledge question with a verified answer and a short explanation."
      : "Write an open-ended reflective question. No answer key.",
  ];

  if (recentPrompts.length > 0) {
    lines.push(
      "",
      "Recent questions. Do not repeat, rephrase or stay on the same fact:",
      ...recentPrompts.map((prompt) => `- ${prompt}`),
    );
  }

  // Kept separate from the recent list on purpose. "Recent" is a rolling window, so a
  // question a reader rejected would otherwise become fair game again once it aged out.
  // These are excluded permanently.
  if (avoidTopics.length > 0) {
    lines.push(
      "",
      "A reader marked these as wrong or unusable. Avoid their subject matter entirely:",
      ...avoidTopics.map((prompt) => `- ${prompt}`),
    );
  }

  return lines.join("\n");
}

/**
 * Pulls the assistant text out of an OpenAI-shaped response. Handles both a
 * plain string and the content-parts array some providers return.
 */
function extractAssistantText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return "";

  const content = (message as { content?: unknown }).content;

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("");
  }

  return "";
}

/**
 * Reads JSON out of a completion that may be wrapped in prose or code fences.
 * `JSON.parse` only — never `eval`.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const unfenced = trimmed
    .replace(/^\s*```(?:json|JSON)?\s*/, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const candidates = [unfenced];

  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidates.push(unfenced.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }

  return null;
}

export async function generateQuestion(options: {
  kind: QuestionKind;
  date: string;
  recentPrompts: string[];
  /** Questions a reader rejected. Excluded permanently, not just from the recent window. */
  avoidTopics?: string[];
}): Promise<GenerationResult> {
  const { kind, date, recentPrompts, avoidTopics = [] } = options;
  const config = getOmniRouteConfig();

  if (!config.configured) {
    return { ok: false, reason: "OMNIROUTE_API_KEY is not set" };
  }

  const body = JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt(
          kind,
          date,
          recentPrompts.slice(0, ANTI_REPEAT_WINDOW),
          avoidTopics.slice(0, ANTI_REPEAT_WINDOW),
        ),
      },
    ],
    stream: false,
  });

  let lastReason = "no attempt was made";
  const startedAt = performance.now();

  for (let attempt = 1; attempt <= GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        lastReason = `gateway returned ${response.status}`;
        continue;
      }

      const text = extractAssistantText(await response.json());
      const parsed = generatedQuestionSchemaFor(kind).safeParse(
        extractJsonObject(text),
      );

      if (parsed.success) {
        return {
          ok: true,
          model: config.model,
          question: {
            prompt: parsed.data.prompt,
            category: kind === "knowledge" ? parsed.data.category : null,
            difficulty: kind === "knowledge" ? parsed.data.difficulty : null,
            answer: kind === "knowledge" ? parsed.data.answer : null,
          },
        };
      }

      // A refusal arrives here too: it fails to parse as the required object,
      // so we just ask again for a different question.
      lastReason = parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ");
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";

      lastReason = timedOut
        ? `gateway timed out after ${GENERATION_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : "unknown error";

      // A slow gateway is not a fast failure to retry around: another attempt
      // would just make the first visitor of the day wait twice as long for the
      // standby question. Stop and let the caller fall back now.
      if (timedOut) break;
    }

    // Even across retryable failures, never exceed the overall budget.
    if (performance.now() - startedAt > GENERATION_DEADLINE_MS) {
      lastReason = `${lastReason}; gave up after ${GENERATION_DEADLINE_MS}ms`;
      break;
    }
  }

  return { ok: false, reason: lastReason };
}
