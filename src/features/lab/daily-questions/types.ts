import type { Difficulty, QuestionKind, RoomMode } from "@/lib/db/types";

export type { Difficulty, QuestionKind, RoomMode };

/** The five things you can do to someone else's answer. */
export const REACTION_EMOJIS = ["❤️", "😂", "🤯", "👏", "🥹", "🔥"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const ROOM_MODES: readonly RoomMode[] = [
  "mixed",
  "knowledge",
  "reflective",
];

export const ROOM_CODE_LENGTH = 12;
export const MAX_ANSWER_LENGTH = 2000;
export const MAX_DISPLAY_NAME_LENGTH = 32;
export const MAX_ROOM_NAME_LENGTH = 60;

/** A question as the model is asked to produce it: bilingual, in one call. */
export type GeneratedQuestion = {
  prompt: { en: string; id: string };
  category: string | null;
  difficulty: Difficulty | null;
  answer: { en: string; id: string } | null;
};

/** A published question, already narrowed to the reader's locale. */
export type DailyQuestion = {
  date: string;
  kind: QuestionKind;
  prompt: string;
  answer: string | null;
  category: string | null;
  difficulty: Difficulty | null;
  source: "omniroute" | "fallback";
};

export type RoomMemberView = {
  id: string;
  displayName: string;
  joinedAt: string;
  isMe: boolean;
};

export type ReactionView = {
  emoji: string;
  count: number;
  mine: boolean;
};

/**
 * One member's slot for a day. `body` is `null` while the room is still locked
 * for the reader — the server never sends the text at all, so this is not a
 * presentation detail.
 */
export type DayAnswerView = {
  memberId: string;
  displayName: string;
  isMe: boolean;
  /** Null while the room is locked for the reader — no id is sent either. */
  answerId: string | null;
  body: string | null;
  createdAt: string | null;
  reactions: ReactionView[];
};

export type RoomDayView = {
  date: string;
  kind: QuestionKind;
  question: DailyQuestion | null;
  /** True when generation failed and no fallback could be resolved either. */
  questionUnavailable: boolean;
  meAnswered: boolean;
  entries: DayAnswerView[];
  /** Only populated once the reader has answered a knowledge question. */
  answerKey: string | null;
  isToday: boolean;
};

/** How a calendar cell should read at a glance. */
export type DayStatus = "future" | "none" | "locked" | "partial" | "complete";

export type CalendarCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  status: DayStatus;
  href: string | null;
};

export type CalendarMonth = {
  /** `YYYY-MM` */
  month: string;
  label: string;
  cells: CalendarCell[];
};
