import { LEVEL_REWARD_KINDS } from "@leximon/core";
import { z } from "zod";
import { boosterWalletSchema } from "./boosters";

/** A level reward, as the coffret shows it. */
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
 * `reserve_full`: its boosters do not fit in the reserve.
 */
export const claimRefusalSchema = z.object({
  error: z.enum(["level_not_reached", "reserve_full", "guest_archived"]),
});
export type ClaimRefusal = z.infer<typeof claimRefusalSchema>["error"];

/** `GET /me/welcome`, 200: the welcome week, one day claimed a calendar day. */
export const welcomeWeekResponseSchema = z.object({
  /** What each day gives, day 1 first. */
  days: z.array(z.array(levelRewardSchema)).min(1),
  /** Days claimed: the next one is `claimed + 1`, and the week is over once all are. */
  claimed: z.int().min(0),
  /** The next day can be claimed now; otherwise it opens tomorrow. */
  open: z.boolean(),
  /** `false` for a guest: the week starts with an account. */
  account: z.boolean(),
});
export type WelcomeWeekResponse = z.infer<typeof welcomeWeekResponseSchema>;

/** `POST /me/welcome/:day`, 200: what the day gave (also when a retry replays it). */
export const claimWelcomeDayResponseSchema = z.object({
  day: z.int().min(1),
  rewards: z.array(levelRewardSchema),
  wallet: boosterWalletSchema,
});
export type ClaimWelcomeDayResponse = z.infer<typeof claimWelcomeDayResponseSchema>;

/**
 * `POST /me/welcome/:day`, 409: the day stays closed. `not_open`: it is not the next day, or a
 * day was already claimed today. `reserve_full`: its boosters do not fit in the reserve.
 */
export const welcomeRefusalSchema = z.object({
  error: z.enum(["not_open", "reserve_full", "account_required"]),
});
export type WelcomeRefusal = z.infer<typeof welcomeRefusalSchema>["error"];
