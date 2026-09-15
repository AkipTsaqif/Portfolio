import { z } from "zod";
import {
  MAX_ANSWER_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_ROOM_NAME_LENGTH,
  REACTION_EMOJIS,
  ROOM_MODES,
  type QuestionKind,
} from "./types";
import { isDateString } from "./utc-day";

/**
 * Every trust boundary in this feature is a zod schema: the payload the model
 * returns, and every Server Action argument. Nothing reaches the database
 * unvalidated, and no action ever accepts a member id from the client.
 */

export const dateStringSchema = z
  .string()
  .refine(isDateString, { message: "Expected a YYYY-MM-DD calendar date." });

export const questionKindSchema = z.enum(["knowledge", "reflective"]);

export const roomModeSchema = z.enum(["mixed", "knowledge", "reflective"]);

/** Guards against a stale client sending a mode we no longer support. */
export const ROOM_MODE_VALUES: readonly string[] = ROOM_MODES;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidSchema = z
  .string()
  .refine((value) => UUID_PATTERN.test(value), { message: "Expected a UUID." });

/**
 * What the model is asked to return. Both locales in one call.
 *
 * Bounds are generous but real: they stop a runaway completion from reaching
 * the database, and they are enforced by matching CHECK constraints in
 * `src/lib/db/schema.sql`.
 */
export const generatedQuestionSchema = z.object({
  prompt: z.object({
    en: z.string().trim().min(8).max(300),
    id: z.string().trim().min(8).max(300),
  }),
  category: z.string().trim().min(2).max(40).nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  answer: z
    .object({
      en: z.string().trim().min(20).max(900),
      id: z.string().trim().min(20).max(900),
    })
    .nullable(),
});

export type GeneratedQuestionInput = z.infer<typeof generatedQuestionSchema>;

/**
 * The per-kind contract. A knowledge question without an answer key is not
 * publishable (the reveal has nothing to reveal); a reflective question with one
 * would imply a right answer, which is the thing reflective questions are for
 * avoiding.
 */
export function generatedQuestionSchemaFor(kind: QuestionKind) {
  return generatedQuestionSchema.superRefine((value, ctx) => {
    if (kind === "knowledge") {
      if (!value.answer) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message:
            "A knowledge question must include a verified answer with a short explanation.",
        });
      }
      if (!value.category) {
        ctx.addIssue({
          code: "custom",
          path: ["category"],
          message: "A knowledge question must include a category.",
        });
      }
      if (!value.difficulty) {
        ctx.addIssue({
          code: "custom",
          path: ["difficulty"],
          message: "A knowledge question must include a difficulty.",
        });
      }
      return;
    }

    if (value.answer) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "A reflective question must not include an answer.",
      });
    }
  });
}

// --- Server Action inputs -------------------------------------------------

export const createRoomSchema = z.object({
  roomName: z.string().trim().max(MAX_ROOM_NAME_LENGTH).optional(),
  questionMode: roomModeSchema.default("mixed"),
});

export const joinRoomSchema = z.object({
  code: z.string().trim().min(8).max(24),
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH),
});

export const submitAnswerSchema = z.object({
  date: dateStringSchema,
  kind: questionKindSchema,
  body: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
});

export const retractAnswerSchema = z.object({
  date: dateStringSchema,
  kind: questionKindSchema,
});

export const toggleReactionSchema = z.object({
  answerId: uuidSchema,
  emoji: z.enum(REACTION_EMOJIS),
});

export const setQuestionModeSchema = z.object({
  mode: roomModeSchema,
});

/** Note is optional: a reader should be able to say "this is wrong" in one click. */
export const flagQuestionSchema = z.object({
  date: dateStringSchema,
  kind: questionKindSchema,
  note: z.string().trim().max(280).optional(),
});

export const calendarMonthSchema = z.object({
  month: z.string().refine((value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value), {
    message: "Expected a YYYY-MM month.",
  }),
});

/** Turns a zod failure into something worth showing a person. */
export function actionErrorMessage(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}
