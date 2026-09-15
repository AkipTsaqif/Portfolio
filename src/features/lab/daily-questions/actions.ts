"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, localizedPath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { QuestionKind, RoomMode } from "@/lib/db/types";
import { actionError, actionNotice, type ActionState } from "./action-state";
import { generateDeviceToken, generateRoomCode, hashToken } from "./code";
import {
  ROOM_CREATE_LIMIT_PER_DAY,
  ROOM_CREATE_WINDOW_SECONDS,
  ROOM_JOIN_LIMIT_PER_HOUR,
  ROOM_JOIN_WINDOW_SECONDS,
  hasDatabase,
} from "./env";
import { resolveDailyQuestion, flagQuestion } from "./questions";
import {
  DeviceAlreadyInAnotherRoom,
  DisplayNameTaken,
  countRecentEvents,
  createRoom,
  deleteRoom,
  findRoomByCode,
  joinRoom,
  leaveRoom,
  recordEvent,
  retractAnswer,
  setQuestionMode,
  submitAnswer,
  toggleReaction,
} from "./room";
import {
  createRoomSchema,
  flagQuestionSchema,
  joinRoomSchema,
  retractAnswerSchema,
  setQuestionModeSchema,
  submitAnswerSchema,
  toggleReactionSchema,
} from "./schema";
import {
  destroyDeviceCookie,
  getRequestIpHash,
  getSession,
  writeDeviceCookie,
} from "./session";
import { resolveQuestionKind, utcToday } from "./utc-day";

/**
 * Every mutation in the tool.
 *
 * Three rules hold for all of them:
 *
 *   1. Input is validated with zod before it touches the database.
 *   2. The acting member is re-derived from the device cookie. No action ever
 *      accepts a member id, a room id or an answer owner from the client.
 *   3. Messages are localised here, on the server, from the submitted locale.
 */

const ROOM_PATH = "/lab/daily-questions/room";
const HOME_PATH = "/lab/daily-questions";

async function localeFrom(formData: FormData): Promise<Locale> {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "en";
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalField(formData: FormData, name: string): string | undefined {
  const value = field(formData, name).trim();
  return value.length > 0 ? value : undefined;
}

async function dictionaryFor(formData: FormData) {
  return (await getDictionary(await localeFrom(formData))).dailyQuestions;
}

/** Guard shared by everything that needs a live session. */
async function requireSessionOr<T extends ActionState>(
  formData: FormData,
  fallback: T,
): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { state: ActionState }
> {
  const session = await getSession();
  if (session) return { session };

  const t = await dictionaryFor(formData);
  return { state: { ...fallback, error: t.errors.notInRoom, ok: false } };
}

// --- rooms ----------------------------------------------------------------

export async function createRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await localeFrom(formData);
  const t = (await getDictionary(locale)).dailyQuestions;

  // Only the database is a hard requirement. A missing gateway key degrades to
  // the standby question bank, which is no reason to refuse a room.
  if (!hasDatabase()) {
    return actionError(t.errors.notConfigured);
  }

  const parsed = createRoomSchema.safeParse({
    roomName: optionalField(formData, "roomName"),
    questionMode: field(formData, "questionMode") || "mixed",
  });

  if (!parsed.success) {
    return actionError(t.errors.invalidInput);
  }

  const displayName = optionalField(formData, "displayName");
  if (!displayName) return actionError(t.errors.nameRequired);
  if (displayName.length > 32) return actionError(t.errors.invalidInput);

  const ipHash = await getRequestIpHash();
  const recent = await countRecentEvents({
    kind: "room_create",
    ipHash,
    windowSeconds: ROOM_CREATE_WINDOW_SECONDS,
  });

  if (recent >= ROOM_CREATE_LIMIT_PER_DAY) {
    return actionError(t.errors.rateLimited);
  }

  const token = generateDeviceToken();

  try {
    await createRoom({
      memberName: displayName,
      tokenHash: hashToken(token),
      questionMode: parsed.data.questionMode as RoomMode,
      roomName: parsed.data.roomName ?? null,
      generateCode: generateRoomCode,
    });
  } catch (error) {
    if (error instanceof DeviceAlreadyInAnotherRoom) {
      return actionError(t.errors.alreadyInRoom);
    }
    if (error instanceof DisplayNameTaken) {
      return actionError(t.errors.nameTaken);
    }
    console.error("[daily-questions] createRoom failed", error);
    return actionError(t.errors.unavailable);
  }

  await recordEvent({ kind: "room_create", ipHash, memberId: null });
  await writeDeviceCookie(token);

  redirect(localizedPath(locale, ROOM_PATH));
}

export async function joinRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await localeFrom(formData);
  const t = (await getDictionary(locale)).dailyQuestions;

  if (!hasDatabase()) {
    return actionError(t.errors.notConfigured);
  }

  const parsed = joinRoomSchema.safeParse({
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
  });

  if (!parsed.success) {
    return actionError(t.errors.invalidInput);
  }

  const ipHash = await getRequestIpHash();
  const recent = await countRecentEvents({
    kind: "room_join",
    ipHash,
    windowSeconds: ROOM_JOIN_WINDOW_SECONDS,
  });

  if (recent >= ROOM_JOIN_LIMIT_PER_HOUR) {
    return actionError(t.errors.rateLimited);
  }

  await recordEvent({ kind: "room_join", ipHash, memberId: null });

  const room = await findRoomByCode(parsed.data.code);

  if (!room) return actionError(t.errors.roomNotFound);

  const token = generateDeviceToken();

  try {
    await joinRoom({
      room,
      displayName: parsed.data.displayName,
      tokenHash: hashToken(token),
    });
  } catch (error) {
    if (error instanceof DeviceAlreadyInAnotherRoom) {
      return actionError(t.errors.alreadyInRoom);
    }
    if (error instanceof DisplayNameTaken) {
      return actionError(t.errors.nameTaken);
    }
    console.error("[daily-questions] joinRoom failed", error);
    return actionError(t.errors.unavailable);
  }

  await writeDeviceCookie(token);

  redirect(localizedPath(locale, ROOM_PATH));
}

export async function setQuestionModeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireSessionOr(formData, {
    error: null,
    notice: null,
    ok: false,
  });
  if ("state" in guard) return guard.state;

  const t = await dictionaryFor(formData);
  const parsed = setQuestionModeSchema.safeParse({
    mode: field(formData, "mode"),
  });

  if (!parsed.success) return actionError(t.errors.invalidInput);

  const updated = await setQuestionMode(
    guard.session.room.id,
    parsed.data.mode as RoomMode,
    guard.session.member.id,
  );

  if (!updated) return actionError(t.errors.unavailable);

  revalidatePath(localizedPath(await localeFrom(formData), ROOM_PATH));
  return actionNotice(t.notices.modeChanged);
}

export async function leaveRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireSessionOr(formData, {
    error: null,
    notice: null,
    ok: false,
  });
  if ("state" in guard) return guard.state;

  await leaveRoom(guard.session.member.id, guard.session.room.id);
  await destroyDeviceCookie();

  redirect(localizedPath(await localeFrom(formData), HOME_PATH));
}

export async function deleteRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireSessionOr(formData, {
    error: null,
    notice: null,
    ok: false,
  });
  if ("state" in guard) return guard.state;

  await deleteRoom(guard.session.room.id, guard.session.member.id);
  await destroyDeviceCookie();

  redirect(localizedPath(await localeFrom(formData), HOME_PATH));
}

// --- answers --------------------------------------------------------------

export async function submitAnswerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireSessionOr(formData, {
    error: null,
    notice: null,
    ok: false,
  });
  if ("state" in guard) return guard.state;

  const { room, member } = guard.session;
  const t = await dictionaryFor(formData);

  const parsed = submitAnswerSchema.safeParse({
    date: field(formData, "date"),
    kind: field(formData, "kind"),
    body: field(formData, "body"),
  });

  if (!parsed.success) return actionError(t.errors.invalidAnswer);

  // The day is UTC today, and it has to be the question this room is actually
  // looking at. No back-filling yesterday, no answering the other variant.
  const today = utcToday();
  if (parsed.data.date !== today) return actionError(t.errors.notToday);

  const expected = resolveQuestionKind(room.question_mode, today);
  if ((parsed.data.kind as QuestionKind) !== expected) {
    return actionError(t.errors.questionChanged);
  }

  const question = await resolveDailyQuestion(expected, today);
  if (!question) return actionError(t.errors.unavailable);

  const outcome = await submitAnswer({
    memberId: member.id,
    date: today,
    kind: expected,
    body: parsed.data.body,
  });

  if (outcome.status === "already-answered") {
    return actionError(t.errors.alreadyAnswered);
  }

  revalidatePath(localizedPath(await localeFrom(formData), ROOM_PATH));
  return actionNotice(t.notices.answerLocked);
}

/**
 * Retracting is a plain form action: no inline validation to report beyond
 * "nothing changed", and a silent no-op is the honest outcome there.
 */
export async function retractAnswerAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const parsed = retractAnswerSchema.safeParse({
    date: field(formData, "date"),
    kind: field(formData, "kind"),
  });

  if (!parsed.success) return;

  await retractAnswer({
    memberId: session.member.id,
    date: parsed.data.date,
    kind: parsed.data.kind as QuestionKind,
  });

  revalidatePath(localizedPath(await localeFrom(formData), ROOM_PATH));
}

// --- flagging ------------------------------------------------------------

/**
 * Marks the day's question as wrong. A plain form action rather than a state-returning one:
 * the re-render shows the new state, so there is nothing to report back, and a reader
 * should be able to register "this is wrong" in one click without being asked why.
 */
export async function flagQuestionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const parsed = flagQuestionSchema.safeParse({
    date: field(formData, "date"),
    kind: field(formData, "kind"),
    note: optionalField(formData, "note"),
  });

  if (!parsed.success) return;

  // The question is deliberately not regenerated: it has already been shown and may already
  // have answers against it. The flag shapes future questions instead.
  await flagQuestion({
    kind: parsed.data.kind as QuestionKind,
    date: parsed.data.date,
    memberId: session.member.id,
    note: parsed.data.note ?? null,
  });

  revalidatePath(localizedPath(await localeFrom(formData), ROOM_PATH));
}

// --- reactions ------------------------------------------------------------

/** Toggling is idempotent enough that a plain form action is the right shape. */
export async function toggleReactionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const parsed = toggleReactionSchema.safeParse({
    answerId: field(formData, "answerId"),
    emoji: field(formData, "emoji"),
  });

  if (!parsed.success) return;

  await toggleReaction({
    answerId: parsed.data.answerId,
    memberId: session.member.id,
    roomId: session.room.id,
    emoji: parsed.data.emoji,
  });

  revalidatePath(localizedPath(await localeFrom(formData), ROOM_PATH));
}
