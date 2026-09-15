import "server-only";
import webpush from "web-push";
import { db, firstRow, rows } from "@/lib/db/client";
import type { PushSubscriptionRow, QuestionKind } from "@/lib/db/types";
import { getVapid } from "./env";
import { utcToday } from "./utc-day";

/**
 * Web push: the nudge that keeps a daily ritual from quietly dying.
 *
 * Two decisions worth knowing about.
 *
 * **The payload carries no question text.** Notifications travel through the browser
 * vendor's push service — Google's or Mozilla's — so putting the question in the body
 * would hand a third party the content of a tool whose entire design keeps content on
 * the server until the reader has earned it. The body says only that the day's question
 * is ready, and the reader follows the link to read it.
 *
 * **Sending is event-driven, never scheduled.** The trigger is the question being
 * published or a partner answering. A "it is 07:00" nudge would need a scheduler, and
 * this tool deliberately has none; the accepted consequence is that a day nobody opens
 * the page produces no nudge. See `prewarm.ts` for the same trade behind generation.
 */

let vapidApplied = false;

/** Configures the library once per process. Returns false when push is unavailable. */
function ready(): boolean {
  const vapid = getVapid();
  if (!vapid) return false;

  if (!vapidApplied) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    vapidApplied = true;
  }

  return true;
}

export function isPushConfigured(): boolean {
  return getVapid() !== null;
}

/** The browser's public key, for the client that has to subscribe. */
export function getVapidPublicKey(): string | null {
  return getVapid()?.publicKey ?? null;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Absolute or root-relative path the notification opens. */
  url: string;
};

/**
 * Stores a subscription. Idempotent on the endpoint, because re-subscribing on the same
 * browser returns the same one — and reassigns it, in case a different member is now
 * signed in on that browser.
 */
export async function saveSubscription(options: {
  memberId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}): Promise<void> {
  const { memberId, endpoint, p256dh, auth, userAgent } = options;

  await db()`
    insert into push_subscriptions
      (member_id, endpoint, p256dh, auth, user_agent, created_by)
    values
      (${memberId}, ${endpoint}, ${p256dh}, ${auth}, ${userAgent}, ${memberId})
    on conflict (endpoint) where deleted_at is null
    do update set member_id = excluded.member_id,
                  p256dh = excluded.p256dh,
                  auth = excluded.auth,
                  user_agent = excluded.user_agent,
                  updated_by = excluded.member_id,
                  deleted_at = null
  `;
}

export async function removeSubscription(options: {
  memberId: string;
  endpoint: string;
}): Promise<void> {
  const { memberId, endpoint } = options;

  await db()`
    update push_subscriptions
       set deleted_at = now(), deleted_by = ${memberId}
     where endpoint = ${endpoint}
       and member_id = ${memberId}
       and deleted_at is null
  `;
}

/** Every live subscription. The question is global, so the "ready" nudge is too. */
async function allSubscriptions(): Promise<PushSubscriptionRow[]> {
  const result = await db()`
    select * from push_subscriptions where deleted_at is null
  `;

  return rows<PushSubscriptionRow>(result);
}

/** Subscriptions belonging to one room, excluding whoever caused the notification. */
async function roomSubscriptions(
  roomId: string,
  exceptMemberId: string,
): Promise<PushSubscriptionRow[]> {
  const result = await db()`
    select s.* from push_subscriptions s
      join members m on m.id = s.member_id
     where m.room_id = ${roomId}
       and m.deleted_at is null
       and s.deleted_at is null
       and s.member_id <> ${exceptMemberId}
  `;

  return rows<PushSubscriptionRow>(result);
}

/**
 * Sends to each subscription and prunes the ones the push service reports as gone.
 *
 * A 404 or 410 is the documented "this endpoint no longer exists" answer — a browser
 * uninstalled, a permission revoked, or a profile wiped. Those are soft-deleted rather
 * than retried forever. Everything else is counted and ignored: a failed nudge is not
 * worth surfacing to whoever happens to be loading a page.
 */
async function deliver(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; gone: number; failed: number }> {
  const body = JSON.stringify(payload);
  let sent = 0;
  let gone = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;

        if (status === 404 || status === 410) {
          gone += 1;
          await db()`
            update push_subscriptions
               set deleted_at = now(), deleted_by = member_id
             where id = ${subscription.id}
          `;
        } else {
          failed += 1;
        }
      }
    }),
  );

  return { sent, gone, failed };
}

/**
 * Claims the right to send today's nudge, exactly once.
 *
 * The guard is the conditional `UPDATE` on `notified_at`: the first caller matches and
 * gets a row back, everyone else matches nothing and stays quiet. That matters because
 * the nudge is triggered from a *page render* — the first visitor of the day wins the
 * claim, and the second visitor a second later does not send a duplicate.
 *
 * Returns null when there is nothing to announce, or when someone already has.
 */
async function claimQuestionReady(
  kind: QuestionKind,
  date: string,
): Promise<boolean> {
  const result = await db()`
    update daily_questions
       set notified_at = now()
     where date = ${date}
       and kind = ${kind}
       and status = 'ready'
       and notified_at is null
       and deleted_at is null
    returning date
  `;

  // deliberately does not read the prompt: the payload never carries question text
  return firstRow<{ date: string }>(result) !== null;
}

export type NotifyResult = {
  sent: number;
  gone: number;
  failed: number;
} | null;

/**
 * Announces that the day's question is ready — but only for **today**.
 *
 * The gate is not decoration: pre-generation builds *tomorrow's* question during a visit
 * today, and without this check that would push "today's question is ready" a day early,
 * for a question nobody can answer yet.
 */
export async function notifyQuestionReady(options: {
  kind: QuestionKind;
  date: string;
  siteUrl: string;
}): Promise<NotifyResult> {
  const { kind, date, siteUrl } = options;

  if (date !== utcToday()) return null;
  if (!ready()) return null;

  // Gather before claiming. If nobody has subscribed yet, the day's one slot stays
  // unclaimed — otherwise someone who switches nudges on later the same day would never
  // hear about a question they have not answered.
  const subscriptions = await allSubscriptions();
  if (subscriptions.length === 0) return null;

  if (!(await claimQuestionReady(kind, date))) return null;

  const result = await deliver(subscriptions, {
    title: "Today's question is ready",
    body: "Answer it before you read anyone else's.",
    url: `${siteUrl}/lab/daily-questions/room`,
  });

  console.info(
    `[daily-questions] nudge for ${date}/${kind}: ${result.sent} sent, ${result.gone} expired, ${result.failed} failed`,
  );

  return result;
}

/** Tells a room that someone else has answered — the other half of the ritual. */
export async function notifyAnswerSubmitted(options: {
  roomId: string;
  memberId: string;
  memberName: string;
  kind: QuestionKind;
  date: string;
  siteUrl: string;
}): Promise<NotifyResult> {
  const { roomId, memberId, memberName, kind, date, siteUrl } = options;

  if (date !== utcToday()) return null;
  if (!ready()) return null;

  const subscriptions = await roomSubscriptions(roomId, memberId);
  if (subscriptions.length === 0) return null;

  const result = await deliver(subscriptions, {
    title: `${memberName} answered`,
    body:
      kind === "knowledge"
        ? "Write yours to see their answer."
        : "Write yours to read what they said.",
    url: `${siteUrl}/lab/daily-questions/room`,
  });

  console.info(
    `[daily-questions] answer nudge for ${date}/${kind}: ${result.sent} sent, ${result.gone} expired, ${result.failed} failed`,
  );

  return result;
}
