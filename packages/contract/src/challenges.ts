import {
  CHALLENGE_FORMATS,
  CHOICE_FORMATS,
  CHOICES_PER_QUESTION,
  MASTERY_LEVELS,
  PRACTICE_MAX_CARDS,
  QUIZ_FORMATS,
  REVIEW_DIFFICULTIES,
  TYPED_ANSWER_MAX_LENGTH,
} from "@leximon/core";
import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { progressGainSchema } from "./progress";

export const challengeFormatSchema = z.enum(CHALLENGE_FORMATS);
export const reviewDifficultySchema = z.enum(REVIEW_DIFFICULTIES);
const PAIRS_MAX_CARDS = 6;
/** More mistakes than this on a round of pairs is clicking at random. */
const PAIRS_MAX_MISTAKES = 50;
export const masteryLevelSchema = z.enum(MASTERY_LEVELS);
export type MasteryLevelCode = z.infer<typeof masteryLevelSchema>;

/** Level names shown to players. */
export const MASTERY_LEVEL_LABELS: Readonly<Record<MasteryLevelCode, string>> = {
  blank: "Page blanche",
  sketch: "Esquisse",
  ink: "Encre",
  gilded: "Dorure",
};

/** `GET /challenges` query string. */
export const challengesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

/**
 * One question. Multiple choice, "definition": show the word of `cardId`, the choices are
 * definitions; "word": show the definition of `cardId`, the choices are words. "typed": show the
 * definition of `cardId`, the player types the word; asked when a right answer can raise the
 * level. Texts come from the catalogue.
 */
export const challengeQuestionSchema = z.discriminatedUnion("format", [
  z.object({
    cardId: slugSchema,
    format: z.enum(CHOICE_FORMATS),
    /** Card ids in display order, the answer among them. */
    choices: z.array(slugSchema).length(CHOICES_PER_QUESTION),
  }),
  z.object({ cardId: slugSchema, format: z.literal("typed") }),
]);
export type ChallengeQuestion = z.infer<typeof challengeQuestionSchema>;

/** `GET /challenges`, 200: words due for review first, then words never reviewed. */
export const challengesResponseSchema = z.object({
  questions: z.array(challengeQuestionSchema),
  /** When the next owned word becomes due, if none is due now; `null` otherwise. */
  nextDueAt: timestampSchema.nullable(),
});
export type ChallengesResponse = z.infer<typeof challengesResponseSchema>;

/**
 * `POST /challenges/answer` body, with an `Idempotency-Key` header: the card picked among the
 * choices, or the word typed (empty when the player gives up). Only a typed answer can raise the
 * level, whatever question was served.
 */
export const challengeAnswerRequestSchema = z.discriminatedUnion("format", [
  z.object({ cardId: slugSchema, format: z.enum(QUIZ_FORMATS), chosenCardId: slugSchema }),
  z.object({
    cardId: slugSchema,
    format: z.literal("typed"),
    typed: z.string().max(TYPED_ANSWER_MAX_LENGTH),
  }),
]);
export type ChallengeAnswerRequest = z.infer<typeof challengeAnswerRequestSchema>;

/** What a practice series draws from. `cards` comes from a filter of the album. */
export const practiceScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("collection"), id: slugSchema }),
  z.object({ kind: z.literal("theme"), id: slugSchema }),
  z.object({ kind: z.literal("missed") }),
  z.object({ kind: z.literal("recent") }),
  z.object({
    kind: z.literal("cards"),
    cardIds: z.array(slugSchema).min(1).max(PRACTICE_MAX_CARDS),
  }),
]);
export type PracticeScope = z.infer<typeof practiceScopeSchema>;

/** `GET /challenges/practice`, 200: the scopes large enough to practise, and today's XP. */
export const practiceSummaryResponseSchema = z.object({
  scopes: z.array(
    z.object({
      scope: practiceScopeSchema,
      words: z.int().nonnegative(),
      /** Words of the scope that count as a review: due, or never reviewed. */
      due: z.int().nonnegative(),
    }),
  ),
  xp: z.object({ today: z.int().nonnegative(), cap: z.int().positive() }),
});
export type PracticeSummaryResponse = z.infer<typeof practiceSummaryResponseSchema>;

/** `POST /challenges/practice` body. */
export const practiceRequestSchema = z.object({ scope: practiceScopeSchema });
export type PracticeRequest = z.infer<typeof practiceRequestSchema>;

/**
 * One question of a series. `counted`: a word due or never reviewed, answered through
 * `POST /challenges/answer` like any review. Otherwise free practice, answered through
 * `POST /challenges/practice/answer`, always a multiple choice.
 */
export const practiceQuestionSchema = challengeQuestionSchema.and(
  z.object({ counted: z.boolean() }),
);
export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;

/** `POST /challenges/practice`, 200. Errors: 403 `level_required`, 422 `scope_too_small`. */
export const practiceResponseSchema = z.object({ questions: z.array(practiceQuestionSchema) });
export type PracticeResponse = z.infer<typeof practiceResponseSchema>;

/**
 * `POST /challenges/practice/answer` body, with an `Idempotency-Key` header: the card picked, the
 * word spelled out, or a round of pairs with the mistakes made before every pair was found. The
 * first clients send the card picked without a format.
 */
export const practiceAnswerRequestSchema = z.union([
  z.object({
    cardId: slugSchema,
    chosenCardId: slugSchema,
    format: z.enum(QUIZ_FORMATS).optional(),
  }),
  z.object({
    cardId: slugSchema,
    format: z.literal("typed"),
    typed: z.string().max(TYPED_ANSWER_MAX_LENGTH),
  }),
  z.object({
    cardId: slugSchema,
    format: z.literal("pairs"),
    mistakes: z.int().min(0).max(PAIRS_MAX_MISTAKES),
  }),
]);
export type PracticeAnswerRequest = z.infer<typeof practiceAnswerRequestSchema>;

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

/** `POST /challenges/practice/answer`, 200. Error: 404 `card_not_owned`. */
export const practiceAnswerResponseSchema = z.object({
  correct: z.boolean(),
  /** Free practice XP earned today, this answer included. */
  xpToday: z.int().nonnegative(),
  progress: progressGainSchema,
  /** The daily bonus, when free practice counts towards the daily goal. */
  bonus: answerBonusSchema.optional(),
  /** Écus of a perfect start: this answer made the day's first questions all right. */
  ecus: z.int().nonnegative().default(0),
});
export type PracticeAnswerResponse = z.infer<typeof practiceAnswerResponseSchema>;

/** `POST /challenges/answer`, 200. Errors: 409 `challenge_not_due`, 404 `card_not_owned`. */
export const challengeAnswerResponseSchema = z.object({
  correct: z.boolean(),
  /** Right, but typed with one slip: the card shows the spelling. */
  slip: z.boolean(),
  level: masteryLevelSchema,
  levelUp: z.boolean(),
  nextReviewAt: timestampSchema,
  bonus: answerBonusSchema,
  progress: progressGainSchema,
  /** Écus of a perfect start: this answer made the day's first questions all right. */
  ecus: z.int().nonnegative().default(0),
});
export type ChallengeAnswerResponse = z.infer<typeof challengeAnswerResponseSchema>;

/** `GET /me/mastery`, 200: the level of every word reviewed at least once. */
export const masteryResponseSchema = z.object({
  words: z.array(
    z.object({
      cardId: slugSchema,
      level: masteryLevelSchema,
      /** When the word is due again. */
      due: timestampSchema,
      /** Memory stability in days. */
      stability: z.number().nonnegative(),
      /** The last answer: a right answer long enough after it raises the level. */
      lastReviewedAt: timestampSchema.nullable(),
    }),
  ),
});
export type MasteryResponse = z.infer<typeof masteryResponseSchema>;

/** `GET /challenges/daily`, 200: today's answers towards the daily goal. */
export const dailyChallengeResponseSchema = z.object({
  goal: z.object({ answers: z.int().positive(), correct: z.int().positive() }),
  /** Answers given today (Paris time), and how many were right. */
  answers: z.int().nonnegative(),
  correct: z.int().nonnegative(),
  /** Whether today's bonus booster was already awarded. */
  awarded: z.boolean(),
});
export type DailyChallengeResponse = z.infer<typeof dailyChallengeResponseSchema>;

/** What a review series draws from: everything owned, a practice scope, or the words ready to rise. */
export const reviewScopeSchema = z.discriminatedUnion("kind", [
  ...practiceScopeSchema.options,
  z.object({ kind: z.literal("rising") }),
]);
export type ReviewScope = z.infer<typeof reviewScopeSchema>;

/** Owned words at each level; a word never answered right is a blank page. */
export const levelCountsSchema = z.object({
  blank: z.int().nonnegative(),
  sketch: z.int().nonnegative(),
  ink: z.int().nonnegative(),
  gilded: z.int().nonnegative(),
});
export type LevelCounts = z.infer<typeof levelCountsSchema>;

/** `GET /challenges/review`, 200: what waits, the player's settings, and the scopes to pick from. */
export const reviewSummaryResponseSchema = z.object({
  /** Words reviewed before and due now. */
  due: z.int().nonnegative(),
  /** New words the player can still start today. */
  fresh: z.int().nonnegative(),
  /** Words due whose right answer, typed, raises the level. */
  rising: z.int().nonnegative(),
  /** When the next word becomes due, if none is due now; `null` otherwise. */
  nextDueAt: timestampSchema.nullable(),
  levels: levelCountsSchema,
  settings: z.object({
    length: z.int().positive(),
    newWordsPerDay: z.int().positive(),
    lengths: z.array(z.int().positive()),
    newWordsPerDayChoices: z.array(z.int().positive()),
    listen: z.boolean(),
    pairs: z.boolean(),
    difficulty: reviewDifficultySchema,
  }),
  /** Scopes with enough words, closed ones included (the level they ask for is in the rules). */
  scopes: z.array(
    z.object({
      scope: reviewScopeSchema,
      words: z.int().nonnegative(),
      due: z.int().nonnegative(),
      rising: z.int().nonnegative(),
      levels: levelCountsSchema,
    }),
  ),
  xp: z.object({ today: z.int().nonnegative(), cap: z.int().positive() }),
  /** Days played in a row, a few missed days forgiven each week, and since the first. */
  streak: z.object({
    current: z.int().nonnegative(),
    total: z.int().nonnegative(),
    playedToday: z.boolean(),
  }),
});
export type ReviewSummaryResponse = z.infer<typeof reviewSummaryResponseSchema>;

/** `POST /challenges/review` body: everything owned by default, at the player's length. */
export const reviewRequestSchema = z.object({
  scope: reviewScopeSchema.optional(),
  length: z.int().min(1).max(20).optional(),
  /** A word to open the series with, picked by the player. */
  first: slugSchema.optional(),
});
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

/**
 * One question of a review. `counted`: answered through `POST /challenges/answer`. Otherwise free
 * practice, through `POST /challenges/practice/answer`. `fresh`: the player meets the word for the
 * first time. `retry`: the same word asked the other way round, to ask again a few questions later
 * when it is missed, as free practice.
 */
export const reviewQuestionSchema = z
  .discriminatedUnion("format", [
    z.object({
      cardId: slugSchema,
      format: z.enum(QUIZ_FORMATS),
      choices: z.array(slugSchema).length(CHOICES_PER_QUESTION),
    }),
    z.object({ cardId: slugSchema, format: z.literal("typed") }),
    /** `cards`: the words to match, `cardId` among them; their definitions in another order. */
    z.object({
      cardId: slugSchema,
      format: z.literal("pairs"),
      cards: z.array(slugSchema).min(2).max(PAIRS_MAX_CARDS),
      definitions: z.array(slugSchema).min(2).max(PAIRS_MAX_CARDS),
    }),
  ])
  .and(
    z.object({
      counted: z.boolean(),
      fresh: z.boolean(),
      retry: z
        .object({
          format: z.enum(CHOICE_FORMATS),
          choices: z.array(slugSchema).length(CHOICES_PER_QUESTION),
        })
        .nullable(),
    }),
  );
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;

/** `POST /challenges/review`, 200. Errors: 403 `level_required`, 422 `scope_too_small`. */
export const reviewResponseSchema = z.object({ questions: z.array(reviewQuestionSchema) });
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
