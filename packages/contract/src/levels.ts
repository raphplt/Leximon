import { LEVEL_REWARD_KINDS } from "@leximon/core";
import { z } from "zod";
import { boosterWalletSchema } from "./boosters";
import { slugSchema } from "./common";

/** A level reward (P58), as the coffret shows it. */
export const levelRewardSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("title"), title: z.string().min(1) }),
  /** `avatar` (a card id) is absent from coffrets opened before avatars were named. */
  z.object({ kind: z.literal("avatar"), avatar: z.string().min(1).exactOptional() }),
  z.object({ kind: z.literal("frame"), frame: z.string().min(1) }),
  z.object({ kind: z.enum(LEVEL_REWARD_KINDS).exclude(["title", "avatar", "frame"]) }),
]);
export type LevelRewardView = z.infer<typeof levelRewardSchema>;

/** `GET /me/level-rewards`, 200. Levels reached and not listed here wait to be claimed. */
export const levelRewardsResponseSchema = z.object({
  /** Levels already claimed, lowest first. */
  claimed: z.array(z.int().min(2)),
  /** Claimed levels whose card of the player's choice is still to take, lowest first. */
  cardChoices: z.array(z.int().min(2)),
});
export type LevelRewardsResponse = z.infer<typeof levelRewardsResponseSchema>;

/** `POST /me/level-rewards/:level`, 200: what the coffret gave (also when a retry replays it). */
export const claimLevelRewardResponseSchema = z.object({
  level: z.int().min(2),
  rewards: z.array(levelRewardSchema),
  wallet: boosterWalletSchema,
});
export type ClaimLevelRewardResponse = z.infer<typeof claimLevelRewardResponseSchema>;

/**
 * `POST /me/level-rewards/:level`, 409: the coffret stays closed and can be claimed later.
 * `reserve_full`: its boosters do not fit in the reserve; `stock_full`: its refill would be lost.
 */
export const claimRefusalSchema = z.object({
  error: z.enum(["level_not_reached", "reserve_full", "stock_full", "guest_archived"]),
});
export type ClaimRefusal = z.infer<typeof claimRefusalSchema>["error"];

/** `POST /me/card-choices` body: the card taken for a level's card of the player's choice. */
export const cardChoiceRequestSchema = z.object({
  level: z.int().min(2),
  cardId: slugSchema,
});
export type CardChoiceRequest = z.infer<typeof cardChoiceRequestSchema>;

/** `POST /me/card-choices`, 200 (also when a retry replays it). */
export const cardChoiceResponseSchema = z.object({
  level: z.int().min(2),
  cardId: slugSchema,
});
export type CardChoiceResponse = z.infer<typeof cardChoiceResponseSchema>;

/**
 * `POST /me/card-choices`, 409 or 422. `no_card_choice`: no claimed level with a choice left;
 * `already_chosen`: another card was taken for this level; `card_not_choosable`: too rare,
 * already owned, or not in a published collection.
 */
export const cardChoiceRefusalSchema = z.object({
  error: z.enum(["no_card_choice", "already_chosen", "card_not_choosable"]),
});
export type CardChoiceRefusal = z.infer<typeof cardChoiceRefusalSchema>["error"];
