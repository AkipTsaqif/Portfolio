import "server-only";
import { cookies, headers } from "next/headers";
import type { MemberRow, RoomRow } from "@/lib/db/types";
import { hashIp, hashToken } from "./code";
import { getRateLimitSalt } from "./env";
import { findMemberByTokenHash, findRoomById } from "./room";

/**
 * Sessions are a long-lived httpOnly cookie holding one opaque device token.
 * There are no accounts, no email addresses and no PII: the token is the whole
 * identity, and the database only ever sees its SHA-256.
 *
 * Reading cookies is fine during a render. *Writing* them is not — Next.js only
 * allows `cookies().set()` inside a Server Action or Route Handler, so joining,
 * creating and leaving all go through actions.
 */

export const DEVICE_COOKIE = "dq_device";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Session = { member: MemberRow; room: RoomRow };

export async function readDeviceToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(DEVICE_COOKIE)?.value;
  return value && value.length > 0 ? value : null;
}

export async function writeDeviceCookie(token: string): Promise<void> {
  const store = await cookies();

  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroyDeviceCookie(): Promise<void> {
  const store = await cookies();
  store.set(DEVICE_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * Resolves the session, or `null`.
 *
 * A cookie that no longer matches a live member resolves to `null` rather than
 * throwing: it is inert, the landing page simply shows the create/join form
 * again, and the next join overwrites it. Nothing here writes a cookie, because
 * this runs during render.
 */
export async function getSession(): Promise<Session | null> {
  const token = await readDeviceToken();
  if (!token) return null;

  const member = await findMemberByTokenHash(hashToken(token));
  if (!member) return null;

  const room = await findRoomById(member.room_id);
  if (!room) return null;

  return { member, room };
}

/**
 * A hashed client address, for throttling. Stored only as
 * `sha256(salt + ip)` so the table holds nothing recoverable.
 *
 * `x-forwarded-for` is trusted because this app is always behind a platform
 * proxy; the left-most entry is the client.
 */
export async function getRequestIpHash(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const address =
    forwarded?.split(",")[0]?.trim() ||
    store.get("x-real-ip")?.trim() ||
    "unknown";

  return hashIp(address, getRateLimitSalt());
}
