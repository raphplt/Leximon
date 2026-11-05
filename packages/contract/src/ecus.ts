import { z } from "zod";
import { boosterWalletSchema, rarityCompletionSchema, raritySchema } from "./boosters";
import { slugSchema } from "./common";
import { progressGainSchema } from "./progress";

/** Copies of a card turned into écus. */
export const recycledCardSchema = z.object({
  cardId: slugSchema,
  copies: z.int().positive(),
  ecus: z.int().positive(),
});
export type RecycledCard = z.infer<typeof recycledCardSchema>;

/**
 * `POST /me/recycle` and `POST /me/cards/:cardId/recycle`, 200: what was recycled, nothing when
 * there was no duplicate left to recycle.
 */
export const recycleResponseSchema = z.object({
  cards: z.array(recycledCardSchema),
  copies: z.int().nonnegative(),
  ecus: z.int().nonnegative(),
  wallet: boosterWalletSchema,
});
export type RecycleResponse = z.infer<typeof recycleResponseSchema>;

/** `POST /me/cards/:cardId/recycle`, 409: the player has a single copy of it, or none. */
export const recycleRefusalSchema = z.object({ error: z.enum(["no_duplicate"]) });
export type RecycleRefusal = z.infer<typeof recycleRefusalSchema>["error"];

/** `POST /me/missing-word` request body: where to draw the missing word from. */
export const missingWordRequestSchema = z.object({
  collectionId: slugSchema,
  rarity: raritySchema,
});
export type MissingWordRequest = z.infer<typeof missingWordRequestSchema>;

/** `POST /me/missing-word`, 200: the word drawn and what it cost. */
export const missingWordResponseSchema = z.object({
  cardId: slugSchema,
  price: z.int().positive(),
  wallet: boosterWalletSchema,
  progress: progressGainSchema,
  /** Rarities the word completed, included in `progress.xpGained`. */
  completions: z.array(rarityCompletionSchema),
});
export type MissingWordResponse = z.infer<typeof missingWordResponseSchema>;

/**
 * `POST /me/missing-word`, 409. `not_enough_ecus`: the price is above the player's écus.
 * `nothing_missing`: every card of the choice is owned. `collection_locked`: the collection opens
 * at a level. `collection_not_found`: no such collection.
 */
export const missingWordRefusalSchema = z.object({
  error: z.enum([
    "not_enough_ecus",
    "nothing_missing",
    "collection_locked",
    "collection_not_found",
  ]),
});
export type MissingWordRefusal = z.infer<typeof missingWordRefusalSchema>["error"];
