/**
 * Row shapes for the Daily Questions tables.
 *
 * Hand-written, mirroring `src/lib/sanity/types.ts`. No ORM, no generated types.
 * Column names match `src/lib/db/schema.sql` exactly so query results can be
 * cast straight onto these types.
 */

export type QuestionKind = "knowledge" | "reflective";
export type QuestionStatus = "pending" | "ready";
export type QuestionSource = "pending" | "omniroute" | "fallback";
export type Difficulty = "easy" | "medium" | "hard";
export type RoomMode = "mixed" | "knowledge" | "reflective";

export type DailyQuestionRow = {
  date: string;
  kind: QuestionKind;
  status: QuestionStatus;
  pending_since: string;
  prompt_en: string | null;
  prompt_id: string | null;
  answer_en: string | null;
  answer_id: string | null;
  category: string | null;
  difficulty: Difficulty | null;
  source: QuestionSource;
  model: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type RoomRow = {
  id: string;
  code: string;
  name: string | null;
  question_mode: RoomMode;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type MemberRow = {
  id: string;
  room_id: string;
  display_name: string;
  token_hash: string;
  joined_at: string;
  last_seen_at: string;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type AnswerRow = {
  id: string;
  member_id: string;
  question_date: string;
  question_kind: QuestionKind;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type ReactionRow = {
  id: string;
  answer_id: string;
  member_id: string;
  emoji: string;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_by: string | null;
  deleted_at: string | null;
};
