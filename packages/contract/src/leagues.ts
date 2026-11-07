import { LEAGUES } from "@leximon/core";
import { z } from "zod";
import { boosterWalletSchema } from "./boosters";
import { levelRewardSchema } from "./levels";
import { playerBadgeSchema } from "./profile";

export const leagueSchema = z.enum(LEAGUES);
export type LeagueId = z.infer<typeof leagueSchema>;

export const weekSchema = z.object({
  index: z.int(),
  firstDay: z.iso.date(),
  lastDay: z.iso.date(),
});
export type WeekView = z.infer<typeof weekSchema>;

/** What a place gives at the end of the week. */
export const weekMoveSchema = z.enum(["up", "stay", "down"]);
export type WeekMove = z.infer<typeof weekMoveSchema>;

/** The player in the week's tournament, as it stands now. */
export const groupPlaceSchema = z.object({
  place: z.int().positive(),
  points: z.int().nonnegative(),
  /** Places of the group, automatons included. */
  size: z.int().positive(),
  /** What the place would give if the week ended now. */
  move: weekMoveSchema,
});
export type GroupPlace = z.infer<typeof groupPlaceSchema>;

/** Where the player stands this week, before or after their first ranked joust of it. */
export const joustStandingSchema = z.object({
  week: weekSchema,
  league: leagueSchema,
  /** `null` until the result of their first ranked joust of the week. */
  group: groupPlaceSchema.nullable(),
  /** Ranked jousts the player may still play today, and how many a day. */
  rankedLeft: z.int().nonnegative(),
  rankedPerDay: z.int().positive(),
  /** Week rewards not claimed yet. */
  rewardsWaiting: z.int().nonnegative(),
});
export type JoustStanding = z.infer<typeof joustStandingSchema>;

/** `GET /jousts/league`: the ladder of leagues, the rewards to claim, the player's figures. */
export const leagueResponseSchema = z.object({
  standing: joustStandingSchema,
  /** Every league, lowest first: how many go up and down, what a week in it gives. */
  ladder: z.array(
    z.object({
      league: leagueSchema,
      up: z.int().nonnegative(),
      down: z.int().nonnegative(),
      rewards: z.array(levelRewardSchema),
    }),
  ),
  /** Given on top for going up. */
  upRewards: z.array(levelRewardSchema),
  /** Given on top to the first places of the Champion group. */
  podium: z.object({ places: z.int().positive(), rewards: z.array(levelRewardSchema) }),
  points: z.object({
    won: z.int().nonnegative(),
    draw: z.int().nonnegative(),
    lost: z.int().nonnegative(),
  }),
  /** Week rewards to claim, oldest first. */
  waiting: z.array(
    z.object({
      week: z.int(),
      league: leagueSchema,
      place: z.int().positive(),
      move: weekMoveSchema,
      rewards: z.array(levelRewardSchema),
    }),
  ),
  stats: z.object({
    /** Ranked jousts played, every week. */
    ranked: z.int().nonnegative(),
    /** This week. */
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

/** `POST /jousts/league/:week`, 200: what it gave (also when a retry replays it). */
export const claimLeagueRewardResponseSchema = z.object({
  week: z.int(),
  rewards: z.array(levelRewardSchema),
  wallet: boosterWalletSchema,
});
export type ClaimLeagueRewardResponse = z.infer<typeof claimLeagueRewardResponseSchema>;

/**
 * `POST /jousts/league/:week`, 409. `not_reached`: the player did not play that week's
 * tournament, or the week is not over. `reserve_full`: its sachets do not fit in the reserve.
 */
export const leagueClaimRefusalSchema = z.object({
  error: z.enum(["not_reached", "reserve_full"]),
});
export type LeagueClaimRefusal = z.infer<typeof leagueClaimRefusalSchema>["error"];

export const boardSchema = z.enum(["group", "friends", "clan", "general"]);
export type Board = z.infer<typeof boardSchema>;

const boardLine = {
  place: z.int().positive(),
  points: z.int().nonnegative(),
  league: leagueSchema,
  /** In the group: what the place would give if the week ended now. */
  move: weekMoveSchema.nullable(),
};

/** A line of a board: a player, an automaton of the group, or a player the reader blocked. */
export const boardEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("player"), player: playerBadgeSchema, ...boardLine }),
  /** `bot` picks the automaton's name. */
  z.object({ kind: z.literal("bot"), bot: z.int().nonnegative(), ...boardLine }),
  z.object({ kind: z.literal("hidden"), ...boardLine }),
]);
export type BoardEntry = z.infer<typeof boardEntrySchema>;

/** `GET /jousts/boards/:board?after=`: a page of a board of this week. */
export const boardResponseSchema = z.object({
  board: boardSchema,
  /**
   * `no_clan` and `general_closed` leave the board empty; `not_entered`: the group of a player
   * who has not entered this week's tournament.
   */
  closed: z.enum(["no_clan", "general_closed", "not_entered"]).nullable(),
  /** For the group: its league, and how many places go up and down. */
  league: leagueSchema.nullable(),
  moves: z.object({ up: z.int().nonnegative(), down: z.int().nonnegative() }).nullable(),
  entries: z.array(boardEntrySchema),
  /** The player, with their place; `null` when they have not entered this week's tournament. */
  me: boardEntrySchema.nullable(),
  /** The cursor of the next page; `null` on the last. */
  next: z.string().nullable(),
});
export type BoardResponse = z.infer<typeof boardResponseSchema>;
