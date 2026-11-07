import { LEAGUES } from "@leximon/core";
import { z } from "zod";
import { boosterWalletSchema } from "./boosters";
import { levelRewardSchema } from "./levels";
import { playerBadgeSchema } from "./profile";

export const leagueSchema = z.enum(LEAGUES);
export type LeagueId = z.infer<typeof leagueSchema>;

/** A division of the ladder: « Chevalier II » is `chevalier` and rank 2. */
export const divisionSchema = z.object({
  league: leagueSchema,
  /** 3, 2 then 1 within a league; `null` for Champion, a single division. */
  rank: z.int().positive().nullable(),
  /** Laurels at which it starts. */
  from: z.int().nonnegative(),
  /** Its place on the ladder, 0 for the first. */
  index: z.int().nonnegative(),
});
export type DivisionView = z.infer<typeof divisionSchema>;

export const seasonSchema = z.object({
  index: z.int(),
  firstDay: z.iso.date(),
  lastDay: z.iso.date(),
});
export type SeasonView = z.infer<typeof seasonSchema>;

/** Where the player stands this season, before or after their first ranked joust of it. */
export const joustStandingSchema = z.object({
  season: seasonSchema,
  laurels: z.int().nonnegative(),
  division: divisionSchema,
  /** The division above; `null` in the last one. */
  nextDivision: divisionSchema.nullable(),
  /** Ranked wins in a row this season. */
  streak: z.int().nonnegative(),
  /** Champion when the season before ended: wears its emblem until this one ends. */
  champion: z.boolean(),
  /** League rewards reached and not claimed yet, past seasons included. */
  rewardsWaiting: z.int().nonnegative(),
});
export type JoustStanding = z.infer<typeof joustStandingSchema>;

/** A league reward: `step` is a division's index, or 0 for the end of a season. */
export const leagueRewardKeySchema = z.object({
  season: z.int(),
  step: z.int().nonnegative(),
});

/** `GET /jousts/league`: the road of the season, its rewards and the player's figures. */
export const leagueResponseSchema = z.object({
  standing: joustStandingSchema,
  /** Every division, lowest first, with what reaching it gives this season. */
  road: z.array(
    z.object({
      division: divisionSchema,
      rewards: z.array(levelRewardSchema),
      /** Climbed this season above where the player started: it gives its rewards. */
      rewarded: z.boolean(),
      claimed: z.boolean(),
    }),
  ),
  /** What the end of the season gives, by the league reached. */
  seasonRewards: z.array(z.object({ league: leagueSchema, rewards: z.array(levelRewardSchema) })),
  /** League rewards to claim, oldest first. */
  waiting: z.array(leagueRewardKeySchema.extend({ rewards: z.array(levelRewardSchema) })),
  stats: z.object({
    /** Ranked jousts played, every season. */
    ranked: z.int().nonnegative(),
    wins: z.int().nonnegative(),
    losses: z.int().nonnegative(),
    draws: z.int().nonnegative(),
    /** The hidden rating, shown once enough ranked jousts are played; `null` before. */
    rating: z.int().nullable(),
    ratingAfter: z.int().positive(),
  }),
  /** Enough regular jousters for the board of every league. */
  generalOpen: z.boolean(),
});
export type LeagueResponse = z.infer<typeof leagueResponseSchema>;

/** `POST /jousts/league/:season/:step`, 200: what it gave (also when a retry replays it). */
export const claimLeagueRewardResponseSchema = z.object({
  season: z.int(),
  step: z.int().nonnegative(),
  rewards: z.array(levelRewardSchema),
  wallet: boosterWalletSchema,
});
export type ClaimLeagueRewardResponse = z.infer<typeof claimLeagueRewardResponseSchema>;

/**
 * `POST /jousts/league/:season/:step`, 409. `not_reached`: the division was not climbed that
 * season, or the season is not over. `reserve_full`: its sachets do not fit in the reserve.
 */
export const leagueClaimRefusalSchema = z.object({
  error: z.enum(["not_reached", "reserve_full"]),
});
export type LeagueClaimRefusal = z.infer<typeof leagueClaimRefusalSchema>["error"];

export const boardSchema = z.enum(["league", "friends", "clan", "general"]);
export type Board = z.infer<typeof boardSchema>;

export const boardEntrySchema = z.object({
  player: playerBadgeSchema,
  place: z.int().positive(),
  laurels: z.int().nonnegative(),
  division: divisionSchema,
  champion: z.boolean(),
});
export type BoardEntry = z.infer<typeof boardEntrySchema>;

/** `GET /jousts/boards/:board?after=`: a page of a board of this season, by laurels. */
export const boardResponseSchema = z.object({
  board: boardSchema,
  /** `no_clan` and `general_closed` leave the board empty. */
  closed: z.enum(["no_clan", "general_closed"]).nullable(),
  /** For Ma ligue: the league shown. */
  league: leagueSchema.nullable(),
  entries: z.array(boardEntrySchema),
  /** The player, with their place, whether or not this page shows them. */
  me: boardEntrySchema,
  /** The cursor of the next page; `null` on the last. */
  next: z.string().nullable(),
});
export type BoardResponse = z.infer<typeof boardResponseSchema>;
