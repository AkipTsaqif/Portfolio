-- Schema for the Lab "Daily Questions" tool.
-- Applied with: bun run db:migrate
--
-- STATEMENT SEPARATOR
-- Statements are separated by a line containing only `-- @@`.
-- The Neon HTTP driver sends one statement per request (the extended query
-- protocol rejects multi-statement strings), and the plpgsql bodies below
-- contain semicolons that a naive `;` split would break.
--
-- AUDIT COLUMNS
-- Every table carries created_by / created_at / updated_by / updated_at /
-- deleted_by / deleted_at. The `*_by` columns are deliberately loose `uuid`s
-- with no foreign key: an audit record must survive deletion of the member it
-- points at. Rows are soft-deleted (`deleted_at`), never hard-deleted.
--
-- Every statement here is idempotent.

create or replace function dq_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- @@

create table if not exists daily_questions (
  date          date        not null,
  kind          text        not null check (kind in ('knowledge', 'reflective')),
  status        text        not null default 'pending'
                check (status in ('pending', 'ready')),
  -- a crashed generator would otherwise wedge the day forever; another request
  -- may reclaim a pending row older than the staleness window
  pending_since timestamptz not null default now(),
  prompt_en     text,
  prompt_id     text,
  -- verified answer + explanation, revealed after you answer. never used for
  -- reflective questions.
  answer_en     text,
  answer_id     text,
  category      text,
  difficulty    text check (difficulty in ('easy', 'medium', 'hard')),
  source        text        not null default 'pending'
                check (source in ('pending', 'omniroute', 'fallback')),
  model         text,
  -- a reader said this question was wrong. Kept permanently and fed back into generation
  -- as a topic to avoid, so one bad question does not recur a month later when it would
  -- otherwise have aged out of the recent-questions window.
  flagged_at    timestamptz,
  flagged_by    uuid,
  flag_note     text check (flag_note is null or char_length(flag_note) <= 280),
  -- when the "today's question is ready" nudge went out, so it goes out exactly once
  notified_at   timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  deleted_by    uuid,
  deleted_at    timestamptz,
  primary key (date, kind),
  constraint daily_questions_ready_is_complete check (
    status <> 'ready'
    or (prompt_en is not null and prompt_id is not null)
  ),
  -- a published knowledge question without an answer key is not publishable
  constraint daily_questions_knowledge_has_answer check (
    status <> 'ready'
    or kind <> 'knowledge'
    or (answer_en is not null and answer_id is not null)
  )
);

-- @@

-- Columns added after the table shipped. `create table if not exists` above does nothing
-- to an existing table, so each addition needs its own idempotent statement.
alter table daily_questions
  add column if not exists flagged_at timestamptz;

-- @@

alter table daily_questions
  add column if not exists flagged_by uuid;

-- @@

alter table daily_questions
  add column if not exists flag_note text
  check (flag_note is null or char_length(flag_note) <= 280);

-- @@

alter table daily_questions
  add column if not exists notified_at timestamptz;

-- @@

-- flagged prompts are read on every generation, so keep them cheap to find
create index if not exists daily_questions_flagged_idx
  on daily_questions (kind, date desc)
  where flagged_at is not null;

-- @@

create table if not exists rooms (
  id            uuid primary key default gen_random_uuid(),
  -- global, never reused: an old invite link must never resolve to a new room
  code          text not null unique,
  name          text check (name is null or char_length(name) <= 60),
  question_mode text not null default 'mixed'
                check (question_mode in ('mixed', 'knowledge', 'reflective')),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  deleted_by    uuid,
  deleted_at    timestamptz
);

-- @@

create table if not exists members (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  -- sha256 hex of the device token. the raw token exists only in the httpOnly
  -- cookie, so a database dump yields no usable sessions.
  token_hash   text not null,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  deleted_by   uuid,
  deleted_at   timestamptz
);

-- @@

-- one device token resolves to exactly one member, therefore one room
create unique index if not exists members_token_hash_key
  on members (token_hash);

-- @@

-- indexed by lower(display_name) so rejoin-by-name is a single atomic upsert.
-- partial so a member who left frees their name.
create unique index if not exists members_room_name_key
  on members (room_id, lower(display_name))
  where deleted_at is null;

-- @@

create index if not exists members_room_idx
  on members (room_id, joined_at)
  where deleted_at is null;

-- @@

-- One row per browser that agreed to be nudged. A push subscription is an opaque
-- endpoint plus two keys — no third party, no email, nothing that identifies a person
-- beyond the member it belongs to, which is the same privacy stance as the rest of the
-- tool. The private VAPID key never reaches here.
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  deleted_by uuid,
  deleted_at timestamptz
);

-- @@

-- the endpoint is the browser's identity: re-subscribing on the same browser returns the
-- same one, so this is what makes subscribing idempotent
create unique index if not exists push_subscriptions_endpoint_key
  on push_subscriptions (endpoint)
  where deleted_at is null;

-- @@

create index if not exists push_subscriptions_member_idx
  on push_subscriptions (member_id)
  where deleted_at is null;

-- @@

create table if not exists answers (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references members(id) on delete cascade,
  question_date date not null,
  question_kind text not null check (question_kind in ('knowledge', 'reflective')),
  body          text not null check (char_length(body) between 1 and 2000),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  deleted_by    uuid,
  deleted_at    timestamptz
);

-- @@

-- "lock on submit": at most one live answer per member per question.
-- partial, so retracting and answering again is possible.
create unique index if not exists answers_member_question_key
  on answers (member_id, question_date, question_kind)
  where deleted_at is null;

-- @@

create index if not exists answers_member_date_idx
  on answers (member_id, question_date desc)
  where deleted_at is null;

-- @@

create index if not exists answers_lookup_idx
  on answers (question_date, question_kind)
  where deleted_at is null;

-- @@

create table if not exists reactions (
  id         uuid primary key default gen_random_uuid(),
  answer_id  uuid not null references answers(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  emoji      text not null check (char_length(emoji) <= 8),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  deleted_by uuid,
  deleted_at timestamptz
);

-- @@

create unique index if not exists reactions_member_emoji_key
  on reactions (answer_id, member_id, emoji)
  where deleted_at is null;

-- @@

-- per-IP throttling. ip_hash is sha256(ip + RATE_LIMIT_SALT) so the table holds
-- no recoverable addresses.
create table if not exists rate_limit_events (
  id         bigserial primary key,
  kind       text not null check (kind in ('room_create', 'room_join')),
  ip_hash    text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  deleted_by uuid,
  deleted_at timestamptz
);

-- @@

create index if not exists rate_limit_events_lookup_idx
  on rate_limit_events (kind, ip_hash, created_at desc);

-- @@

drop trigger if exists daily_questions_touch on daily_questions;

-- @@

create trigger daily_questions_touch before update on daily_questions
  for each row execute function dq_touch_updated_at();

-- @@

drop trigger if exists rooms_touch on rooms;

-- @@

create trigger rooms_touch before update on rooms
  for each row execute function dq_touch_updated_at();

-- @@

drop trigger if exists members_touch on members;

-- @@

create trigger members_touch before update on members
  for each row execute function dq_touch_updated_at();

-- @@

drop trigger if exists answers_touch on answers;

-- @@

create trigger answers_touch before update on answers
  for each row execute function dq_touch_updated_at();

-- @@

drop trigger if exists reactions_touch on reactions;

-- @@

create trigger reactions_touch before update on reactions
  for each row execute function dq_touch_updated_at();

-- @@

drop trigger if exists rate_limit_events_touch on rate_limit_events;

-- @@

create trigger rate_limit_events_touch before update on rate_limit_events
  for each row execute function dq_touch_updated_at();

-- @@

drop trigger if exists push_subscriptions_touch on push_subscriptions;

-- @@

create trigger push_subscriptions_touch before update on push_subscriptions
  for each row execute function dq_touch_updated_at();
