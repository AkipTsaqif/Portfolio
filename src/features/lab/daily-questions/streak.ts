import { dayIndex } from "./utc-day";

/**
 * Streaks are derived, never stored — there is no table to keep in sync and a
 * retracted answer simply reduces the streak.
 *
 * All pure. `today` is always passed in UTC.
 */

/**
 * Consecutive days ending at today, or at yesterday when today's answer is not
 * in yet — so a streak is still alive at 06:00 WIB before the new question has
 * been answered.
 */
export function computeStreak(dates: Iterable<string>, today: string): number {
  const answered = new Set(Array.from(dates, dayIndex));

  if (answered.size === 0) return 0;

  const todayIndex = dayIndex(today);
  let cursor = answered.has(todayIndex) ? todayIndex : todayIndex - 1;
  let streak = 0;

  while (answered.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }

  return streak;
}

/** Longest run of consecutive days anywhere in the history. */
export function computeLongestStreak(dates: Iterable<string>): number {
  const sorted = Array.from(new Set(Array.from(dates, dayIndex))).sort(
    (a, b) => a - b,
  );

  let longest = 0;
  let current = 0;
  let previous: number | null = null;

  for (const index of sorted) {
    current = previous !== null && index === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = index;
  }

  return longest;
}

/**
 * The room's shared streak: consecutive days on which *every* member answered.
 * This is the number worth showing two people — it takes both of you to keep it
 * alive.
 */
export function computeSharedStreak(
  dateSets: Iterable<string>[],
  today: string,
): number {
  const sets = Array.from(dateSets);
  if (sets.length === 0) return 0;

  const [first, ...rest] = sets.map(
    (dates) => new Set(Array.from(dates, dayIndex)),
  );

  const intersection: number[] = [];
  for (const index of first) {
    if (rest.every((set) => set.has(index))) intersection.push(index);
  }

  return computeStreak(
    intersection.map((index) => indexToDate(index)),
    today,
  );
}

function indexToDate(index: number): string {
  return new Date(index * 86_400_000).toISOString().slice(0, 10);
}
