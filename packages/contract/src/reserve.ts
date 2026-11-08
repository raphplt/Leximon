import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";

/** A word of the reserve: pre-screened, not published yet. Its id is the card it would become. */
export const reserveWordSchema = z.object({
  id: slugSchema,
  word: z.string().min(1),
  definition: z.string().min(1),
  theme: slugSchema.nullable(),
  partOfSpeech: z.string().min(1).nullable(),
});
export type ReserveWord = z.infer<typeof reserveWordSchema>;

/** `content/reserve/reserve.json`, written by the content pipeline and loaded into the base. */
export const reserveFileSchema = z.object({
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/),
  words: z.array(reserveWordSchema),
});
export type ReserveFile = z.infer<typeof reserveFileSchema>;

/** `GET /reserve` query: a beginning of word, or a theme to leaf through, by pages. */
export const reserveQuerySchema = z.object({
  q: z.string().trim().max(40).optional(),
  theme: slugSchema.optional(),
  cursor: z.string().min(1).max(200).optional(),
});

/** `GET /reserve`, 200. Sorted by word; `nextCursor` is `null` on the last page. */
export const reserveResponseSchema = z.object({
  words: z.array(reserveWordSchema),
  nextCursor: z.string().nullable(),
});
export type ReserveResponse = z.infer<typeof reserveResponseSchema>;

/**
 * A word found by a patron: `reserved` until its card is published, `rejected` when the quality
 * check sets it aside (the right is given back).
 */
export const wordFindSchema = z.object({
  id: slugSchema,
  word: z.string().min(1),
  state: z.enum(["reserved", "published", "rejected"]),
  foundAt: timestampSchema,
});
export type WordFindView = z.infer<typeof wordFindSchema>;

/** What a patron may find, in `GET /me/patron`; absent from answers made before it. */
export const patronFindsSchema = z
  .object({
    /** Words the patron may still find. */
    left: z.int().nonnegative(),
    /** Words found, latest first. */
    words: z.array(wordFindSchema),
  })
  .default({ left: 0, words: [] });
export type PatronFindsView = z.infer<typeof patronFindsSchema>;

/**
 * Why a word cannot be found: no right left, taken by another patron meanwhile, no pseudo to sign
 * the card with, or no longer in the reserve.
 */
export const findRefusalSchema = z.object({
  error: z.enum(["no_right", "taken", "no_pseudo", "not_in_reserve"]),
});
export type FindRefusal = z.infer<typeof findRefusalSchema>["error"];

/** `POST /reserve/:wordId/find`, 200. */
export const findResponseSchema = z.object({ find: wordFindSchema });

/**
 * `finders.json` beside the catalogue's manifest: the pseudo signing each card found by a patron,
 * as of the latest publication. A card missing here has no finder.
 */
export const finderIndexSchema = z.object({ cards: z.record(z.string(), z.string().min(1)) });
export type FinderIndex = z.infer<typeof finderIndexSchema>;
