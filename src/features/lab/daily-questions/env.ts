import { getDatabaseUrl } from "@/lib/db/env";

/**
 * Gateway and tuning configuration, co-located with the feature the way
 * `src/sanity/env.ts` is co-located with Sanity's.
 *
 * OmniRoute is an OpenAI-compatible gateway:
 *   POST {baseUrl}/v1/chat/completions
 *   Authorization: Bearer {apiKey}
 */

export const DEFAULT_OMNIROUTE_BASE_URL =
  "https://omniroute.vps.relpenasal.org";

/**
 * Measured against the live gateway with this feature's exact request body:
 *
 *   auto                                     54.3s
 *   auto/cheap                               34.4s
 *   auto/fast                                14.0s
 *   auto/smart                               16.5s
 *   antigravity/gemini-3.7-flash-high         6.4s
 *
 * `auto` is the *slowest* of them, which makes it a bad default for a request a
 * person is waiting on. `auto/smart` is the quality-oriented combo and costs
 * about two seconds more than `auto/fast`; this runs once per day and the result
 * is read by everyone, so quality wins the tie.
 */
export const DEFAULT_OMNIROUTE_MODEL = "auto/smart";

/**
 * Per-attempt ceiling. Generous enough for the slow combos above, because a
 * timeout here is not a retryable condition — see `GENERATION_DEADLINE_MS`.
 */
export const GENERATION_TIMEOUT_MS = 30_000;

/**
 * Overall wall-clock budget across every attempt.
 *
 * Retries exist for a *fast* failure: a refusal, a 5xx, or JSON that fails
 * validation all come back in seconds, and asking again for a different question
 * is cheap. A **timeout** is the opposite case — the gateway is simply slow, and
 * retrying only doubles how long the first visitor of the day stares at a
 * spinner before getting the standby question anyway. So a timeout ends the
 * loop, and this deadline bounds everything else.
 */
export const GENERATION_DEADLINE_MS = 45_000;

/** How many generated questions we hand the model to steer it away from repeats. */
export const ANTI_REPEAT_WINDOW = 30;

/**
 * Generation attempts per question. Covers a refusal or a payload that fails
 * validation — every attempt simply asks for a different question.
 */
export const GENERATION_ATTEMPTS = 3;

/** A `pending` row older than this is assumed abandoned and may be reclaimed. */
export const PENDING_STALE_MS = 90_000;

/** How long a request that lost the generation race waits for the winner. */
export const PENDING_POLL_INTERVAL_MS = 500;
export const PENDING_POLL_ATTEMPTS = 20;

export type OmniRouteConfig = {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  configured: boolean;
};

export function getOmniRouteConfig(): OmniRouteConfig {
  const baseUrl = (
    process.env.OMNIROUTE_BASE_URL?.trim() || DEFAULT_OMNIROUTE_BASE_URL
  ).replace(/\/+$/, "");
  const apiKey = process.env.OMNIROUTE_API_KEY?.trim() || null;
  const model = process.env.OMNIROUTE_MODEL?.trim() || DEFAULT_OMNIROUTE_MODEL;

  return { baseUrl, apiKey, model, configured: apiKey !== null };
}

/** Salt for hashed IPs. Falls back to a fixed string so rate limiting still works. */
export function getRateLimitSalt(): string {
  return process.env.RATE_LIMIT_SALT?.trim() || "daily-questions-dev-salt";
}

/** Room creation is capped per hashed address per day. */
export const ROOM_CREATE_LIMIT_PER_DAY = 3;
export const ROOM_CREATE_WINDOW_SECONDS = 86_400;

/** Join attempts are capped per hashed address per hour, to blunt code guessing. */
export const ROOM_JOIN_LIMIT_PER_HOUR = 20;
export const ROOM_JOIN_WINDOW_SECONDS = 3_600;

/**
 * The database is a hard requirement; the gateway is not.
 *
 * Without the database there is nowhere to keep a room or an answer, so the tool
 * is genuinely unavailable. Without OmniRoute the day still resolves — generation
 * falls back to the hand-checked bank — so rooms must keep working. Gating
 * creation on the gateway would turn a degraded tool into a broken one.
 */
export function hasDatabase(): boolean {
  return getDatabaseUrl() !== null;
}

export function hasGateway(): boolean {
  return getOmniRouteConfig().configured;
}

/** True only when the tool is at full strength. */
export function isDailyQuestionsConfigured(): boolean {
  return hasDatabase() && hasGateway();
}

/**
 * VAPID keys for web push.
 *
 * Generated once (`webpush.generateVAPIDKeys()`), then set as environment variables. The
 * public key is handed to the browser so it can subscribe; the private key signs the push
 * and never leaves the server. `subject` is a contact URI that push services are required
 * to have on file, per the VAPID spec.
 *
 * Returns null when any part is missing, which switches notifications off rather than
 * failing — the tool works fine without them, it just cannot nudge anyone.
 */
export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getVapid(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) return null;

  return { publicKey, privateKey, subject };
}
