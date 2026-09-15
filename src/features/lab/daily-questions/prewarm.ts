import "server-only";
import { after } from "next/server";
import { getOmniRouteConfig } from "./env";
import { readDailyQuestion, resolveDailyQuestion } from "./questions";
import type { QuestionKind } from "./types";
import { addUtcDays, utcToday } from "./utc-day";

/**
 * Builds tomorrow's questions in the background, so the first visitor of the next UTC
 * day does not pay for generation.
 *
 * Measured cost of not doing this: whoever opens the page first each day waits ~20s.
 * The work is scheduled with `after()`, so the response is already sent — the page
 * never blocks on it.
 *
 * Both kinds, because which one a room needs depends on its mode: a `knowledge` room
 * only ever reads the knowledge question, a `reflective` room only the reflective one,
 * and a `mixed` room reads whichever the weekly rhythm selects. Building only the
 * current room's kind would leave the others waiting.
 *
 * Safety comes from code that already exists rather than anything new here: concurrent
 * attempts are harmless because the claim step is `INSERT ... ON CONFLICT DO NOTHING`
 * and publishing is a conditional `UPDATE ... WHERE status = 'pending'`, so exactly one
 * caller can publish a given question.
 *
 * Best-effort by design. If the function is cut off mid-generation the row stays
 * `pending` and the ordinary lazy path on the next request reclaims and completes it —
 * so a failed pre-warm costs nothing but the wait it was trying to avoid.
 */
export function scheduleNextDayPrewarm(): void {
  // Without a gateway key this would publish the standby question a day early and
  // *lock it in*: the row is written once and never revisited, so tomorrow would serve
  // a hand-written question even if the key arrived in the meantime. Better to leave
  // the day empty and let the first real request decide.
  if (!getOmniRouteConfig().configured) return;

  const tomorrow = addUtcDays(utcToday(), 1);

  after(async () => {
    const kinds: QuestionKind[] = ["knowledge", "reflective"];

    await Promise.all(
      kinds.map(async (kind) => {
        try {
          if (await readDailyQuestion(kind, tomorrow)) return;
          // `allowFallback: false`: a failed pre-warm must leave the day ungenerated
          // rather than lock in a standby question before the day has started.
          await resolveDailyQuestion(kind, tomorrow, { allowFallback: false });
        } catch {
          // never log or rethrow into the request: this is a pre-warm, and the lazy
          // path will pick the day up when someone actually needs it. Note for the
          // notification work (item 2.3): the push must be gated on
          // `date === utcToday()`, or this call would announce tomorrow's question today.
        }
      }),
    );
  });
}
