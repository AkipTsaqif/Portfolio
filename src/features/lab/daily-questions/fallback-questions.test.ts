import { describe, expect, test } from "bun:test";
import {
  FALLBACK_QUESTIONS,
  fallbackBankFor,
  fallbackBankProblems,
  pickFallbackQuestion,
} from "./fallback-questions";
import { addUtcDays } from "./utc-day";

const DATE = "2026-09-11";

describe("the fallback bank", () => {
  test("has no structural problems", () => {
    expect(fallbackBankProblems()).toEqual([]);
  });

  test("covers both kinds", () => {
    expect(fallbackBankFor("knowledge").length).toBeGreaterThanOrEqual(4);
    expect(fallbackBankFor("reflective").length).toBeGreaterThanOrEqual(4);
  });

  test("has a unique prompt in each locale", () => {
    const english = FALLBACK_QUESTIONS.map((question) => question.prompt.en);
    const indonesian = FALLBACK_QUESTIONS.map((question) => question.prompt.id);

    expect(new Set(english).size).toBe(english.length);
    expect(new Set(indonesian).size).toBe(indonesian.length);
  });

  test("keeps every prompt inside the column bounds", () => {
    for (const question of FALLBACK_QUESTIONS) {
      for (const locale of ["en", "id"] as const) {
        expect(question.prompt[locale].length).toBeGreaterThanOrEqual(8);
        expect(question.prompt[locale].length).toBeLessThanOrEqual(300);
      }
    }
  });
});

describe("pickFallbackQuestion", () => {
  test("is deterministic for a date", () => {
    expect(pickFallbackQuestion("knowledge", DATE)).toEqual(
      pickFallbackQuestion("knowledge", DATE),
    );
  });

  test("returns the shape the kind requires", () => {
    const knowledge = pickFallbackQuestion("knowledge", DATE);
    expect(knowledge.answer).not.toBeNull();
    expect(knowledge.category).not.toBeNull();
    expect(knowledge.difficulty).not.toBeNull();

    const reflective = pickFallbackQuestion("reflective", DATE);
    expect(reflective.answer).toBeNull();
    expect(reflective.category).toBeNull();
    expect(reflective.difficulty).toBeNull();
  });

  test("cycles instead of repeating, and visits the whole bank", () => {
    const bank = fallbackBankFor("knowledge");
    const seen = new Set<string>();

    for (let offset = 0; offset < bank.length; offset += 1) {
      seen.add(
        pickFallbackQuestion("knowledge", addUtcDays(DATE, offset)).prompt.en,
      );
    }

    expect(seen.size).toBe(bank.length);
  });

  test("wraps around rather than running out", () => {
    const bank = fallbackBankFor("reflective");
    const first = pickFallbackQuestion("reflective", DATE);
    const wrapped = pickFallbackQuestion(
      "reflective",
      addUtcDays(DATE, bank.length),
    );

    expect(wrapped).toEqual(first);
  });

  test("picks independently per kind", () => {
    // Both kinds index into their own bank, so a Saturday does not repeat
    // Friday's knowledge question as the reflective one.
    const knowledge = pickFallbackQuestion("knowledge", DATE);
    const reflective = pickFallbackQuestion("reflective", DATE);
    expect(knowledge.prompt.en).not.toBe(reflective.prompt.en);
  });

  test("never throws for any date", () => {
    for (let offset = -400; offset < 400; offset += 1) {
      const date = addUtcDays(DATE, offset);
      expect(() => pickFallbackQuestion("knowledge", date)).not.toThrow();
      expect(() => pickFallbackQuestion("reflective", date)).not.toThrow();
    }
  });
});
