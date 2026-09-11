import "server-only";
import { db, firstRow, rows } from "@/lib/db/client";
import type { DailyQuestionRow, QuestionKind } from "@/lib/db/types";
import {
  ANTI_REPEAT_WINDOW,
  PENDING_POLL_ATTEMPTS,
  PENDING_POLL_INTERVAL_MS,
  PENDING_STALE_MS,
} from "./env";
import { pickFallbackQuestion } from "./fallback-questions";
import { generateQuestion } from "./generate";
import type { GeneratedQuestion } from "./types";

/**
 * How a `(date, kind)` question comes into existence.
 *
 * There is no scheduler. The first request of a UTC day generates the question;
 * everything else waits for it. Two facts make that safe without an advisory
 * lock (which the Neon HTTP driver cannot hold across statements):
 *
 *   1. Claiming is `INSERT ... ON CONFLICT DO NOTHING`, so exactly one caller
 *      ever gets a row back.
 *   2. Publishing is `UPDATE ... WHERE status = 'pending'`. Under READ COMMITTED
 *      a second concurrent UPDATE blocks on the row lock, then re-checks its
 *      WHERE clause after the first commits and matches nothing.
 *
 * So the first writer wins, at most one generation happens per question, and
 * every reader sees identical text. Worst case a request waits ~10s and gets
 * the hand-checked fallback question. A day never comes back empty.
 */

const PENDING_STALE_SECONDS = Math.ceil(PENDING_STALE_MS / 1000);

async function readReady(
  kind: QuestionKind,
  date: string,
): Promise<DailyQuestionRow | null> {
  const result = await db()`
    select * from daily_questions
     where date = ${date}
       and kind = ${kind}
       and status = 'ready'
       and deleted_at is null
     limit 1
  `;

  return firstRow<DailyQuestionRow>(result);
}

/**
 * Returns true when this caller owns generation for `(date, kind)` — either
 * because the row did not exist, or because a previous attempt died and left it
 * `pending` for longer than the staleness window.
 */
async function claim(kind: QuestionKind, date: string): Promise<boolean> {
  const inserted = await db()`
    insert into daily_questions (date, kind)
    values (${date}, ${kind})
    on conflict (date, kind) do nothing
    returning date
  `;

  if (firstRow<{ date: string }>(inserted) !== null) return true;

  const reclaimed = await db()`
    update daily_questions
       set pending_since = now()
     where date = ${date}
       and kind = ${kind}
       and status = 'pending'
       and pending_since < now() - make_interval(secs => ${PENDING_STALE_SECONDS}::double precision)
    returning date
  `;

  return firstRow<{ date: string }>(reclaimed) !== null;
}

/**
 * Writes a question into the claimed row. The `status = 'pending'` guard is what
 * makes the race safe: a loser's publish silently matches nothing.
 */
async function publish(
  kind: QuestionKind,
  date: string,
  question: GeneratedQuestion,
  source: "omniroute" | "fallback",
  model: string | null,
): Promise<DailyQuestionRow | null> {
  const answer = kind === "knowledge" ? question.answer : null;

  const result = await db()`
    update daily_questions
       set status = 'ready',
           prompt_en = ${question.prompt.en},
           prompt_id = ${question.prompt.id},
           answer_en = ${answer?.en ?? null},
           answer_id = ${answer?.id ?? null},
           category = ${kind === "knowledge" ? question.category : null},
           difficulty = ${kind === "knowledge" ? question.difficulty : null},
           source = ${source},
           model = ${model}
     where date = ${date}
       and kind = ${kind}
       and status = 'pending'
       and deleted_at is null
    returning *
  `;

  return firstRow<DailyQuestionRow>(result);
}

/** Recent prompts of the same kind, so the model stops circling one fact. */
async function recentPrompts(kind: QuestionKind, before: string) {
  const result = await db()`
    select prompt_en from daily_questions
     where kind = ${kind}
       and status = 'ready'
       and deleted_at is null
       and prompt_en is not null
       and date < ${before}
     order by date desc
     limit ${ANTI_REPEAT_WINDOW}
  `;

  return rows<{ prompt_en: string }>(result).map((row) => row.prompt_en);
}

async function generateAndPublish(
  kind: QuestionKind,
  date: string,
): Promise<DailyQuestionRow | null> {
  const result = await generateQuestion({
    kind,
    date,
    recentPrompts: await recentPrompts(kind, date),
  });

  if (result.ok) {
    // Never log the question text or an answer; only how it was produced.
    console.info(
      `[daily-questions] generated ${date}/${kind} via ${result.model}`,
    );
    return publish(kind, date, result.question, "omniroute", result.model);
  }

  console.warn(
    `[daily-questions] generation failed for ${date}/${kind} (${result.reason}); using the fallback bank`,
  );

  return publish(
    kind,
    date,
    pickFallbackQuestion(kind, date),
    "fallback",
    null,
  );
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForReady(
  kind: QuestionKind,
  date: string,
): Promise<DailyQuestionRow | null> {
  for (let attempt = 0; attempt < PENDING_POLL_ATTEMPTS; attempt += 1) {
    await sleep(PENDING_POLL_INTERVAL_MS);

    const ready = await readReady(kind, date);
    if (ready) return ready;
  }

  return null;
}

/**
 * The question for `(date, kind)`, generating it if this is the first request of
 * the day. Returns `null` only if the row disappeared underneath us, which the
 * caller renders as "unavailable" rather than crashing.
 */
export async function resolveDailyQuestion(
  kind: QuestionKind,
  date: string,
): Promise<DailyQuestionRow | null> {
  const existing = await readReady(kind, date);
  if (existing) return existing;

  if (await claim(kind, date)) {
    const published = await generateAndPublish(kind, date);
    if (published) return published;
    // Someone reclaimed the row while we were generating; fall through and read
    // whatever they publish.
  }

  const ready = await waitForReady(kind, date);
  if (ready) return ready;

  // Last resort. Publishing here (rather than returning a generated-but-unsaved
  // question) keeps every member of every room on one identical question.
  return publish(
    kind,
    date,
    pickFallbackQuestion(kind, date),
    "fallback",
    null,
  );
}

/** Read-only variant for public archive pages: never triggers generation. */
export async function readDailyQuestion(
  kind: QuestionKind,
  date: string,
): Promise<DailyQuestionRow | null> {
  return readReady(kind, date);
}

/** Every date that has a published question, newest first. */
export async function listPublishedDates(limit = 400): Promise<string[]> {
  const result = await db()`
    select distinct date::text as date from daily_questions
     where status = 'ready'
       and deleted_at is null
     order by date desc
     limit ${limit}
  `;

  return rows<{ date: string }>(result).map((row) => row.date);
}

/**
 * Recent published questions of both kinds, for the public archive.
 *
 * Both kinds come back because the archive shows whichever one the weekly rhythm
 * selects for a given date, and that is decided in code by
 * `resolveQuestionKind("mixed", date)` rather than in SQL.
 */
export async function listRecentQuestions(limit = 90) {
  const result = await db()`
    select * from daily_questions
     where status = 'ready'
       and deleted_at is null
       and date <= current_date
     order by date desc, kind
     limit ${limit}
  `;

  return rows<DailyQuestionRow>(result);
}
