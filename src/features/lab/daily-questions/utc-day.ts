import type { QuestionKind, RoomMode } from "./types";
import type { Locale } from "@/i18n/config";

/**
 * Everything about "what day is it" lives here, and the answer is always UTC.
 *
 * There is one question per UTC calendar day shared by every room, so a new
 * question lands at 00:00 UTC — 07:00 in Jakarta. That also means no cron and no
 * per-room timezone column: the day rolls over when the date string changes.
 *
 * Pure. No `Date.now()` inside — callers pass `now` so this is deterministic.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** `2026-09-11` for the given instant, in UTC. */
export function utcDateString(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/** Today's question date. */
export function utcToday(now: Date = new Date()): string {
  return utcDateString(now);
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;

  // rejects 2026-02-31 and friends. `new Date` yields an Invalid Date for those,
  // and calling toISOString() on it would throw.
  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && utcDateString(parsed) === value;
}

/** UTC midnight for `date`. Throws on a malformed date, which is the point. */
export function parseUtcDate(date: string): Date {
  if (!isDateString(date)) {
    throw new Error(`Not a valid UTC date string: ${JSON.stringify(date)}`);
  }

  return new Date(`${date}T00:00:00.000Z`);
}

/** Whole days since the epoch. The stable integer identity of a date. */
export function dayIndex(date: string): number {
  return Math.floor(parseUtcDate(date).getTime() / MS_PER_DAY);
}

export function fromDayIndex(index: number): string {
  return utcDateString(new Date(index * MS_PER_DAY));
}

export function addUtcDays(date: string, delta: number): string {
  return fromDayIndex(dayIndex(date) + delta);
}

/** Saturday or Sunday. */
export function isUtcWeekend(date: string): boolean {
  const weekday = parseUtcDate(date).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/**
 * The whole reason the per-room mode toggle can coexist with one global
 * question per day: a question is keyed by `(date, kind)`, not by date alone.
 * Each UTC day therefore has up to two generated questions — one knowledge, one
 * reflective — and a room picks which one it sees.
 *
 * - `knowledge` rooms always take the knowledge question, whatever the weekday.
 * - `reflective` rooms always take the reflective question.
 * - `mixed` rooms follow the weekly rhythm: knowledge on weekdays, reflective
 *   at the weekend.
 *
 * Two rooms with the same mode see identical text on the same day.
 */
export function resolveQuestionKind(
  mode: RoomMode,
  date: string,
): QuestionKind {
  if (mode === "knowledge") return "knowledge";
  if (mode === "reflective") return "reflective";
  return isUtcWeekend(date) ? "reflective" : "knowledge";
}

/** `YYYY-MM` for a date. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addUtcMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (((total % 12) + 12) % 12) + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`;
}

/**
 * A calendar grid for `month`: whole weeks, Monday first, always 42 cells so
 * the layout never jumps between months.
 */
export function utcMonthGrid(month: string): string[] {
  const first = `${month}-01`;
  // getUTCDay(): 0 = Sunday. Shift so Monday is 0.
  const weekday = (parseUtcDate(first).getUTCDay() + 6) % 7;
  const start = addUtcDays(first, -weekday);

  return Array.from({ length: 42 }, (_, offset) => addUtcDays(start, offset));
}

/** `11 Sep 2026`, in the reader's locale, without pulling in a date library. */
export function formatUtcDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseUtcDate(date));
}

/** `September 2026`, for the calendar heading. */
export function formatUtcMonth(month: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseUtcDate(`${month}-01`));
}

/** Weekday initial for the calendar column headers, Monday first. */
export function utcWeekdayLabels(locale: Locale): string[] {
  const formatter = new Intl.DateTimeFormat(
    locale === "id" ? "id-ID" : "en-GB",
    {
      weekday: "narrow",
      timeZone: "UTC",
    },
  );

  // 2024-01-01 was a Monday
  return Array.from({ length: 7 }, (_, offset) => {
    const instant = new Date(Date.UTC(2024, 0, 1 + offset));
    return formatter.format(instant);
  });
}

/** How many milliseconds of the current UTC day have elapsed. */
export function utcMillisIntoDay(now: Date = new Date()): number {
  return (
    now.getUTCHours() * 3_600_000 +
    now.getUTCMinutes() * 60_000 +
    now.getUTCSeconds() * 1_000 +
    now.getUTCMilliseconds()
  );
}
