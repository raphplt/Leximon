import { LEAGUES, REVIEW_DIFFICULTIES } from "@leximon/core";
import { z } from "zod";
import { emblemSchema, slugSchema, timestampSchema } from "./common";
import { patronMarkSchema } from "./patron";

/** Cosmetic ids: avatars are card ids, frames short names ("gilded"). */
const cosmeticSchema = z.string().min(1).max(64);

/** A player as other players see them in a list (an offer, the blocked players). */
export const playerBadgeSchema = z.object({
  code: z.string(),
  /** `null` until the player chooses one; the code stands in for it. */
  pseudo: z.string().nullable(),
  /** Card id of the engraved avatar worn. */
  avatar: cosmeticSchema,
  frame: cosmeticSchema,
  level: z.int().positive(),
});
export type PlayerBadge = z.infer<typeof playerBadgeSchema>;

/** The profile in figures, counted when read. */
export const profileStatsSchema = z.object({
  /** Distinct words owned. */
  words: z.int().nonnegative(),
  legendaries: z.int().nonnegative(),
  /** Words at the gilded mastery level. */
  gilded: z.int().nonnegative(),
  tradesCompleted: z.int().nonnegative(),
  completeCollections: z.int().nonnegative(),
  /** Days in Paris with at least one booster opened. */
  daysPlayed: z.int().nonnegative(),
});
export type ProfileStats = z.infer<typeof profileStatsSchema>;

/**
 * The player's ranked jousts, as their profile shows them: league, week, jousts played. The rating
 * stays out: only its owner reads it, in their joust statistics.
 */
export const profileJoustsSchema = z.object({
  /** The `leagueSchema` of `./leagues`, which imports this file. */
  league: z.enum(LEAGUES),
  /** Ranked jousts played, every week. */
  ranked: z.int().positive(),
  /** This week's tournament; `null` until the player's first ranked joust of the week. */
  week: z
    .object({
      place: z.int().positive(),
      /** Places of the group, automatons included. */
      size: z.int().positive(),
      points: z.int().nonnegative(),
    })
    .nullable(),
});
export type ProfileJousts = z.infer<typeof profileJoustsSchema>;

/** The banner at the top of a profile: a motif over a tint. */
export const profileBannerSchema = z.object({
  motif: cosmeticSchema,
  tint: cosmeticSchema,
});
export type ProfileBanner = z.infer<typeof profileBannerSchema>;

/** The clan a public profile shows: its name, emblem and level. */
export const profileClanSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  emblem: emblemSchema,
  level: z.int().positive(),
});
export type ProfileClan = z.infer<typeof profileClanSchema>;

/** A player in the list of public profiles. */
export const directoryPlayerSchema = z.object({
  player: playerBadgeSchema,
  /** `null` without a clan. */
  clan: profileClanSchema.nullable(),
  /** The first cards of the profile, in its order. */
  pinned: z.array(slugSchema),
  patron: patronMarkSchema,
});
export type DirectoryPlayer = z.infer<typeof directoryPlayerSchema>;

/** `active`: the latest seen first. `new`: the latest arrived first. `near`: `active`, around the viewer's level. */
export const playerSortSchema = z.enum(["active", "new", "near"]);
export type PlayerSort = z.infer<typeof playerSortSchema>;

/** `GET /players?q=&sort=&clanless=1&cursor=`: by pseudo prefix. A cursor belongs to its sort. */
export const playersQuerySchema = z.object({
  q: z.string().trim().max(30).optional(),
  sort: playerSortSchema.default("active"),
  clanless: z.literal("1").optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const playersResponseSchema = z.object({
  players: z.array(directoryPlayerSchema),
  nextCursor: z.string().nullable(),
});
export type PlayersResponse = z.infer<typeof playersResponseSchema>;

/**
 * `GET /players/:pseudo`, 200. A private profile shows only the pseudo and
 * the avatar. A profile below the public level, or of a player blocked either way, answers 404.
 */
export const publicProfileSchema = z.discriminatedUnion("visibility", [
  z.object({
    visibility: z.literal("public"),
    pseudo: z.string(),
    code: z.string(),
    avatar: cosmeticSchema,
    frame: cosmeticSchema,
    title: z.string().nullable(),
    level: z.int().positive(),
    memberSince: timestampSchema,
    patron: patronMarkSchema,
    /** `null` without a clan. */
    clan: profileClanSchema.nullable(),
    banner: profileBannerSchema,
    /** In the order of the profile. */
    pinned: z.array(slugSchema),
    /** The library edition of each pinned card printed in one; absent from older servers. */
    editions: z.record(slugSchema, slugSchema).optional(),
    stats: profileStatsSchema,
    /** `null` before the player's first ranked joust. */
    jousts: profileJoustsSchema.nullable(),
    /** Where the signed-in viewer stands with this player; missing for a guest or anonymous viewer. */
    friendship: z.enum(["none", "friends", "requested", "incoming"]).optional(),
  }),
  z.object({
    visibility: z.literal("private"),
    pseudo: z.string(),
    avatar: cosmeticSchema,
    frame: cosmeticSchema,
    friendship: z.enum(["none", "friends", "requested", "incoming"]).optional(),
  }),
]);
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** What the player may wear: the starting set and what their coffrets gave. */
export const wardrobeSchema = z.object({
  avatars: z.array(cosmeticSchema),
  frames: z.array(cosmeticSchema),
  titles: z.array(z.string()),
  /** Banner motifs earned or bought; every tint is free. */
  banners: z.array(cosmeticSchema),
});
export type WardrobeView = z.infer<typeof wardrobeSchema>;

/** `PATCH /me/profile` body: only the fields sent change. `title: null` wears the latest title. */
export const updateProfileRequestSchema = z
  .object({
    pseudo: z.string().max(60),
    avatar: cosmeticSchema,
    frame: cosmeticSchema,
    title: z.string().max(60).nullable(),
    bannerMotif: cosmeticSchema,
    bannerTint: cosmeticSchema,
    profilePublic: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0);
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/**
 * `PATCH /me/profile` and `PUT /me/pinned-cards` refusals, as `{ error }`: 403 for
 * `account_required` (a guest has no profile), 409 for `pseudo_taken` and `pseudo_too_soon`, 422
 * otherwise.
 */
export const profileRefusalSchema = z.enum([
  "account_required",
  "pseudo_too_short",
  "pseudo_too_long",
  "pseudo_invalid",
  "pseudo_refused",
  "pseudo_taken",
  "pseudo_too_soon",
  "cosmetic_locked",
  "too_many_pins",
  "card_not_owned",
  "duplicate_card",
]);
export type ProfileRefusal = z.infer<typeof profileRefusalSchema>;

/** `PUT /me/pinned-cards` body: the cards in their order on the profile, all of them. */
export const pinnedCardsRequestSchema = z.object({
  cardIds: z.array(slugSchema).max(12),
});
export type PinnedCardsRequest = z.infer<typeof pinnedCardsRequestSchema>;

/** `GET /me/blocks`, 200: the players the player blocked, latest first. */
export const blocksResponseSchema = z.object({ players: z.array(playerBadgeSchema) });
export type BlocksResponse = z.infer<typeof blocksResponseSchema>;

/** `PUT /me/blocks/:code` and `POST /players/:pseudo/report` refusals, as `{ error }`. */
export const blockRefusalSchema = z.enum(["account_required", "player_not_found", "self"]);
export type BlockRefusal = z.infer<typeof blockRefusalSchema>;

/** `GET /me/preferences` and `PATCH /me/preferences` (all fields optional in the body). */
export const preferencesSchema = z.object({
  notifyReviews: z.boolean(),
  notifyTrades: z.boolean(),
  notifyClanMentions: z.boolean(),
  notifyJousts: z.boolean(),
  /** Anyone may ask to be friends; otherwise only the friend link makes friends. */
  friendRequestsOpen: z.boolean(),
  /** What the player finds enters their friends' feed. */
  shareFinds: z.boolean(),
  /** An e-mail when letters wait unread: friends, offers, the clan. */
  emailNews: z.boolean(),
  /** An e-mail when the player stays away while their sachets are full. */
  emailReminders: z.boolean(),
  /** Questions of a review series; the server accepts the lengths of its rules only. */
  reviewLength: z.int().min(1).max(20),
  /** New words started each day; the server accepts the choices of its rules only. */
  newWordsPerDay: z.int().min(1).max(50),
  /** Formats of a review series kept beyond the two multiple choices. */
  reviewListen: z.boolean(),
  reviewPairs: z.boolean(),
  /** « hard » changes free practice only. */
  reviewDifficulty: z.enum(REVIEW_DIFFICULTIES),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const updatePreferencesRequestSchema = preferencesSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0);

/** `DELETE /me` refusal, 409: an admin hands back the role first. */
export const deleteAccountRefusalSchema = z.enum(["admin_account"]);
export type DeleteAccountRefusal = z.infer<typeof deleteAccountRefusalSchema>;
