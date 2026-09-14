import type { DailyQuestionRow, Difficulty, ReactionRow } from "@/lib/db/types";
import type { Locale } from "@/i18n/config";
import {
  REACTION_EMOJIS,
  type CalendarMonth,
  type DailyQuestion,
  type DayAnswerView,
  type DayStatus,
  type ReactionView,
} from "./types";
import {
  formatUtcMonth,
  monthKey,
  resolveQuestionKind,
  utcMonthGrid,
} from "./utc-day";

/**
 * Row → view mapping. Pure, so the shapes the pages render are testable without
 * a database.
 */

/** `null` until the question is published — a `pending` row has no text. */
export function toDailyQuestion(
  row: DailyQuestionRow | null,
  locale: Locale,
): DailyQuestion | null {
  if (!row || row.status !== "ready" || !row.prompt_en || !row.prompt_id) {
    return null;
  }

  return {
    date: row.date,
    kind: row.kind,
    prompt: locale === "id" ? row.prompt_id : row.prompt_en,
    answer: locale === "id" ? row.answer_id : row.answer_en,
    category: row.category,
    difficulty: (row.difficulty as Difficulty | null) ?? null,
    source: row.source === "fallback" ? "fallback" : "omniroute",
  };
}

/**
 * Collapses raw reaction rows into one entry per emoji, in a fixed order so the
 * row does not reshuffle as counts change.
 */
export function toReactionViews(
  rows: ReactionRow[],
  myMemberId: string,
): ReactionView[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();

  for (const row of rows) {
    const entry = byEmoji.get(row.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (row.member_id === myMemberId) entry.mine = true;
    byEmoji.set(row.emoji, entry);
  }

  const known = REACTION_EMOJIS.filter((emoji) => byEmoji.has(emoji)).map(
    (emoji) => ({ emoji, ...byEmoji.get(emoji)! }),
  );

  // Anything outside the picker can only come from an older release; keep it
  // visible rather than silently dropping someone's reaction.
  const extra = Array.from(byEmoji.entries())
    .filter(
      ([emoji]) => !(REACTION_EMOJIS as readonly string[]).includes(emoji),
    )
    .map(([emoji, entry]) => ({ emoji, ...entry }));

  return [...known, ...extra];
}

export function dayStatus(options: {
  date: string;
  today: string;
  answeredBy: Set<string>;
  memberCount: number;
  myMemberId: string;
}): DayStatus {
  const { date, today, answeredBy, memberCount, myMemberId } = options;

  if (date > today) return "future";
  if (answeredBy.size === 0) return "none";
  if (memberCount > 0 && answeredBy.size >= memberCount) return "complete";

  return answeredBy.has(myMemberId) ? "partial" : "locked";
}

/**
 * A month of calendar cells with per-day state, so the archive reads as a record
 * of the ritual rather than a list of links.
 */
export function buildCalendarMonth(options: {
  month: string;
  locale: Locale;
  today: string;
  memberCount: number;
  myMemberId: string;
  answeredByDate: Map<string, Set<string>>;
  hrefs: Map<string, string>;
}): CalendarMonth {
  const {
    month,
    locale,
    today,
    memberCount,
    myMemberId,
    answeredByDate,
    hrefs,
  } = options;

  const cells = utcMonthGrid(month).map((date) => {
    const answeredBy = answeredByDate.get(date) ?? new Set<string>();

    return {
      date,
      inMonth: monthKey(date) === month,
      isToday: date === today,
      status: dayStatus({ date, today, answeredBy, memberCount, myMemberId }),
      href: hrefs.get(date) ?? null,
    };
  });

  return { month, label: formatUtcMonth(month, locale), cells };
}

/**
 * Orders the room so "you" always come first, then by join order. The reader's
 * own answer should never move around as other people join.
 */
export function orderEntries(
  entries: DayAnswerView[],
  myMemberId: string,
): DayAnswerView[] {
  return [...entries].sort((left, right) => {
    if (left.memberId === myMemberId) return -1;
    if (right.memberId === myMemberId) return 1;
    return 0;
  });
}

/**
 * The public archive shows one question per date: whichever kind the weekly
 * rhythm selects. A room set to knowledge-only or open-ended-only sees its own
 * variant, but the public record stays a single steady line.
 */
export function pickPublicQuestion(
  rows: DailyQuestionRow[],
  date: string,
): DailyQuestionRow | null {
  const forDate = rows.filter((row) => row.date === date);
  if (forDate.length === 0) return null;

  const preferred = resolveQuestionKind("mixed", date);
  return forDate.find((row) => row.kind === preferred) ?? forDate[0];
}

/** Newest first, one entry per date, ready to render. */
export function publicArchive(
  rows: DailyQuestionRow[],
  locale: Locale,
): DailyQuestion[] {
  const dates = Array.from(new Set(rows.map((row) => row.date))).sort((a, b) =>
    b.localeCompare(a),
  );

  return dates
    .map((date) => toDailyQuestion(pickPublicQuestion(rows, date), locale))
    .filter((question): question is DailyQuestion => question !== null);
}
