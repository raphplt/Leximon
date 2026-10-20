import { RARITIES, type Rarity } from "@leximon/core";
import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { progressGainSchema } from "./progress";

export const raritySchema = z.enum(RARITIES);

/** Rarity names shown to players. */
export const RARITY_LABELS: Readonly<Record<Rarity, string>> = {
  common: "Courant",
  uncommon: "Peu courant",
  rare: "Rare",
  precious: "Précieux",
  epic: "Épique",
  legendary: "Légendaire",
};

export const drawnCardSchema = z.object({
  cardId: z.string().min(1),
  rarity: raritySchema,
});

export const boosterWalletSchema = z.object({
  stored: z.int().nonnegative(),
  /** `null` when the stock is full. */
  nextRefillAt: timestampSchema.nullable(),
  /** Bonus boosters earned through challenges, opened once the free stock is empty. */
  bonus: z.int().nonnegative(),
});
export type BoosterWalletResponse = z.infer<typeof boosterWalletSchema>;

/** Which booster to open: a collection's, or the discovery booster drawn from the whole catalog. */
export const boosterSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("collection"), collectionId: slugSchema }),
  z.object({ kind: z.literal("discovery") }),
]);
export type BoosterSource = z.infer<typeof boosterSourceSchema>;

/** `POST /boosters/open` request body. */
export const openBoosterRequestSchema = boosterSourceSchema;
export type OpenBoosterRequest = z.infer<typeof openBoosterRequestSchema>;

/** `POST /boosters/open`, 200. */
export const openBoosterResponseSchema = z.object({
  openId: z.uuid(),
  cards: z.array(drawnCardSchema).min(1),
  wallet: boosterWalletSchema,
  progress: progressGainSchema,
});
export type OpenBoosterResponse = z.infer<typeof openBoosterResponseSchema>;

/** `POST /boosters/open`, 409: nothing to open yet. */
export const boosterStockEmptySchema = z.object({
  error: z.literal("booster_stock_empty"),
  nextRefillAt: timestampSchema,
});
export type BoosterStockEmptyResponse = z.infer<typeof boosterStockEmptySchema>;

/** `POST /boosters/open`, 403: the guest opened all its boosters and must create an account (P37). */
export const signupRequiredSchema = z.object({ error: z.literal("signup_required") });
export type SignupRequiredResponse = z.infer<typeof signupRequiredSchema>;
