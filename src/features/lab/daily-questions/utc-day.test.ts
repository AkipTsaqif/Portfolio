import { describe, expect, test } from "bun:test";
import {
  addUtcDays,
  addUtcMonths,
  dayIndex,
  formatUtcDate,
  fromDayIndex,
  isDateString,
  isMonthKey,
  isUtcWeekend,
  monthKey,
  parseUtcDate,
  resolveQuestionKind,
  utcDateString,
  utcMonthGrid,
  utcToday,
  utcWeekdayLabels,
} from "./utc-day";

// 2026-09-11 is a Friday; 12th and 13th are the weekend.
const FRIDAY = "2026-09-11";
const SATURDAY = "2026-09-12";
const SUNDAY = "2026-09-13";
const MONDAY = "2026-09-14";

describe("utcToday", () => {
  test("reads the UTC calendar date, not the local one", () => {
    // 23:30 in Jakarta on the 11th is still the 11th in UTC (16:30).
    const instant = new Date("2026-09-11T16:30:00.000Z");
    expect(utcToday(instant)).toBe("2026-09-11");
  });

  test("rolls over exactly at 00:00 UTC", () => {
    expect(utcToday(new Date("2026-09-11T23:59:59.999Z"))).toBe("2026-09-11");
    expect(utcToday(new Date("2026-09-12T00:00:00.000Z"))).toBe("2026-09-12");
  });

  test("utcDateString is stable for any instant in the day", () => {
    expect(utcDateString(new Date("2026-09-11T00:00:00.000Z"))).toBe(FRIDAY);
    expect(utcDateString(new Date("2026-09-11T12:00:00.000Z"))).toBe(FRIDAY);
  });
});

describe("isDateString", () => {
  test("accepts real dates", () => {
    expect(isDateString("2026-09-11")).toBe(true);
    expect(isDateString("2024-02-29")).toBe(true);
  });

  test("rejects impossible and malformed dates", () => {
    expect(isDateString("2026-02-31")).toBe(false);
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("2023-02-29")).toBe(false);
    expect(isDateString("2026-9-1")).toBe(false);
    expect(isDateString("")).toBe(false);
    expect(isDateString(20260911)).toBe(false);
    expect(isDateString(null)).toBe(false);
  });
});

describe("dayIndex", () => {
  test("round-trips", () => {
    expect(fromDayIndex(dayIndex(FRIDAY))).toBe(FRIDAY);
  });

  test("is exactly one apart across a month boundary", () => {
    expect(dayIndex("2026-10-01") - dayIndex("2026-09-30")).toBe(1);
  });

  test("is exactly one apart across a leap day", () => {
    expect(dayIndex("2024-03-01") - dayIndex("2024-02-29")).toBe(1);
  });

  test("rejects a malformed date", () => {
    expect(() => dayIndex("nope")).toThrow();
  });
});

describe("addUtcDays", () => {
  test("walks forward and backward", () => {
    expect(addUtcDays(FRIDAY, 1)).toBe(SATURDAY);
    expect(addUtcDays(FRIDAY, -1)).toBe("2026-09-10");
    expect(addUtcDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addUtcDays("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("isUtcWeekend", () => {
  test("knows which days are which", () => {
    expect(isUtcWeekend(FRIDAY)).toBe(false);
    expect(isUtcWeekend(SATURDAY)).toBe(true);
    expect(isUtcWeekend(SUNDAY)).toBe(true);
    expect(isUtcWeekend(MONDAY)).toBe(false);
  });
});

describe("resolveQuestionKind", () => {
  test("mixed follows the weekly rhythm", () => {
    expect(resolveQuestionKind("mixed", FRIDAY)).toBe("knowledge");
    expect(resolveQuestionKind("mixed", MONDAY)).toBe("knowledge");
    expect(resolveQuestionKind("mixed", SATURDAY)).toBe("reflective");
    expect(resolveQuestionKind("mixed", SUNDAY)).toBe("reflective");
  });

  test("knowledge rooms ignore the weekday", () => {
    for (const date of [FRIDAY, SATURDAY, SUNDAY, MONDAY]) {
      expect(resolveQuestionKind("knowledge", date)).toBe("knowledge");
    }
  });

  test("reflective rooms ignore the weekday", () => {
    for (const date of [FRIDAY, SATURDAY, SUNDAY, MONDAY]) {
      expect(resolveQuestionKind("reflective", date)).toBe("reflective");
    }
  });

  test("two rooms with the same mode always agree", () => {
    expect(resolveQuestionKind("mixed", SATURDAY)).toBe(
      resolveQuestionKind("mixed", SATURDAY),
    );
  });
});

describe("monthKey and addUtcMonths", () => {
  test("extracts the month", () => {
    expect(monthKey(FRIDAY)).toBe("2026-09");
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-9")).toBe(false);
  });

  test("walks months across year boundaries", () => {
    expect(addUtcMonths("2026-12", 1)).toBe("2027-01");
    expect(addUtcMonths("2026-01", -1)).toBe("2025-12");
    expect(addUtcMonths("2026-09", 4)).toBe("2027-01");
    expect(addUtcMonths("2026-09", -9)).toBe("2025-12");
  });

  test("goes back and forward over many years", () => {
    expect(addUtcMonths("2026-06", 24)).toBe("2028-06");
  });
});

describe("utcMonthGrid", () => {
  test("always yields six whole weeks", () => {
    for (const month of ["2026-01", "2026-02", "2026-09", "2024-02"]) {
      expect(utcMonthGrid(month)).toHaveLength(42);
    }
  });

  test("starts on a Monday", () => {
    for (const month of ["2026-01", "2026-02", "2026-09", "2024-02"]) {
      expect(parseUtcDate(utcMonthGrid(month)[0]).getUTCDay()).toBe(1);
    }
  });

  test("opens on or before the first of the month", () => {
    expect(utcMonthGrid("2026-09")[0]).toBe("2026-08-31");
  });

  test("contains every day of the month exactly once", () => {
    const cells = utcMonthGrid("2026-09");
    const inMonth = cells.filter((date) => date.startsWith("2026-09"));
    expect(inMonth).toHaveLength(30);
    expect(new Set(cells).size).toBe(42);
    expect(inMonth[0]).toBe("2026-09-01");
    expect(inMonth.at(-1)).toBe("2026-09-30");
  });

  test("pads a leap February correctly", () => {
    const inMonth = utcMonthGrid("2024-02").filter((date) =>
      date.startsWith("2024-02"),
    );
    expect(inMonth).toHaveLength(29);
  });
});

describe("formatting", () => {
  test("renders the UTC day, not the machine's local day", () => {
    // The one piece of logic in formatUtcDate that is ours is the `timeZone: "UTC"` pin.
    // Without it, 2026-09-11T00:00Z renders as the 10th on any machine behind UTC, which
    // is what this catches.
    const rendered = formatUtcDate(FRIDAY, "en");
    expect(rendered).toContain("2026");
    expect(rendered).toMatch(/\b11\b/);
  });

  test("accepts both site locales", () => {
    // Deliberately does NOT assert the two render differently, which an earlier version
    // did — and it passed here for the wrong reason. This machine's ICU abbreviates
    // September as "Sept" in en-GB and "Sep" in id-ID, so the strings differed; a CI
    // runner's ICU data abbreviates both as "Sep", so the assertion failed. It was
    // measuring the runtime's CLDR version rather than this function.
    //
    // Month names are ICU's business. The wrapper's job is choosing the BCP-47 tag and
    // pinning UTC, and the tag choice is not observable without depending on ICU data.
    for (const locale of ["en", "id"] as const) {
      expect(formatUtcDate(FRIDAY, locale)).toContain("2026");
    }
  });

  test("is stable for the same input", () => {
    expect(formatUtcDate(FRIDAY, "en")).toBe(formatUtcDate(FRIDAY, "en"));
  });

  test("gives seven weekday initials starting on Monday", () => {
    const labels = utcWeekdayLabels("en");
    expect(labels).toHaveLength(7);
    expect(labels[0].toLowerCase()).toBe("m");
    expect(labels[6].toLowerCase()).toBe("s");
  });
});
