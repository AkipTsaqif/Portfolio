import "server-only";
import { randomUUID } from "node:crypto";
import { db, firstRow, rows } from "@/lib/db/client";
import type {
  AnswerRow,
  MemberRow,
  QuestionKind,
  ReactionRow,
  RoomMode,
  RoomRow,
} from "@/lib/db/types";

/**
 * Every database read and write for the tool.
 *
 * The one rule this file exists to enforce: **the reveal happens here, not in
 * the browser.** `getDayAnswers` returns other members' text as SQL `NULL`
 * unless the reader has a live answer for that day, so a locked room never
 * ships the words to the client at all.
 */

export type RateLimitKind = "room_create" | "room_join";

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = "23505";

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

// --- rooms and members ----------------------------------------------------

export async function findRoomByCode(code: string): Promise<RoomRow | null> {
  const result = await db()`
    select * from rooms
     where code = ${code} and deleted_at is null
     limit 1
  `;

  return firstRow<RoomRow>(result);
}

export async function findRoomById(id: string): Promise<RoomRow | null> {
  const result = await db()`
    select * from rooms
     where id = ${id} and deleted_at is null
     limit 1
  `;

  return firstRow<RoomRow>(result);
}

export async function findMemberByTokenHash(
  tokenHash: string,
): Promise<MemberRow | null> {
  const result = await db()`
    select * from members
     where token_hash = ${tokenHash} and deleted_at is null
     limit 1
  `;

  return firstRow<MemberRow>(result);
}

export async function listMembers(roomId: string): Promise<MemberRow[]> {
  const result = await db()`
    select * from members
     where room_id = ${roomId} and deleted_at is null
     order by joined_at, id
  `;

  return rows<MemberRow>(result);
}

export class RoomCodeCollision extends Error {}
export class DeviceAlreadyInAnotherRoom extends Error {}
export class DisplayNameTaken extends Error {}

/**
 * Creates a room and its first member.
 *
 * `rooms.code` is globally unique and never reused, so an old invite link can
 * never resolve to a different room later. Retries on the (vanishingly unlikely)
 * collision instead of failing the request.
 */
export async function createRoom(options: {
  memberName: string;
  tokenHash: string;
  questionMode: RoomMode;
  roomName: string | null;
  generateCode: () => string;
  maxAttempts?: number;
}): Promise<{ room: RoomRow; member: MemberRow }> {
  const { memberName, tokenHash, questionMode, roomName } = options;
  const attempts = options.maxAttempts ?? 6;

  const alreadyJoined = await findMemberByTokenHash(tokenHash);
  if (alreadyJoined) throw new DeviceAlreadyInAnotherRoom();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const sql = db();
    const roomId = randomUUID();
    const memberId = randomUUID();
    const code = options.generateCode();

    try {
      const [roomRows, memberRows] = await sql.transaction([
        sql`
          insert into rooms (id, code, name, question_mode, created_by)
          values (${roomId}, ${code}, ${roomName}, ${questionMode}, ${memberId})
          returning *
        `,
        sql`
          insert into members (id, room_id, display_name, token_hash, created_by)
          values (${memberId}, ${roomId}, ${memberName}, ${tokenHash}, ${memberId})
          returning *
        `,
      ]);

      const room = firstRow<RoomRow>(roomRows);
      const member = firstRow<MemberRow>(memberRows);

      if (room && member) return { room, member };
    } catch (error) {
      if (errorCode(error) === UNIQUE_VIOLATION) {
        // Either the code collided (retry) or this device row slipped in.
        const existing = await findMemberByTokenHash(tokenHash);
        if (existing) throw new DeviceAlreadyInAnotherRoom();
        continue;
      }

      throw error;
    }
  }

  throw new RoomCodeCollision("Could not allocate a room code.");
}

/**
 * Joins (or rejoins) a room from a room code.
 *
 * Two paths, both single atomic statements:
 *
 *   - This device already has a member row. If it is for this room, the name is
 *     updated in place, so a new phone does not add a phantom third member. If
 *     it is for another room, the caller is turned away — one device, one room.
 *   - No member row. `ON CONFLICT (room_id, lower(display_name))` rebinds an
 *     existing member of this room to the new device token, which is how you get
 *     back in after clearing cookies. Anyone holding the room code can do this;
 *     the code already grants full read access, so the only thing it adds is
 *     impersonation, and it is the price of having no accounts.
 */
export async function joinRoom(options: {
  room: RoomRow;
  displayName: string;
  tokenHash: string;
}): Promise<MemberRow> {
  const { room, displayName, tokenHash } = options;

  const existing = await findMemberByTokenHash(tokenHash);

  if (existing) {
    if (existing.room_id !== room.id) throw new DeviceAlreadyInAnotherRoom();

    if (existing.display_name === displayName) {
      const touched = await db()`
        update members set last_seen_at = now()
         where id = ${existing.id}
        returning *
      `;

      return firstRow<MemberRow>(touched) ?? existing;
    }

    try {
      const renamed = await db()`
        update members
           set display_name = ${displayName},
               last_seen_at = now(),
               updated_by = ${existing.id}
         where id = ${existing.id}
        returning *
      `;

      return firstRow<MemberRow>(renamed) ?? existing;
    } catch (error) {
      if (errorCode(error) === UNIQUE_VIOLATION) throw new DisplayNameTaken();
      throw error;
    }
  }

  const memberId = randomUUID();

  try {
    const result = await db()`
      insert into members (id, room_id, display_name, token_hash, created_by)
      values (${memberId}, ${room.id}, ${displayName}, ${tokenHash}, ${memberId})
      on conflict (room_id, lower(display_name)) where deleted_at is null
      do update set token_hash = excluded.token_hash,
                    last_seen_at = now(),
                    updated_by = excluded.id
      returning *
    `;

    const member = firstRow<MemberRow>(result);
    if (!member) throw new Error("Join returned no member row.");

    return member;
  } catch (error) {
    if (errorCode(error) === UNIQUE_VIOLATION) throw new DisplayNameTaken();
    throw error;
  }
}

export async function setQuestionMode(
  roomId: string,
  mode: RoomMode,
  memberId: string,
): Promise<RoomRow | null> {
  const result = await db()`
    update rooms
       set question_mode = ${mode}, updated_by = ${memberId}
     where id = ${roomId} and deleted_at is null
    returning *
  `;

  return firstRow<RoomRow>(result);
}

/** Soft delete: the member disappears from room views, their history stays. */
export async function leaveRoom(
  memberId: string,
  roomId: string,
): Promise<void> {
  const sql = db();

  await sql.transaction([
    sql`
      update members
         set deleted_at = now(), deleted_by = ${memberId}
       where id = ${memberId} and room_id = ${roomId} and deleted_at is null
    `,
    sql`
      update reactions
         set deleted_at = now(), deleted_by = ${memberId}
       where member_id = ${memberId} and deleted_at is null
    `,
  ]);
}

export async function deleteRoom(
  roomId: string,
  memberId: string,
): Promise<void> {
  const sql = db();

  await sql.transaction([
    sql`
      update rooms
         set deleted_at = now(), deleted_by = ${memberId}
       where id = ${roomId} and deleted_at is null
    `,
    sql`
      update members
         set deleted_at = now(), deleted_by = ${memberId}
       where room_id = ${roomId} and deleted_at is null
    `,
  ]);
}

// --- answers --------------------------------------------------------------

export type DayEntry = {
  member_id: string;
  display_name: string;
  answer_id: string | null;
  body: string | null;
  created_at: string | null;
};

/**
 * The reveal gate, in SQL.
 *
 * `me.answered` is evaluated first and every other member's `body` and
 * `created_at` are wrapped in a `CASE`, so a locked reader's payload contains
 * `null` — there is no version of this query that fetches the text and hides it
 * downstream.
 */
export async function getDayEntries(options: {
  roomId: string;
  myMemberId: string;
  date: string;
  kind: QuestionKind;
}): Promise<{ meAnswered: boolean; entries: DayEntry[] }> {
  const { roomId, myMemberId, date, kind } = options;

  const result = await db()`
    with me as (
      select exists (
        select 1 from answers
         where member_id = ${myMemberId}
           and question_date = ${date}
           and question_kind = ${kind}
           and deleted_at is null
      ) as answered
    )
    select
      m.id           as member_id,
      m.display_name as display_name,
      case when me.answered then a.id end         as answer_id,
      case when me.answered then a.body end       as body,
      case when me.answered then a.created_at end as created_at,
      me.answered    as me_answered
    from members m
    cross join me
    left join answers a
      on a.member_id = m.id
     and a.question_date = ${date}
     and a.question_kind = ${kind}
     and a.deleted_at is null
    where m.room_id = ${roomId} and m.deleted_at is null
    order by m.joined_at, m.id
  `;

  const list = rows<DayEntry & { me_answered: boolean }>(result);

  return {
    meAnswered: list[0]?.me_answered ?? false,
    entries: list.map((row) => ({
      member_id: row.member_id,
      display_name: row.display_name,
      answer_id: row.answer_id,
      body: row.body,
      created_at: row.created_at,
    })),
  };
}

/** Reactions for the answers of one day, restricted to this room. */
export async function getReactionsForDay(options: {
  roomId: string;
  date: string;
  kind: QuestionKind;
}): Promise<ReactionRow[]> {
  const { roomId, date, kind } = options;

  const result = await db()`
    select r.* from reactions r
      join answers a on a.id = r.answer_id and a.deleted_at is null
      join members m on m.id = a.member_id
     where m.room_id = ${roomId}
       and m.deleted_at is null
       and a.question_date = ${date}
       and a.question_kind = ${kind}
       and r.deleted_at is null
     order by r.created_at
  `;

  return rows<ReactionRow>(result);
}

export type SubmitAnswerOutcome =
  | { status: "created"; answer: AnswerRow }
  | { status: "already-answered"; answer: AnswerRow };

/**
 * Lock on submit: the partial unique index makes a second live answer for the
 * same question impossible, so this doubles as the server-side enforcement of
 * "the answer is final".
 */
export async function submitAnswer(options: {
  memberId: string;
  date: string;
  kind: QuestionKind;
  body: string;
}): Promise<SubmitAnswerOutcome> {
  const { memberId, date, kind, body } = options;
  const answerId = randomUUID();

  const inserted = await db()`
    insert into answers (id, member_id, question_date, question_kind, body, created_by)
    values (${answerId}, ${memberId}, ${date}, ${kind}, ${body}, ${memberId})
    on conflict (member_id, question_date, question_kind) where deleted_at is null
    do nothing
    returning *
  `;

  const created = firstRow<AnswerRow>(inserted);
  if (created) return { status: "created", answer: created };

  const existing = await db()`
    select * from answers
     where member_id = ${memberId}
       and question_date = ${date}
       and question_kind = ${kind}
       and deleted_at is null
     limit 1
  `;

  const answer = firstRow<AnswerRow>(existing);
  if (!answer) throw new Error("Answer vanished between insert and read.");

  return { status: "already-answered", answer };
}

/** Retracting is allowed; editing is not. */
export async function retractAnswer(options: {
  memberId: string;
  date: string;
  kind: QuestionKind;
}): Promise<boolean> {
  const { memberId, date, kind } = options;

  const result = await db()`
    update answers
       set deleted_at = now(), deleted_by = ${memberId}
     where member_id = ${memberId}
       and question_date = ${date}
       and question_kind = ${kind}
       and deleted_at is null
    returning id
  `;

  return firstRow<{ id: string }>(result) !== null;
}

// --- reactions ------------------------------------------------------------

export type ReactionOutcome =
  | { status: "added" }
  | { status: "removed" }
  | { status: "own-answer" }
  | { status: "not-found" };

/**
 * Toggling. The answer must belong to a member of the caller's own room, and
 * reacting to your own answer is refused — the point is the other person's
 * response to yours.
 */
export async function toggleReaction(options: {
  answerId: string;
  memberId: string;
  roomId: string;
  emoji: string;
}): Promise<ReactionOutcome> {
  const { answerId, memberId, roomId, emoji } = options;

  const ownerRows = await db()`
    select a.member_id, m.room_id
      from answers a
      join members m on m.id = a.member_id
     where a.id = ${answerId} and a.deleted_at is null
     limit 1
  `;

  const owner = firstRow<{ member_id: string; room_id: string }>(ownerRows);
  if (!owner || owner.room_id !== roomId) return { status: "not-found" };
  if (owner.member_id === memberId) return { status: "own-answer" };

  const removed = await db()`
    update reactions
       set deleted_at = now(), deleted_by = ${memberId}
     where answer_id = ${answerId}
       and member_id = ${memberId}
       and emoji = ${emoji}
       and deleted_at is null
    returning id
  `;

  if (firstRow<{ id: string }>(removed) !== null) return { status: "removed" };

  await db()`
    insert into reactions (id, answer_id, member_id, emoji, created_by)
    values (${randomUUID()}, ${answerId}, ${memberId}, ${emoji}, ${memberId})
    on conflict (answer_id, member_id, emoji) where deleted_at is null
    do nothing
  `;

  return { status: "added" };
}

// --- calendar and streaks -------------------------------------------------

/** Which members answered on which days, for the archive calendar. */
export async function getAnswerDays(options: {
  roomId: string;
  from: string;
  to: string;
}): Promise<Map<string, Set<string>>> {
  const { roomId, from, to } = options;

  const result = await db()`
    select a.question_date::text as date, a.member_id
      from answers a
      join members m on m.id = a.member_id
     where m.room_id = ${roomId}
       and m.deleted_at is null
       and a.deleted_at is null
       and a.question_date between ${from} and ${to}
  `;

  const byDate = new Map<string, Set<string>>();

  for (const row of rows<{ date: string; member_id: string }>(result)) {
    const set = byDate.get(row.date) ?? new Set<string>();
    set.add(row.member_id);
    byDate.set(row.date, set);
  }

  return byDate;
}

/** Whether this member has a live push subscription, for the toggle's initial state. */
export async function hasPushSubscription(memberId: string): Promise<boolean> {
  const result = await db()`
    select id from push_subscriptions
     where member_id = ${memberId} and deleted_at is null
     limit 1
  `;

  return firstRow<{ id: string }>(result) !== null;
}

/** Every date a member answered, for streak math. */
export async function getMemberAnswerDates(
  memberId: string,
  limit = 400,
): Promise<string[]> {
  const result = await db()`
    select question_date::text as date from answers
     where member_id = ${memberId} and deleted_at is null
     order by question_date desc
     limit ${limit}
  `;

  return rows<{ date: string }>(result).map((row) => row.date);
}

// --- rate limiting --------------------------------------------------------

export async function countRecentEvents(options: {
  kind: RateLimitKind;
  ipHash: string;
  windowSeconds: number;
}): Promise<number> {
  const { kind, ipHash, windowSeconds } = options;

  const result = await db()`
    select count(*)::int as count from rate_limit_events
     where kind = ${kind}
       and ip_hash = ${ipHash}
       and created_at > now() - make_interval(secs => ${windowSeconds}::double precision)
  `;

  return firstRow<{ count: number }>(result)?.count ?? 0;
}

export async function recordEvent(options: {
  kind: RateLimitKind;
  ipHash: string;
  memberId: string | null;
}): Promise<void> {
  const { kind, ipHash, memberId } = options;

  await db()`
    insert into rate_limit_events (kind, ip_hash, created_by)
    values (${kind}, ${ipHash}, ${memberId})
  `;
}
