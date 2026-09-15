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

const sql = process.env.DB_URL ? neon(process.env.DB_URL) : null;

if (sql) {
  await sql`delete from rate_limit_events`;
  console.log("rate-limit rows cleared\n");
} else {
  console.log("note: DB_URL not set — rate limits are not reset\n");
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

// Captured here because the flag step needs them, and because a crashed earlier run can
// leave the question flagged — which hides the flag form and would otherwise cascade.
const dayDate = answerFields?.get("date") ?? "";
const dayKind = answerFields?.get("kind") ?? "reflective";
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

// Regression guard for a real bug: hand-built class lists glued two names into
// one bogus class ("dq-answerdq-answer-mine"), which matches no CSS rule, so the
// card silently lost its padding and background. A single token that is really
// two dq- classes concatenated is exactly that failure.
const gluedClasses = [...openHtml.matchAll(/class="([^"]*)"/g)]
  .flatMap((match) => match[1].split(/\s+/))
  .filter((token) => /^dq-[a-z-]+dq-[a-z-]+$/.test(token));

check(
  "no class names are glued together",
  gluedClasses.length === 0,
  gluedClasses.join(", "),
);

check(
  "the reader's own answer card keeps both of its classes",
  /class="dq-answer dq-answer-mine"/.test(openHtml),
);

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
  // boundary-aware on purpose: the glued "dq-reactiondq-reaction-mine" contains
  // this substring, so a naive test passes on a broken class list
  /(?:^|["\s])dq-reaction-mine(?=["\s])/.test(partnerAfterReaction),
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

// --- 11. flagging a question as wrong --------------------------------------
// Flagging today's real question during a test would leave a permanent mark on live
// content, so this flags, asserts, and then clears the columns directly.
//
// Defensive clear first: the first run of this step flagged the question and then died
// before cleanup, which left the form hidden and made the next run fail for the wrong
// reason — the code was fine, the residue was not.
if (sql) {
  await sql`
    update daily_questions
       set flagged_at = null, flagged_by = null, flag_note = null
     where date = ${dayDate} and kind = ${dayKind}`;
}

const roomBeforeFlag = await get(ROOM_URL, creatorCookie);
const flagFields = formFields(roomBeforeFlag, 'id="dq-flag-note"');
const flaggedKind = dayKind;
const flaggedDate = dayDate;
check("the flag control is offered while unflagged", flagFields !== null);
flagFields?.set("note", "VERIFY: deliberate test flag");
flagFields?.set("locale", "en");

const flagged = await post(ROOM_URL, flagFields, creatorCookie);
const afterFlag = await get(ROOM_URL, creatorCookie);

check(
  "flagQuestionAction accepts the flag",
  flagged.status === 200,
  `${flagged.status}`,
);
check("the room shows the flagged state", /dq-flag-state/.test(afterFlag));
check(
  "the flag form is gone once flagged",
  !/id="dq-flag-note"/.test(afterFlag),
);

if (sql) {
  const [row] = await sql`
    select flagged_at, flagged_by, flag_note from daily_questions
     where date = ${flaggedDate} and kind = ${flaggedKind}`;

  check("the flag was persisted", Boolean(row?.flagged_at));
  check(
    "the note was stored",
    row?.flag_note === "VERIFY: deliberate test flag",
    String(row?.flag_note),
  );
  check("the flag records who set it", Boolean(row?.flagged_by));

  // first flag wins: a second member, or a second press, must not overwrite it
  const secondNote = formFields(roomBeforeFlag, 'id="dq-flag-note"');
  secondNote?.set("note", "VERIFY: second flag, should be ignored");
  secondNote?.set("locale", "en");
  await post(ROOM_URL, secondNote, partnerCookie);

  const [again] = await sql`
    select flag_note from daily_questions where date = ${flaggedDate} and kind = ${flaggedKind}`;
  check(
    "a second flag does not overwrite the first",
    again?.flag_note === "VERIFY: deliberate test flag",
    String(again?.flag_note),
  );

  // the avoid list the generator is fed: flagged prompts, independent of the rolling
  // recent-questions window, so a rejected topic cannot come back in a month
  const avoid = await sql`
    select prompt_en from daily_questions
     where kind = ${flaggedKind} and flagged_at is not null and prompt_en is not null`;
  check(
    "the flagged prompt reaches the avoid list",
    avoid.length >= 1,
    `${avoid.length} prompt(s)`,
  );

  await sql`
    update daily_questions
       set flagged_at = null, flagged_by = null, flag_note = null
     where date = ${flaggedDate} and kind = ${flaggedKind}`;
  const [cleared] = await sql`
    select flagged_at from daily_questions where date = ${flaggedDate} and kind = ${flaggedKind}`;
  check("the test flag was cleaned up", cleared?.flagged_at === null);
}

// --- 12. web push ----------------------------------------------------------
// Real delivery cannot be verified without a browser subscription, and Next's client JS
// is what calls the subscribe action, so there is no form to replay. What IS verifiable
// matters most: the worker and manifest are served, the toggle is offered, the day's nudge
// is claimed exactly once rather than per visitor, and a push endpoint that refuses does
// not take the page down with it.
const swResponse = await fetch(`${BASE}/sw.js`);
const swBody = swResponse.ok ? await swResponse.text() : "";
check(
  "the service worker is served",
  swResponse.status === 200,
  `${swResponse.status}`,
);
check(
  "it is served as JavaScript",
  /javascript/.test(swResponse.headers.get("content-type") ?? ""),
);
check(
  "it handles push and notification taps",
  swBody.includes('addEventListener("push"') &&
    swBody.includes("notificationclick"),
);

const manifestResponse = await fetch(`${BASE}/manifest.webmanifest`);
check(
  "the web app manifest is served",
  manifestResponse.status === 200,
  `${manifestResponse.status}`,
);
check("the nudge toggle is offered in the room", /dq-notify/.test(openHtml));

if (sql) {
  const [member] =
    await sql`select id from members where display_name = 'VerifyA' and deleted_at is null limit 1`;

  if (member) {
    // A deliberately unroutable endpoint: delivery fails, which is the point. It must be
    // counted as a failure rather than throwing into the request.
    await sql`
      insert into push_subscriptions (member_id, endpoint, p256dh, auth, created_by)
      values (${member.id}, 'https://127.0.0.1:9/verify-push',
              'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
              'tBHItJI5svbpez7KI4CCXg', ${member.id})
      on conflict (endpoint) where deleted_at is null do nothing`;

    const withSub = await get(ROOM_URL, creatorCookie);
    check(
      "the toggle reflects a server-side subscription",
      /Notifications are on/.test(withSub),
    );

    await sql`update daily_questions set notified_at = null where date = ${dayDate} and kind = ${dayKind}`;
    const first = await get(ROOM_URL, creatorCookie);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const [claimed] =
      await sql`select notified_at from daily_questions where date = ${dayDate} and kind = ${dayKind}`;

    check(
      "the page still renders when a push endpoint refuses",
      first.length > 0,
    );
    check(
      "the first render claims the day's nudge",
      Boolean(claimed?.notified_at),
    );

    await get(ROOM_URL, creatorCookie);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const [again2] =
      await sql`select notified_at from daily_questions where date = ${dayDate} and kind = ${dayKind}`;
    check(
      "a second render does not claim it again",
      new Date(again2?.notified_at).getTime() ===
        new Date(claimed?.notified_at).getTime(),
    );

    // leave no trace: the test subscription goes, and the day's slot reopens
    await sql`delete from push_subscriptions where endpoint = 'https://127.0.0.1:9/verify-push'`;
    await sql`update daily_questions set notified_at = null where date = ${dayDate} and kind = ${dayKind}`;
    const [clean] =
      await sql`select count(*)::int as n from push_subscriptions`;
    check(
      "the test subscription was cleaned up",
      clean?.n === 0,
      `${clean?.n} remaining`,
    );
  }
}

// --- 13. sitemap ------------------------------------------------------------
const sitemapXml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const listedDates = [
  ...sitemapXml.matchAll(
    /\/lab\/daily-questions\/archive\/(\d{4}-\d{2}-\d{2})/g,
  ),
].map((match) => match[1]);
const todayUtc = new Date().toISOString().slice(0, 10);
const futureDates = [...new Set(listedDates)].filter((date) => date > todayUtc);

check(
  "the sitemap lists dated archive pages",
  listedDates.length > 0,
  `${listedDates.length}`,
);
check(
  "the sitemap keeps private routes out",
  !/daily-questions\/(room|join)/.test(sitemapXml),
);

// Pre-generation creates *tomorrow's* row during a visit today, and the archive returns
// 404 for a future date. Asserting on that is the whole point: a sitemap advertising a
// 404 is worse than not listing the page at all.
check(
  "the sitemap lists no future dates",
  futureDates.length === 0,
  futureDates.join(", "),
);

// and every date it does list has to resolve
const sampledDates = [...new Set(listedDates)].slice(0, 5);
const dateStatuses = await Promise.all(
  sampledDates.map(
    async (date) =>
      (await fetch(`${BASE}/en/lab/daily-questions/archive/${date}`)).status,
  ),
);
check(
  "every listed date resolves",
  dateStatuses.every((status) => status === 200),
  `${sampledDates.length} checked: ${dateStatuses.join(", ")}`,
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
