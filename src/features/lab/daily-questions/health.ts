import "server-only";
import { db } from "@/lib/db/client";
import type { QuestionKind } from "@/lib/db/types";
import { getOmniRouteConfig } from "./env";
import { readDailyQuestion } from "./questions";
import { utcToday } from "./utc-day";

/**
 * Health for the Daily Questions tool, assembled for a public page.
 *
 * Two rules shape everything here:
 *
 *   1. **Never throw.** A status page that 500s when something is broken is worse
 *      than useless — it is most needed exactly when it is least able to render. Every
 *      probe is individually wrapped.
 *   2. **Never expose raw text.** The failure detail this page reports is a fixed
 *      vocabulary, not a captured error. The tool's whole failure mode is that it
 *      degrades *silently* into serving standby questions, and the reason a generation
 *      failed can contain a URL, an upstream status, or a fragment of a credential.
 *      `detail` is a union of literals precisely so nothing unchecked can reach the
 *      page: there is no code path that puts an error message into it.
 */

export type HealthState = "ok" | "degraded" | "down";

/** Fixed vocabulary. Adding a case here is the only way to say something new. */
export type HealthDetail =
  | "reachable"
  | "unreachable"
  | "timedOut"
  | "notConfigured"
  | "generated"
  | "notGenerated"
  | "standby";

export type HealthCheckId = "database" | "gateway" | "knowledge" | "reflective";

export type HealthCheck = {
  id: HealthCheckId;
  state: HealthState;
  detail: HealthDetail;
  /** Informational only — a measurement, not a message. */
  latencyMs?: number;
};

export type HealthReport = {
  state: HealthState;
  /** The UTC day being reported on. */
  date: string;
  checks: HealthCheck[];
};

const GATEWAY_PROBE_TIMEOUT_MS = 5_000;

/** Postgres: the one hard requirement. Without it there is no tool at all. */
async function checkDatabase(): Promise<HealthCheck> {
  const started = Date.now();

  try {
    await db()`select 1 as ok`;
    return {
      id: "database",
      state: "ok",
      detail: "reachable",
      latencyMs: Date.now() - started,
    };
  } catch {
    return { id: "database", state: "down", detail: "unreachable" };
  }
}

/**
 * A live probe rather than a stored one. There is no persisted "last error" column,
 * so this asks the gateway directly — which also distinguishes "the key is missing"
 * from "the key is set but the gateway is not answering", the two failures that
 * actually happen and look identical from the outside.
 */
async function checkGateway(): Promise<HealthCheck> {
  const config = getOmniRouteConfig();

  if (!config.configured) {
    return { id: "gateway", state: "degraded", detail: "notConfigured" };
  }

  const started = Date.now();

  try {
    const response = await fetch(`${config.baseUrl}/v1/models`, {
      headers: { authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(GATEWAY_PROBE_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      // the status code is deliberately not shown; only that it answered badly
      return { id: "gateway", state: "degraded", detail: "unreachable" };
    }

    return {
      id: "gateway",
      state: "ok",
      detail: "reachable",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      id: "gateway",
      state: "degraded",
      detail: timedOut ? "timedOut" : "unreachable",
    };
  }
}

/**
 * Whether the day's question exists, and whether it came from the model.
 *
 * `source = 'fallback'` is the interesting case: the tool is working, but the day's
 * question came from the hand-written bank, which is the silent degradation this page
 * exists to make visible.
 */
async function checkQuestion(kind: QuestionKind): Promise<HealthCheck> {
  try {
    const row = await readDailyQuestion(kind, utcToday());

    if (!row) {
      return { id: kind, state: "degraded", detail: "notGenerated" };
    }

    return row.source === "fallback"
      ? { id: kind, state: "degraded", detail: "standby" }
      : { id: kind, state: "ok", detail: "generated" };
  } catch {
    return { id: kind, state: "degraded", detail: "notGenerated" };
  }
}

/**
 * Worst state wins: any `down` makes the whole report `down`, otherwise any `degraded`
 * makes it `degraded`. A tool that is up but serving standby questions is not "ok".
 */
function worstState(checks: HealthCheck[]): HealthState {
  if (checks.some((check) => check.state === "down")) return "down";
  if (checks.some((check) => check.state === "degraded")) return "degraded";
  return "ok";
}

export async function getHealthReport(): Promise<HealthReport> {
  const [database, gateway, knowledge, reflective] = await Promise.all([
    checkDatabase(),
    checkGateway(),
    checkQuestion("knowledge"),
    checkQuestion("reflective"),
  ]);

  const checks = [database, gateway, knowledge, reflective];

  return { state: worstState(checks), date: utcToday(), checks };
}
