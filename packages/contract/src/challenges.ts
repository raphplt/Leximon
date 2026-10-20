import { CHALLENGE_FORMATS, CHOICES_PER_QUESTION, MASTERY_LEVELS } from "@leximon/core";
import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";

export const challengeFormatSchema = z.enum(CHALLENGE_FORMATS);
export const masteryLevelSchema = z.enum(MASTERY_LEVELS);
export type MasteryLevelCode = z.infer<typeof masteryLevelSchema>;

/** Level names shown to players. */
export const MASTERY_LEVEL_LABELS: Readonly<Record<MasteryLevelCode, string>> = {
  sketch: "Esquisse",
  ink: "Encre",
  gilded: "Dorure",
};

/** `GET /challenges` query string. */
export const challengesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

/**
 * One multiple-choice question. "definition": show the word of `cardId`, the choices are
 * definitions; "word": show the definition of `cardId`, the choices are words. Texts come from
 * the catalogue.
 */
export const challengeQuestionSchema = z.object({
  cardId: slugSchema,
  format: challengeFormatSchema,
  /** Card ids in display order, the answer among them. */
  choices: z.array(slugSchema).length(CHOICES_PER_QUESTION),
});
export type ChallengeQuestion = z.infer<typeof challengeQuestionSchema>;

/** `GET /challenges`, 200: words due for review first, then words never reviewed. */
export const challengesResponseSchema = z.object({
  questions: z.array(challengeQuestionSchema),
  /** When the next owned word becomes due, if none is due now; `null` otherwise. */
  nextDueAt: timestampSchema.nullable(),
});
export type ChallengesResponse = z.infer<typeof challengesResponseSchema>;

/** `POST /challenges/answer` body, with an `Idempotency-Key` header. */
export const challengeAnswerRequestSchema = z.object({
  cardId: slugSchema,
  format: challengeFormatSchema,
  chosenCardId: slugSchema,
});
export type ChallengeAnswerRequest = z.infer<typeof challengeAnswerRequestSchema>;

/** Bonus boosters earned by one answer. */
export const answerBonusSchema = z.object({
  /** Earned by reaching today's goal (enough answers, enough of them right). */
  daily: z.int().nonnegative(),
  /** Earned by raising the card to the gilded level. */
  gilded: z.int().nonnegative(),
  /** Part of `daily + gilded` that fitted in the reserve; the rest was lost to its cap. */
  credited: z.int().nonnegative(),
  /** Bonus boosters in the reserve after this answer. */
  reserve: z.int().nonnegative(),
});
export type AnswerBonus = z.infer<typeof answerBonusSchema>;

/** `POST /challenges/answer`, 200. Errors: 409 `challenge_not_due`, 404 `card_not_owned`. */
export const challengeAnswerResponseSchema = z.object({
  correct: z.boolean(),
  level: masteryLevelSchema,
  levelUp: z.boolean(),
  nextReviewAt: timestampSchema,
  bonus: answerBonusSchema,
});
export type ChallengeAnswerResponse = z.infer<typeof challengeAnswerResponseSchema>;

/** `GET /me/mastery`, 200: the level of every word reviewed at least once. */
export const masteryResponseSchema = z.object({
  words: z.array(z.object({ cardId: slugSchema, level: masteryLevelSchema })),
});
export type MasteryResponse = z.infer<typeof masteryResponseSchema>;
