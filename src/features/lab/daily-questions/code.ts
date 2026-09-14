import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ROOM_CODE_LENGTH } from "./types";

/**
 * Credential generation. Pure apart from `node:crypto` randomness; no env reads,
 * so it is directly testable.
 *
 * This is the entire authentication model:
 *   - a room code is the invite secret (~59 bits),
 *   - a device token is the session secret (256 bits, stored only as a hash).
 */

/**
 * 30 symbols, deliberately missing I, L, O, U, 0 and 1 so a code read off a
 * phone screen or written down cannot be mistyped into a different valid code.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const CODE_CHARACTERS = new Set(CODE_ALPHABET);

/**
 * The largest multiple of 30 that fits in a byte. Bytes at or above it are
 * discarded rather than folded with `% 30`, which would bias the first 16
 * symbols. (At 256/30 the bias is tiny, but rejecting is free.)
 */
const REJECTION_LIMIT =
  Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;

/** ~59 bits of entropy at the default length. */
export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  if (!Number.isInteger(length) || length < 8) {
    throw new Error("Room codes must be at least 8 characters.");
  }

  let code = "";

  while (code.length < length) {
    // 2× headroom: ~6 bytes of waste per 5 rejected draws is irrelevant here
    for (const byte of randomBytes(length * 2)) {
      if (byte >= REJECTION_LIMIT) continue;

      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === length) break;
    }
  }

  return code;
}

/**
 * Accepts what a human actually types — lowercase, spaces, dashes, a pasted
 * share link — and returns the canonical code, or `""` if nothing usable is
 * left. Anything outside the alphabet is dropped.
 */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((character) => CODE_CHARACTERS.has(character))
    .join("");
}

/** `ABCD-EFGH-JKMN`, for reading aloud and for display. */
export function formatRoomCode(code: string, groupSize = 4): string {
  const groups = code.match(new RegExp(`.{1,${groupSize}}`, "g"));
  return groups ? groups.join("-") : code;
}

/** A share link's code: the last path segment, normalised. */
export function roomCodeFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return normalizeRoomCode(segments[segments.length - 1] ?? "");
}

/** 32 random bytes, base64url — 43 characters, no padding, URL-safe. */
export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What goes in the database. The raw token never leaves the cookie. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * IPs are hashed with a server-side salt before storage, because a bare SHA-256
 * of an IPv4 address is trivially reversible by brute force.
 */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Constant-time compare, for anywhere a code is checked in application code. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
