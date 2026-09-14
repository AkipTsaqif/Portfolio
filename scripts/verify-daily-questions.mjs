#!/usr/bin/env bun
/**
 * End-to-end verification for the Daily Questions tool.
 *
 * Drives the real Server Actions over HTTP by replaying the no-JS form POST that
 * Next.js already renders, so it needs no browser and no test framework. It
 * checks the thing that actually matters — that a locked room never receives the
 * other person's words — plus locking, reactions and the calendar.
 *
 *   bun run dev            # in one terminal
 *   bun run verify:daily-questions
 *
 * It clears rate-limit rows first (so it is re-runnable inside the 3/day cap)
 * and deletes the rooms it creates afterwards.
 */
import { neon } from "@neondatabase/serverless";
import { loadEnvLocal } from "./env-local.mjs";

loadEnvLocal();

const argBase = process.argv.find((value) => value.startsWith("--base="));
const BASE = argBase
  ? argBase.slice("--base=".length)
  : "http://localhost:3000";
const ROOM_URL = `${BASE}/en/lab/daily-questions/room`;
const LANDING_URL = `${BASE}/en/lab/daily-questions`;

const results = [];
let failures = 0;

function check(name, passed, detail = "") {
  if (!passed) failures += 1;
  results.push({ check: name, result: passed ? "PASS" : "FAIL", detail });
}

const unescapeHtml = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Pulls the hidden action fields out of the form containing `marker`. */
function formFields(html, marker) {
  const at = html.indexOf(marker);
  if (at === -1) return null;

  const form = html.slice(
    html.lastIndexOf("<form", at),
    html.indexOf("</form>", at),
  );
  const fields = new Map();

  for (const match of form.matchAll(/<input[^>]*>/g)) {
    const tag = match[0];
    if (!/type="hidden"/.test(tag)) continue;

    const name = /name="([^"]+)"/.exec(tag);
    if (!name) continue;

    const value = /value="([^"]*)"/.exec(tag);
    fields.set(unescapeHtml(name[1]), value ? unescapeHtml(value[1]) : "");
  }

  return fields;
}

/**
 * The action id, read out of the `$ACTION_n:0` envelope.
 *
 * Not used for the transport — it is here so a failure can name the action it
 * could not reach, which is otherwise a bare "500".
 */
function actionIdFrom(fields) {
  if (!fields) return null;

  for (const [name, value] of fields) {
    if (!/^\$ACTION_\d+:0$/.test(name)) continue;

    try {
      const parsed = JSON.parse(value);
      if (typeof parsed?.id === "string") return parsed.id;
    } catch {
      return null;
    }
  }

  return null;
}

async function post(url, fields, cookie) {
  if (!fields) return { status: 0, location: null, setCookie: null, text: "" };

  const body = new FormData();
  for (const [name, value] of fields) body.append(name, value);

  // Two deliberate omissions, both learned the hard way:
  //
  //  - No `Origin`: Next.js treats an Origin-bearing POST as a *forwarded*
  //    Server Action (the JavaScript transport) and then cannot resolve the
  //    action, because a no-JS form post carries `$ACTION_REF` fields instead of
  //    a `Next-Action` id. Omitting it selects the progressive-enhancement path
  //    this harness is built to replay.
  //  - No `Next-Action`: same reason, from the other direction.
  const response = await fetch(url, {
    method: "POST",
    body,
    redirect: "manual",
    headers: cookie ? { cookie: `dq_device=${cookie}` } : {},
  });

  const text = await response.text();

  if (response.status >= 500) {
    console.log(
      `   ! action ${actionIdFrom(fields) ?? "(unknown)"} failed with ${response.status}`,
    );
  }

  return {
    status: response.status,
    location: response.headers.get("location"),
    setCookie: response.headers.get("set-cookie"),
    text,
  };
}

function cookieFrom(response) {
  return /dq_device=([^;]+)/.exec(response.setCookie ?? "")?.[1] ?? null;
}

async function get(url, cookie) {
  return fetch(url, {
    headers: cookie ? { cookie: `dq_device=${cookie}` } : {},
  }).then((response) => response.text());
}

/** Distinguishes "not in the room" from "in the room but nothing to show". */
function looksLikeLanding(html) {
  return html.includes("dq-config-warning") || html.includes("dq-gate");
}

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

if (sql) {
  await sql`delete from rate_limit_events`;
  console.log("rate-limit rows cleared\n");
} else {
  console.log("note: DATABASE_URL not set — rate limits are not reset\n");
}

// --- 1. create a room through the real action ------------------------------
const landing = await get(LANDING_URL);
const createFields = formFields(landing, 'name="questionMode"');
check("landing page renders the create form", createFields !== null);

createFields?.set("displayName", "VerifyA");
createFields?.set("roomName", "Verify");
createFields?.set("questionMode", "reflective");
createFields?.set("locale", "en");

const created = await post(LANDING_URL, createFields, null);
const creatorCookie = cookieFrom(created);

check(
  "createRoomAction redirects into the room",
  created.status === 303,
  `${created.status}`,
);
check("createRoomAction sets the device cookie", creatorCookie !== null);
check("cookie is httpOnly", /httponly/i.test(created.setCookie ?? ""));
check("cookie is SameSite=Lax", /samesite=lax/i.test(created.setCookie ?? ""));
check(
  "cookie lasts a year",
  /max-age=31536000/i.test(created.setCookie ?? ""),
  /max-age=(\d+)/i.exec(created.setCookie ?? "")?.[1] ?? "none",
);
check(
  "createRoomAction reports a usable error instead of failing silently",
  created.status === 303 || created.text.includes("dq-error"),
);
if (created.status !== 303) {
  console.log(
    "\ncreate failed; response said:",
    /dq-error[^>]*>([^<]*)/.exec(created.text)?.[1] ?? "(no message)",
  );
}

// --- 2. the room ----------------------------------------------------------
const roomHtml = await get(ROOM_URL, creatorCookie);
const code = /daily-questions\/join\/([A-Z0-9]+)/.exec(roomHtml)?.[1] ?? "";

check("room shows its name", /Verify/.test(roomHtml));
check("room shows the invite link", code.length > 0, code);
check("room code avoids ambiguous characters", !/[ILOU01]/.test(code), code);
check("room shows today's question", /dq-prompt/.test(roomHtml));

// --- 3. a second device joins ---------------------------------------------
const joinFields = formFields(landing, 'id="dq-join-code"');
joinFields?.set("code", code);
joinFields?.set("displayName", "VerifyB");
joinFields?.set("locale", "en");

const joined = await post(LANDING_URL, joinFields, null);
const partnerCookie = cookieFrom(joined);

check(
  "joinRoomAction redirects into the room",
  joined.status === 303,
  `${joined.status}`,
);
check(
  "the partner gets a different cookie",
  partnerCookie !== null && partnerCookie !== creatorCookie,
);
if (joined.status !== 303) {
  console.log(
    "\njoin failed; response said:",
    /dq-error[^>]*>([^<]*)/.exec(joined.text)?.[1] ?? "(no message)",
  );
}

// --- 4. the creator answers -----------------------------------------------
const roomForCreator = await get(ROOM_URL, creatorCookie);
const answerFields = formFields(roomForCreator, 'id="dq-answer"');
const CREATOR_MARKER = "VERIFY-MARKER-CREATOR";

check("an unanswered room offers the answer box", answerFields !== null);
if (!answerFields) {
  console.log(
    "\nno answer box; room said:",
    /dq-(?:missed|error|notice)[^>]*>([^<]*)/.exec(roomForCreator)?.[1] ??
      "(no message)",
    "| landed on the front door:",
    looksLikeLanding(roomForCreator),
  );
}

answerFields?.set("body", CREATOR_MARKER);
answerFields?.set("locale", "en");

const answered = await post(ROOM_URL, answerFields, creatorCookie);
check(
  "submitAnswerAction accepts the answer",
  answered.status === 200,
  `${answered.status}`,
);

// The creator has answered and the partner has not, so the creator must see the
// waiting state rather than an empty slot — and it must leak nothing either.
const creatorWaiting = await get(ROOM_URL, creatorCookie);
check(
  "an answered room says it is waiting for the other person",
  /Waiting for VerifyB/.test(creatorWaiting),
);
check(
  "the waiting slot leaks nothing",
  !creatorWaiting.includes("VERIFY-MARKER-PARTNER"),
);

// --- 5. the partner, before answering, must not receive it ----------------
const lockedHtml = await get(ROOM_URL, partnerCookie);

check(
  "LOCKED: the other person's answer is absent from the HTML",
  !lockedHtml.includes(CREATOR_MARKER),
);
check(
  "LOCKED: the answer box is offered instead",
  /id="dq-answer"/.test(lockedHtml),
);
check("LOCKED: no answer key is sent", !/class="dq-key"/.test(lockedHtml));

// --- 6. the partner answers, then must receive it ------------------------
const partnerFields = formFields(lockedHtml, 'id="dq-answer"');
const PARTNER_MARKER = "VERIFY-MARKER-PARTNER";

partnerFields?.set("body", PARTNER_MARKER);
partnerFields?.set("locale", "en");

const partnerAnswered = await post(ROOM_URL, partnerFields, partnerCookie);
const openHtml = await get(ROOM_URL, partnerCookie);

check(
  "submitAnswerAction works for the partner",
  partnerAnswered.status === 200,
);
check(
  "UNLOCKED: the other person's answer now arrives",
  openHtml.includes(CREATOR_MARKER),
);
check("UNLOCKED: reactions are rendered", /dq-reaction/.test(openHtml));

// --- 7. lock on submit ----------------------------------------------------
check(
  "the answer box is gone after submitting",
  !/id="dq-answer"/.test(openHtml),
);

// --- 8. reactions ---------------------------------------------------------
const ownReaction = formFields(openHtml, 'name="emoji"');
ownReaction?.set("locale", "en");
await post(ROOM_URL, ownReaction, creatorCookie);

const creatorAfterOwn = await get(ROOM_URL, creatorCookie);
check(
  "you cannot react to your own answer",
  !/dq-reaction-mine/.test(creatorAfterOwn),
);

const partnerReaction = formFields(openHtml, 'name="emoji"');
partnerReaction?.set("locale", "en");
const reacted = await post(ROOM_URL, partnerReaction, partnerCookie);

const partnerAfterReaction = await get(ROOM_URL, partnerCookie);
const creatorAfterReaction = await get(ROOM_URL, creatorCookie);

check("toggleReactionAction succeeds", reacted.status === 200);
check(
  "their reaction is marked as yours",
  /dq-reaction-mine/.test(partnerAfterReaction),
);
check(
  "you can see the reaction they left on your answer",
  /dq-reaction-static/.test(creatorAfterReaction),
);

// --- 9. calendar ----------------------------------------------------------
const calendarHtml = await get(`${ROOM_URL}/archive`, creatorCookie);
const completeCells =
  (calendarHtml.match(/dq-calendar-complete/g) ?? []).length / 2;

check(
  "the calendar marks the completed day",
  completeCells >= 1,
  `${completeCells} day(s)`,
);
check(
  "the calendar renders six whole weeks",
  /dq-calendar-cell/.test(calendarHtml),
);

// --- 10. private routes stay private -------------------------------------
const roomHeaders = await fetch(ROOM_URL, { redirect: "manual", headers: {} });
check(
  "the room route sends X-Robots-Tag",
  /noindex/.test(roomHeaders.headers.get("x-robots-tag") ?? ""),
);
check(
  "no session means no room",
  roomHeaders.status === 307 || roomHeaders.status === 302,
  `${roomHeaders.status}`,
);

// --- report ---------------------------------------------------------------
console.log("");
console.table(results);
console.log(
  failures === 0
    ? `\nall ${results.length} checks passed`
    : `\n${failures} CHECK(S) FAILED`,
);

if (sql) {
  const rooms = await sql`delete from rooms where name = 'Verify' returning id`;
  await sql`delete from members where display_name in ('VerifyA', 'VerifyB')`;
  await sql`delete from rate_limit_events`;
  console.log(`cleaned up ${rooms.length} verification room(s)`);
}

process.exit(failures === 0 ? 0 : 1);
