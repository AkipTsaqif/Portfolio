import "server-only";
import type { Locale } from "@/i18n/config";
import type { MemberRow, ReactionRow, RoomRow } from "@/lib/db/types";
import { readDailyQuestion, resolveDailyQuestion } from "./questions";
import {
  getAnswerDays,
  getDayEntries,
  getMemberAnswerDates,
  getReactionsForDay,
  listMembers,
  type DayEntry,
} from "./room";
import { computeSharedStreak, computeStreak } from "./streak";
import type { DayAnswerView, RoomDayView } from "./types";
import { resolveQuestionKind, utcMonthGrid, utcToday } from "./utc-day";
import {
  buildCalendarMonth,
  orderEntries,
  toDailyQuestion,
  toReactionViews,
} from "./view";

/**
 * Assembles the shapes the pages render, from the queries in `room.ts` and the
 * pure helpers in `view.ts`. Nothing here is presentation — it is the one place
 * that decides what a reader is allowed to see.
 */

function assembleEntries(
  entries: DayEntry[],
  reactionsByAnswer: Map<string, ReactionRow[]>,
  myMemberId: string,
  unlocked: boolean,
): DayAnswerView[] {
  return orderEntries(
    entries.map((entry) => ({
      memberId: entry.member_id,
      displayName: entry.display_name,
      isMe: entry.member_id === myMemberId,
      answerId: entry.answer_id,
      body: entry.body,
      createdAt: entry.created_at,
      // Reactions are only meaningful — and only non-leaking — once the reader
      // has answered. A locked room shows nothing at all.
      reactions:
        unlocked && entry.answer_id
          ? toReactionViews(
              reactionsByAnswer.get(entry.answer_id) ?? [],
              myMemberId,
            )
          : [],
    })),
    myMemberId,
  );
}

export async function buildRoomDay(options: {
  room: RoomRow;
  memberId: string;
  date: string;
  locale: Locale;
  /** False for archive pages, which must never trigger generation. */
  allowGeneration?: boolean;
}): Promise<RoomDayView> {
  const { room, memberId, date, locale } = options;
  const today = utcToday();
  const isToday = date === today;
  const kind = resolveQuestionKind(room.question_mode, date);

  // Generating a question only ever happens for the current UTC day. A past day
  // either already has one or is honestly reported as unrecorded.
  const canGenerate = (options.allowGeneration ?? true) && isToday;

  const [questionRow, day] = await Promise.all([
    canGenerate
      ? resolveDailyQuestion(kind, date)
      : readDailyQuestion(kind, date),
    getDayEntries({ roomId: room.id, myMemberId: memberId, date, kind }),
  ]);

  const question = toDailyQuestion(questionRow, locale);

  const reactions = day.meAnswered
    ? await getReactionsForDay({ roomId: room.id, date, kind })
    : [];

  const reactionsByAnswer = new Map<string, ReactionRow[]>();
  for (const row of reactions) {
    const list = reactionsByAnswer.get(row.answer_id) ?? [];
    list.push(row);
    reactionsByAnswer.set(row.answer_id, list);
  }

  return {
    date,
    kind,
    question,
    questionUnavailable: question === null,
    meAnswered: day.meAnswered,
    entries: assembleEntries(
      day.entries,
      reactionsByAnswer,
      memberId,
      day.meAnswered,
    ),
    answerKey:
      day.meAnswered && kind === "knowledge"
        ? (question?.answer ?? null)
        : null,
    isToday,
  };
}

export type RoomStats = {
  memberCount: number;
  myStreak: number;
  sharedStreak: number;
};

export async function getRoomStats(options: {
  roomId: string;
  memberId: string;
  members: MemberRow[];
}): Promise<RoomStats> {
  const { roomId, memberId, members } = options;
  const today = utcToday();

  const myDates = await getMemberAnswerDates(memberId);
  const myStreak = computeStreak(myDates, today);

  // Only bother computing the shared streak for a room of two or more.
  let sharedStreak = 0;
  if (members.length > 1) {
    const dateSets = await Promise.all(
      members.map((member) => getMemberAnswerDates(member.id)),
    );
    sharedStreak = computeSharedStreak(dateSets, today);
  } else {
    sharedStreak = computeStreak(myDates, today);
  }

  void roomId;

  return { memberCount: members.length, myStreak, sharedStreak };
}

export async function getRoomCalendar(options: {
  room: RoomRow;
  member: MemberRow;
  month: string;
  locale: Locale;
  hrefFor: (date: string) => string;
}) {
  const { room, member, month, locale, hrefFor } = options;

  const members = await listMembers(room.id);
  const monthRange = utcMonthGrid(month);

  const answeredByDate = await getAnswerDays({
    roomId: room.id,
    from: monthRange[0],
    to: monthRange[monthRange.length - 1],
  });

  return buildCalendarMonth({
    month,
    locale,
    today: utcToday(),
    memberCount: members.length,
    myMemberId: member.id,
    answeredByDate,
    hrefs: new Map(monthRange.map((date) => [date, hrefFor(date)])),
  });
}

/** Everything the room page and the day page both need. */
export async function getRoomContext(room: RoomRow, memberId: string) {
  const members = await listMembers(room.id);
  const stats = await getRoomStats({
    roomId: room.id,
    memberId,
    members,
  });

  return { members, stats };
}
