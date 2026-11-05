import { z } from "zod";
import { boosterWalletSchema } from "./boosters";
import { slugSchema } from "./common";
import { levelRewardSchema } from "./levels";
import { progressGainSchema } from "./progress";

/**
 * A mission of the day and how far the player is. `kind` is a string: a client meets kinds added
 * after its release, and shows them as such rather than failing.
 */
export const missionViewSchema = z.object({
  kind: z.string().min(1),
  target: z.int().positive(),
  /** The collection of a `review_collection` mission. */
  collectionId: slugSchema.exactOptional(),
  progress: z.int().nonnegative(),
  claimed: z.boolean(),
});
export type MissionView = z.infer<typeof missionViewSchema>;

/**
 * `GET /me/missions`, 200. `day` is `null` below the level that opens missions; the missions of
 * the day are drawn by the first request of the day.
 */
export const missionsResponseSchema = z.object({
  opensAtLevel: z.int().positive(),
  day: z.iso.date().nullable(),
  missions: z.array(missionViewSchema),
  /** A mission can still be changed today. */
  canChange: z.boolean(),
  bonusClaimed: z.boolean(),
  /** Done and not claimed, today and the days before; the bonus sachets they would add. */
  claimable: z.object({ missions: z.int().nonnegative(), bonus: z.int().nonnegative() }),
  /** What a mission gives, and the three of a day. */
  rewards: z.object({
    xp: z.int().nonnegative(),
    ecus: z.int().nonnegative(),
    allDoneBoosters: z.int().nonnegative(),
  }),
});
export type MissionsResponse = z.infer<typeof missionsResponseSchema>;

/** `POST /me/missions/change` request body: the slot of the mission to change. */
export const changeMissionRequestSchema = z.object({ slot: z.int().min(0).max(9) });
export type ChangeMissionRequest = z.infer<typeof changeMissionRequestSchema>;

/**
 * `POST /me/missions/change`, 409. `already_changed`: the one change of the day is used.
 * `mission_done`: a mission done or claimed stays. `no_other`: no other mission is possible.
 * `no_missions`: no missions today (level too low).
 */
export const changeMissionRefusalSchema = z.object({
  error: z.enum(["already_changed", "mission_done", "no_other", "no_missions"]),
});
export type ChangeMissionRefusal = z.infer<typeof changeMissionRefusalSchema>["error"];

/**
 * `POST /me/missions/claim`, 200: every mission done and not claimed, today and the days before,
 * and the bonus of the days whose missions are all claimed. Nothing when nothing waited.
 */
export const claimMissionsResponseSchema = z.object({
  missions: z.int().nonnegative(),
  ecus: z.int().nonnegative(),
  boosters: z.int().nonnegative(),
  /** A bonus earned that does not fit in the reserve: it waits, to be claimed later. */
  bonusWaiting: z.boolean(),
  wallet: boosterWalletSchema,
  progress: progressGainSchema,
});
export type ClaimMissionsResponse = z.infer<typeof claimMissionsResponseSchema>;

/** `GET /me/carnet`, 200: the carnet of the player, the current period first. */
export const carnetResponseSchema = z.object({
  /** `false` for a guest: the carnet follows the welcome week, which needs an account. */
  account: z.boolean(),
  /** The welcome week is over: days played now fill the carnet. */
  started: z.boolean(),
  /** What each case gives, case 1 first. */
  cases: z.array(z.array(levelRewardSchema)).min(1),
  period: z.object({
    index: z.int(),
    firstDay: z.iso.date(),
    lastDay: z.iso.date(),
  }),
  /** Cases of the current period filled by days played, and claimed. */
  earned: z.int().nonnegative(),
  claimed: z.int().nonnegative(),
  /** The next case to claim, an earlier period first; `null` when none waits. */
  next: z.object({ period: z.int(), case: z.int().positive() }).nullable(),
  /** Cases earned and not claimed, every period. */
  waiting: z.int().nonnegative(),
});
export type CarnetResponse = z.infer<typeof carnetResponseSchema>;

/** `POST /me/carnet/:period/:case`, 200: what the case gave (also when a retry replays it). */
export const claimCarnetCaseResponseSchema = z.object({
  period: z.int(),
  case: z.int().positive(),
  rewards: z.array(levelRewardSchema),
  wallet: boosterWalletSchema,
});
export type ClaimCarnetCaseResponse = z.infer<typeof claimCarnetCaseResponseSchema>;

/**
 * `POST /me/carnet/:period/:case`, 409. `not_open`: not the next case of that period, or not
 * earned yet. `reserve_full`: its sachets do not fit in the reserve. `account_required`: a guest.
 */
export const carnetRefusalSchema = z.object({
  error: z.enum(["not_open", "reserve_full", "account_required"]),
});
export type CarnetRefusal = z.infer<typeof carnetRefusalSchema>["error"];
