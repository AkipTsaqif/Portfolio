import { describe, expect, test } from "bun:test";
import {
  createRoomSchema,
  generatedQuestionSchemaFor,
  joinRoomSchema,
  submitAnswerSchema,
  toggleReactionSchema,
} from "./schema";

const KNOWLEDGE = {
  prompt: { en: "Why is the sky blue?", id: "Mengapa langit berwarna biru?" },
  category: "Physics",
  difficulty: "easy",
  answer: {
    en: "Rayleigh scattering bends short blue wavelengths far more than long red ones, so blue light reaches your eye from every direction across the sky.",
    id: "Hamburan Rayleigh membelokkan gelombang biru jauh lebih kuat daripada merah, sehingga cahaya biru sampai ke matamu dari segala arah di langit.",
  },
} as const;

const REFLECTIVE = {
  prompt: {
    en: "What made this week feel long?",
    id: "Apa yang membuat minggu ini terasa panjang?",
  },
  category: null,
  difficulty: null,
  answer: null,
} as const;

describe("generatedQuestionSchemaFor", () => {
  test("accepts a complete knowledge question", () => {
    expect(
      generatedQuestionSchemaFor("knowledge").safeParse(KNOWLEDGE).success,
    ).toBe(true);
  });

  test("accepts a clean reflective question", () => {
    expect(
      generatedQuestionSchemaFor("reflective").safeParse(REFLECTIVE).success,
    ).toBe(true);
  });

  test("rejects a knowledge question with no answer key", () => {
    const result = generatedQuestionSchemaFor("knowledge").safeParse({
      ...KNOWLEDGE,
      answer: null,
    });

    expect(result.success).toBe(false);
  });

  test("rejects a knowledge question with no category or difficulty", () => {
    expect(
      generatedQuestionSchemaFor("knowledge").safeParse({
        ...KNOWLEDGE,
        category: null,
      }).success,
    ).toBe(false);
    expect(
      generatedQuestionSchemaFor("knowledge").safeParse({
        ...KNOWLEDGE,
        difficulty: null,
      }).success,
    ).toBe(false);
  });

  test("rejects a reflective question that carries an answer", () => {
    expect(
      generatedQuestionSchemaFor("reflective").safeParse({
        ...REFLECTIVE,
        answer: KNOWLEDGE.answer,
      }).success,
    ).toBe(false);
  });

  test("rejects a half-translated question", () => {
    expect(
      generatedQuestionSchemaFor("knowledge").safeParse({
        ...KNOWLEDGE,
        prompt: { en: KNOWLEDGE.prompt.en, id: "   " },
      }).success,
    ).toBe(false);
  });

  test("rejects prose that is too long for the column", () => {
    expect(
      generatedQuestionSchemaFor("reflective").safeParse({
        ...REFLECTIVE,
        prompt: { en: "x".repeat(301), id: "y".repeat(20) },
      }).success,
    ).toBe(false);
  });

  test("rejects a difficulty outside the allowed set", () => {
    expect(
      generatedQuestionSchemaFor("knowledge").safeParse({
        ...KNOWLEDGE,
        difficulty: "impossible",
      }).success,
    ).toBe(false);
  });

  test("rejects a bare string, which is what a refusal looks like", () => {
    expect(
      generatedQuestionSchemaFor("knowledge").safeParse(
        "I cannot help with that",
      ).success,
    ).toBe(false);
    expect(
      generatedQuestionSchemaFor("knowledge").safeParse(null).success,
    ).toBe(false);
  });
});

describe("submitAnswerSchema", () => {
  test("accepts a normal answer", () => {
    const result = submitAnswerSchema.safeParse({
      date: "2026-09-11",
      kind: "knowledge",
      body: "Because of Rayleigh scattering.",
    });

    expect(result.success).toBe(true);
  });

  test("trims surrounding whitespace", () => {
    const result = submitAnswerSchema.parse({
      date: "2026-09-11",
      kind: "knowledge",
      body: "  padded  ",
    });

    expect(result.body).toBe("padded");
  });

  test("rejects whitespace-only content", () => {
    expect(
      submitAnswerSchema.safeParse({
        date: "2026-09-11",
        kind: "knowledge",
        body: "   \n  ",
      }).success,
    ).toBe(false);
  });

  test("enforces the 2000 character ceiling", () => {
    expect(
      submitAnswerSchema.safeParse({
        date: "2026-09-11",
        kind: "knowledge",
        body: "x".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      submitAnswerSchema.safeParse({
        date: "2026-09-11",
        kind: "knowledge",
        body: "x".repeat(2000),
      }).success,
    ).toBe(true);
  });

  test("rejects a bogus date or kind", () => {
    expect(
      submitAnswerSchema.safeParse({
        date: "2026-02-31",
        kind: "knowledge",
        body: "hello",
      }).success,
    ).toBe(false);
    expect(
      submitAnswerSchema.safeParse({
        date: "2026-09-11",
        kind: "trivia",
        body: "hello",
      }).success,
    ).toBe(false);
  });
});

describe("createRoomSchema", () => {
  test("defaults to the weekly rhythm", () => {
    expect(createRoomSchema.parse({}).questionMode).toBe("mixed");
  });

  test("accepts every supported mode", () => {
    for (const mode of ["mixed", "knowledge", "reflective"]) {
      expect(createRoomSchema.safeParse({ questionMode: mode }).success).toBe(
        true,
      );
    }
  });

  test("rejects an unsupported mode", () => {
    expect(createRoomSchema.safeParse({ questionMode: "trivia" }).success).toBe(
      false,
    );
  });

  test("caps the room name", () => {
    expect(
      createRoomSchema.safeParse({ roomName: "x".repeat(61) }).success,
    ).toBe(false);
    expect(createRoomSchema.safeParse({ roomName: "Us" }).success).toBe(true);
  });
});

describe("joinRoomSchema", () => {
  test("accepts a name and a code", () => {
    expect(
      joinRoomSchema.safeParse({ code: "ABCDEFGHJKMN", displayName: "Akip" })
        .success,
    ).toBe(true);
  });

  test("rejects an empty or overlong name", () => {
    expect(
      joinRoomSchema.safeParse({ code: "ABCDEFGHJKMN", displayName: "  " })
        .success,
    ).toBe(false);
    expect(
      joinRoomSchema.safeParse({
        code: "ABCDEFGHJKMN",
        displayName: "x".repeat(33),
      }).success,
    ).toBe(false);
  });

  test("rejects a too-short code", () => {
    expect(
      joinRoomSchema.safeParse({ code: "ABC", displayName: "Akip" }).success,
    ).toBe(false);
  });
});

describe("toggleReactionSchema", () => {
  const answerId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  test("accepts a known emoji", () => {
    expect(
      toggleReactionSchema.safeParse({ answerId, emoji: "❤️" }).success,
    ).toBe(true);
  });

  test("rejects an arbitrary emoji, so the picker cannot become a text field", () => {
    expect(
      toggleReactionSchema.safeParse({ answerId, emoji: "🍆" }).success,
    ).toBe(false);
  });

  test("rejects a non-uuid answer id", () => {
    expect(
      toggleReactionSchema.safeParse({ answerId: "../etc/passwd", emoji: "🔥" })
        .success,
    ).toBe(false);
  });
});
