import { RARITIES, type Rarity } from "@leximon/core";
import { z } from "zod";
import { timestampSchema } from "./common";

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
});
export type BoosterWalletResponse = z.infer<typeof boosterWalletSchema>;

/** `POST /boosters/open`, 200. */
export const openBoosterResponseSchema = z.object({
  openId: z.uuid(),
  cards: z.array(drawnCardSchema).min(1),
  wallet: boosterWalletSchema,
});
export type OpenBoosterResponse = z.infer<typeof openBoosterResponseSchema>;

/** `POST /boosters/open`, 409: nothing to open yet. */
export const boosterStockEmptySchema = z.object({
  error: z.literal("booster_stock_empty"),
  nextRefillAt: timestampSchema,
});
export type BoosterStockEmptyResponse = z.infer<typeof boosterStockEmptySchema>;
