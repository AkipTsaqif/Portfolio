import { describe, expect, test } from "bun:test";
import type { DailyQuestionRow, ReactionRow } from "@/lib/db/types";
import {
  buildCalendarMonth,
  dayStatus,
  orderEntries,
  pickPublicQuestion,
  publicArchive,
  toDailyQuestion,
  toReactionViews,
} from "./view";

const TODAY = "2026-09-11";

function questionRow(
  overrides: Partial<DailyQuestionRow> = {},
): DailyQuestionRow {
  return {
    date: TODAY,
    kind: "knowledge",
    status: "ready",
    pending_since: "2026-09-11T00:00:00.000Z",
    prompt_en: "Why is the sky blue?",
    prompt_id: "Mengapa langit berwarna biru?",
    answer_en: "Rayleigh scattering.",
    answer_id: "Hamburan Rayleigh.",
    category: "Physics",
    difficulty: "easy",
    source: "omniroute",
    model: "auto",
    created_by: null,
    created_at: "2026-09-11T00:00:01.000Z",
    updated_by: null,
    updated_at: "2026-09-11T00:00:01.000Z",
    deleted_by: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("toDailyQuestion", () => {
  test("picks the reader's locale", () => {
    expect(toDailyQuestion(questionRow(), "en")?.prompt).toBe(
      "Why is the sky blue?",
    );
    expect(toDailyQuestion(questionRow(), "id")?.prompt).toBe(
      "Mengapa langit berwarna biru?",
    );
  });

  test("keeps the answer and metadata in step with the locale", () => {
    const row = questionRow();

    expect(toDailyQuestion(row, "en")?.answer).toBe("Rayleigh scattering.");
    expect(toDailyQuestion(row, "id")?.answer).toBe("Hamburan Rayleigh.");
    expect(toDailyQuestion(row, "en")?.category).toBe("Physics");
    expect(toDailyQuestion(row, "en")?.difficulty).toBe("easy");
  });

  test("returns null for an unpublished row rather than inventing text", () => {
    expect(toDailyQuestion(null, "en")).toBeNull();
    expect(
      toDailyQuestion(questionRow({ status: "pending" }), "en"),
    ).toBeNull();
    expect(toDailyQuestion(questionRow({ prompt_en: null }), "en")).toBeNull();
    expect(toDailyQuestion(questionRow({ prompt_id: null }), "en")).toBeNull();
  });

  test("surfaces a reflective question with no answer key", () => {
    const reflective = toDailyQuestion(
      questionRow({
        kind: "reflective",
        answer_en: null,
        answer_id: null,
        category: null,
        difficulty: null,
      }),
      "en",
    );

    expect(reflective?.answer).toBeNull();
    expect(reflective?.category).toBeNull();
    expect(reflective?.difficulty).toBeNull();
  });

  test("reports a fallback question honestly", () => {
    expect(
      toDailyQuestion(questionRow({ source: "fallback" }), "en")?.source,
    ).toBe("fallback");
    expect(toDailyQuestion(questionRow(), "en")?.source).toBe("omniroute");
  });
});

function reaction(emoji: string, memberId: string): ReactionRow {
  return {
    id: `id-${emoji}-${memberId}`,
    answer_id: "answer-1",
    member_id: memberId,
    emoji,
    created_by: memberId,
    created_at: "2026-09-11T08:00:00.000Z",
    updated_by: null,
    updated_at: "2026-09-11T08:00:00.000Z",
    deleted_by: null,
    deleted_at: null,
  };
}

describe("toReactionViews", () => {
  test("is empty when nobody reacted", () => {
    expect(toReactionViews([], "me")).toEqual([]);
  });

  test("counts and marks your own", () => {
    const views = toReactionViews(
      [reaction("❤️", "me"), reaction("❤️", "them"), reaction("🔥", "them")],
      "me",
    );

    expect(views).toEqual([
      { emoji: "❤️", count: 2, mine: true },
      { emoji: "🔥", count: 1, mine: false },
    ]);
  });

  test("keeps a stable order regardless of insert order", () => {
    const first = toReactionViews(
      [reaction("😂", "them"), reaction("❤️", "them")],
      "me",
    );
    const second = toReactionViews(
      [reaction("❤️", "them"), reaction("😂", "them")],
      "me",
    );

    expect(first).toEqual(second);
    expect(first[0].emoji).toBe("❤️");
  });

  test("keeps an emoji that is no longer offered", () => {
    const views = toReactionViews([reaction("🎉", "them")], "me");
    expect(views).toEqual([{ emoji: "🎉", count: 1, mine: false }]);
  });
});

describe("dayStatus", () => {
  const base = { today: TODAY, memberCount: 2, myMemberId: "me" };

  test("future days are future", () => {
    expect(
      dayStatus({ ...base, date: "2026-09-12", answeredBy: new Set() }),
    ).toBe("future");
  });

  test("nobody answered", () => {
    expect(dayStatus({ ...base, date: TODAY, answeredBy: new Set() })).toBe(
      "none",
    );
  });

  test("everyone answered", () => {
    expect(
      dayStatus({ ...base, date: TODAY, answeredBy: new Set(["me", "them"]) }),
    ).toBe("complete");
  });

  test("you answered but they have not", () => {
    expect(
      dayStatus({ ...base, date: TODAY, answeredBy: new Set(["me"]) }),
    ).toBe("partial");
  });

  test("they answered but you have not — the locked case", () => {
    expect(
      dayStatus({ ...base, date: TODAY, answeredBy: new Set(["them"]) }),
    ).toBe("locked");
  });

  test("a one-person room is complete as soon as they answer", () => {
    expect(
      dayStatus({
        today: TODAY,
        date: TODAY,
        memberCount: 1,
        myMemberId: "me",
        answeredBy: new Set(["me"]),
      }),
    ).toBe("complete");
  });
});

describe("buildCalendarMonth", () => {
  const build = (answeredByDate: Map<string, Set<string>>, today = TODAY) =>
    buildCalendarMonth({
      month: "2026-09",
      locale: "en",
      today,
      memberCount: 2,
      myMemberId: "me",
      answeredByDate,
      hrefs: new Map([["2026-09-10", "/en/room/day/2026-09-10"]]),
    });

  test("covers the month in whole weeks", () => {
    const calendar = build(new Map());
    expect(calendar.cells).toHaveLength(42);
    expect(calendar.cells.filter((cell) => cell.inMonth)).toHaveLength(30);
  });

  test("marks the outer weeks as out of month", () => {
    const calendar = build(new Map());
    expect(calendar.cells[0].date).toBe("2026-08-31");
    expect(calendar.cells[0].inMonth).toBe(false);
  });

  test("flags today", () => {
    const calendar = build(new Map());
    expect(calendar.cells.filter((cell) => cell.isToday)).toHaveLength(1);
  });

  test("carries per-day state and links", () => {
    const calendar = build(
      new Map([
        ["2026-09-10", new Set(["me", "them"])],
        ["2026-09-09", new Set(["me"])],
      ]),
    );

    const tenth = calendar.cells.find((cell) => cell.date === "2026-09-10");
    const ninth = calendar.cells.find((cell) => cell.date === "2026-09-09");

    expect(tenth?.status).toBe("complete");
    expect(tenth?.href).toBe("/en/room/day/2026-09-10");
    expect(ninth?.status).toBe("partial");
    expect(ninth?.href).toBeNull();
  });

  test("labels the month", () => {
    expect(build(new Map()).label).toContain("2026");
  });
});

describe("orderEntries", () => {
  const entry = (memberId: string) => ({
    memberId,
    displayName: memberId,
    isMe: memberId === "me",
    answerId: `answer-${memberId}`,
    body: null,
    createdAt: null,
    reactions: [],
  });

  test("puts the reader first", () => {
    const ordered = orderEntries([entry("them"), entry("me")], "me");
    expect(ordered.map((item) => item.memberId)).toEqual(["me", "them"]);
  });

  test("leaves everyone else in their original order", () => {
    const ordered = orderEntries([entry("a"), entry("b"), entry("c")], "me");
    expect(ordered.map((item) => item.memberId)).toEqual(["a", "b", "c"]);
  });
});

describe("pickPublicQuestion", () => {
  const knowledge = questionRow({ date: "2026-09-11", kind: "knowledge" });
  const reflective = questionRow({
    date: "2026-09-11",
    kind: "reflective",
    prompt_en: "How was your week?",
    answer_en: null,
    category: null,
    difficulty: null,
  });

  test("picks the weekly-rhythm question for a weekday", () => {
    // 2026-09-11 is a Friday, so the public record shows the knowledge one.
    expect(
      pickPublicQuestion([reflective, knowledge], "2026-09-11")?.kind,
    ).toBe("knowledge");
  });

  test("picks the reflective question at the weekend", () => {
    const saturday = (row: DailyQuestionRow) => ({
      ...row,
      date: "2026-09-12",
    });
    const picked = pickPublicQuestion(
      [saturday(knowledge), saturday(reflective)],
      "2026-09-12",
    );

    expect(picked?.kind).toBe("reflective");
  });

  test("falls back to whichever variant exists", () => {
    // A Saturday with only a knowledge row recorded: still reachable.
    const saturdayKnowledge = { ...knowledge, date: "2026-09-12" };
    expect(pickPublicQuestion([saturdayKnowledge], "2026-09-12")?.kind).toBe(
      "knowledge",
    );
  });

  test("returns null for a date with no questions", () => {
    expect(pickPublicQuestion([knowledge], "2026-01-01")).toBeNull();
  });
});

describe("publicArchive", () => {
  test("is empty with no rows", () => {
    expect(publicArchive([], "en")).toEqual([]);
  });

  test("emits one entry per date, newest first", () => {
    const rows = [
      questionRow({ date: "2026-09-11", prompt_en: "Friday" }),
      questionRow({ date: "2026-09-10", prompt_en: "Thursday" }),
      questionRow({
        date: "2026-09-10",
        prompt_en: "Thursday (other kind)",
        kind: "reflective",
      }),
    ];

    const archive = publicArchive(rows, "en");

    expect(archive.map((question) => question.date)).toEqual([
      "2026-09-11",
      "2026-09-10",
    ]);
    expect(archive[0].prompt).toBe("Friday");
  });

  test("drops dates whose question never published", () => {
    const archive = publicArchive([questionRow({ status: "pending" })], "en");
    expect(archive).toEqual([]);
  });

  test("localises the archived questions", () => {
    const rows = [questionRow({ date: "2026-09-11" })];
    expect(publicArchive(rows, "id")[0].prompt).toBe(
      "Mengapa langit berwarna biru?",
    );
  });
});
