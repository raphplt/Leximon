import { RIDDLE_OUTCOMES, TYPED_ANSWER_MAX_LENGTH } from "@leximon/core";
import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { progressGainSchema } from "./progress";

export const riddleOutcomeSchema = z.enum(RIDDLE_OUTCOMES);
export type RiddleOutcomeCode = z.infer<typeof riddleOutcomeSchema>;

export const riddleAnswerSchema = z.object({ cardId: slugSchema, word: z.string().min(1) });

/**
 * `GET /riddles/today`, 200: the riddle as this player may read it. Clues not uncovered yet are
 * `null`, and the answer stays out of the response until the game is over.
 */
export const riddleResponseSchema = z.object({
  number: z.int().positive(),
  partOfSpeech: z.string().min(1),
  /** Letters of the word. */
  letters: z.int().positive(),
  /** Clues and letters uncovered so far. */
  step: z.int().nonnegative(),
  lastStep: z.int().positive(),
  clues: z.object({
    opening: z.string().nullable(),
    definition: z.string().nullable(),
    etymology: z.string().nullable(),
  }),
  /** The first letters of the word, as written on the card. */
  shownLetters: z.string(),
  outcome: riddleOutcomeSchema.nullable(),
  answer: riddleAnswerSchema.nullable(),
  /** What finding the word earned. */
  xp: z.int().nonnegative(),
  /** The player did not have the card: finding the word gave them a copy. */
  cardGiven: z.boolean(),
  /** When the next riddle starts. */
  nextAt: timestampSchema,
});
export type RiddleResponse = z.infer<typeof riddleResponseSchema>;

/**
 * `POST /riddles/today/answer` body, with an `Idempotency-Key` header. `number` is the riddle the
 * player is looking at; `guess` is the word typed, or `null` to ask for the next clue.
 */
export const riddleAnswerRequestSchema = z.object({
  number: z.int().positive(),
  guess: z.string().min(1).max(TYPED_ANSWER_MAX_LENGTH).nullable(),
});
export type RiddleAnswerRequest = z.infer<typeof riddleAnswerRequestSchema>;

/** `POST /riddles/today/answer`, 200. */
export const riddleAnswerResponseSchema = z.object({
  riddle: riddleResponseSchema,
  progress: progressGainSchema,
});
export type RiddleAnswerResponse = z.infer<typeof riddleAnswerResponseSchema>;

/** `GET /riddles/:number`, 200, without an account: never the answer of the day's riddle. */
export const publicRiddleSchema = z.object({
  number: z.int().positive(),
  /** "2026-10-31", in Paris. */
  day: z.iso.date(),
  isToday: z.boolean(),
  /** Finished games. */
  played: z.int().nonnegative(),
  found: z.int().nonnegative(),
  answer: riddleAnswerSchema.nullable(),
});
export type PublicRiddle = z.infer<typeof publicRiddleSchema>;
