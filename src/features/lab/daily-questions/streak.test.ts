import { describe, expect, test } from "bun:test";
import {
  computeLongestStreak,
  computeSharedStreak,
  computeStreak,
} from "./streak";

const TODAY = "2026-09-11";

describe("computeStreak", () => {
  test("is zero with no answers", () => {
    expect(computeStreak([], TODAY)).toBe(0);
  });

  test("counts today as part of the run", () => {
    expect(
      computeStreak(["2026-09-11", "2026-09-10", "2026-09-09"], TODAY),
    ).toBe(3);
  });

  test("is still alive before today is answered", () => {
    expect(computeStreak(["2026-09-10", "2026-09-09"], TODAY)).toBe(2);
  });

  test("is dead once yesterday is missed too", () => {
    expect(computeStreak(["2026-09-09", "2026-09-08"], TODAY)).toBe(0);
  });

  test("stops at the first gap", () => {
    expect(
      computeStreak(["2026-09-11", "2026-09-10", "2026-09-08"], TODAY),
    ).toBe(2);
  });

  test("ignores the order dates arrive in", () => {
    expect(
      computeStreak(["2026-09-09", "2026-09-11", "2026-09-10"], TODAY),
    ).toBe(3);
  });

  test("ignores duplicates", () => {
    expect(
      computeStreak(["2026-09-11", "2026-09-11", "2026-09-10"], TODAY),
    ).toBe(2);
  });

  test("does not let a future date inflate the count", () => {
    expect(computeStreak(["2026-09-12", "2026-09-11"], TODAY)).toBe(1);
  });

  test("handles a run across a month boundary", () => {
    expect(
      computeStreak(["2026-10-01", "2026-09-30", "2026-09-29"], "2026-10-01"),
    ).toBe(3);
  });

  test("handles a run across a leap day", () => {
    expect(
      computeStreak(["2024-03-01", "2024-02-29", "2024-02-28"], "2024-03-01"),
    ).toBe(3);
  });
});

describe("computeLongestStreak", () => {
  test("is zero with no answers", () => {
    expect(computeLongestStreak([])).toBe(0);
  });

  test("finds the longest run anywhere in the history", () => {
    expect(
      computeLongestStreak([
        "2026-09-11",
        "2026-09-10",
        "2026-09-08",
        "2026-09-07",
        "2026-09-06",
      ]),
    ).toBe(3);
  });

  test("is one for scattered days", () => {
    expect(computeLongestStreak(["2026-09-11", "2026-09-01"])).toBe(1);
  });
});

describe("computeSharedStreak", () => {
  test("is zero with no members", () => {
    expect(computeSharedStreak([], TODAY)).toBe(0);
  });

  test("counts only days everyone answered", () => {
    const mine = ["2026-09-11", "2026-09-10", "2026-09-09"];
    const theirs = ["2026-09-11", "2026-09-10"];

    expect(computeSharedStreak([mine, theirs], TODAY)).toBe(2);
  });

  test("is zero when one person has never answered", () => {
    expect(computeSharedStreak([["2026-09-11", "2026-09-10"], []], TODAY)).toBe(
      0,
    );
  });

  test("survives a day only one of them answered", () => {
    const mine = ["2026-09-11", "2026-09-10", "2026-09-09"];
    const theirs = ["2026-09-11", "2026-09-10", "2026-09-07"];

    expect(computeSharedStreak([mine, theirs], TODAY)).toBe(2);
  });

  test("works for a room of three", () => {
    const sets = [
      ["2026-09-11", "2026-09-10"],
      ["2026-09-11", "2026-09-10"],
      ["2026-09-11"],
    ];

    expect(computeSharedStreak(sets, TODAY)).toBe(1);
  });

  test("is still alive before today is fully answered", () => {
    const sets = [
      ["2026-09-10", "2026-09-09"],
      ["2026-09-10", "2026-09-09"],
    ];

    expect(computeSharedStreak(sets, TODAY)).toBe(2);
  });
});
