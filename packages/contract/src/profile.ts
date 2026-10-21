import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";

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

/** The profile in figures (P-03), counted when read. */
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
 * `GET /players/:pseudo`, 200 (P-05, P-06). A private profile (P60) shows only the pseudo and
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
    /** In the order of the profile. */
    pinned: z.array(slugSchema),
    stats: profileStatsSchema,
  }),
  z.object({
    visibility: z.literal("private"),
    pseudo: z.string(),
    avatar: cosmeticSchema,
    frame: cosmeticSchema,
  }),
]);
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** What the player may wear (P58): the starting set and what their coffrets gave. */
export const wardrobeSchema = z.object({
  avatars: z.array(cosmeticSchema),
  frames: z.array(cosmeticSchema),
  titles: z.array(z.string()),
});
export type WardrobeView = z.infer<typeof wardrobeSchema>;

/** `PATCH /me/profile` body: only the fields sent change. `title: null` wears the latest title. */
export const updateProfileRequestSchema = z
  .object({
    pseudo: z.string().max(60),
    avatar: cosmeticSchema,
    frame: cosmeticSchema,
    title: z.string().max(60).nullable(),
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
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const updatePreferencesRequestSchema = preferencesSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0);

/** `DELETE /me` refusal, 409: an admin hands back the role first (D-031). */
export const deleteAccountRefusalSchema = z.enum(["admin_account"]);
export type DeleteAccountRefusal = z.infer<typeof deleteAccountRefusalSchema>;
