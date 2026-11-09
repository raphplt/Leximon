import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { patronMarkSchema } from "./patron";
import {
  playerBadgeSchema,
  profileBannerSchema,
  profileClanSchema,
  profileJoustsSchema,
  profileStatsSchema,
  wardrobeSchema,
} from "./profile";

/** Public code of a player, shared to receive offers: 8 characters of Crockford base 32. */
export const playerCodeSchema = z
  .string()
  .transform((value) => value.replaceAll(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{8}$/));

/** `GET /me/profile`, 200: the player's own profile, also before it is public. */
export const profileResponseSchema = z.object({
  playerCode: z.string(),
  /** Account level needed to trade. */
  tradeMinLevel: z.int().positive(),
  /** A guest has no profile: everything below shows what an account would have. */
  member: z.boolean(),
  pseudo: z.string().nullable(),
  /** When the pseudo may change again; `null` while it can (or was never chosen). */
  pseudoChangeableFrom: timestampSchema.nullable(),
  avatar: z.string(),
  frame: z.string(),
  /** The title worn: the one chosen, else the latest won; `null` before the first one. */
  title: z.string().nullable(),
  /** The player chose `title`; otherwise it follows the latest title won. */
  titleChosen: z.boolean(),
  profilePublic: z.boolean(),
  /** Others see the profile from this level on. */
  publicFromLevel: z.int().positive(),
  level: z.int().positive(),
  memberSince: timestampSchema,
  patron: patronMarkSchema,
  /** `null` without a clan. */
  clan: profileClanSchema.nullable(),
  banner: profileBannerSchema,
  pinned: z.array(slugSchema),
  pinnedSlots: z.int().nonnegative(),
  wardrobe: wardrobeSchema,
  stats: profileStatsSchema,
  /** `null` before the player's first ranked joust. */
  jousts: profileJoustsSchema.nullable(),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

/** `GET /players/:code/tradeable` and `GET /me/tradeable`, 200: cards that player can give now. */
export const tradeableCardsResponseSchema = z.object({
  playerCode: z.string(),
  cardIds: z.array(slugSchema),
  /** That player's account level. */
  level: z.int().positive(),
  /** How that player shows in an offer. */
  player: playerBadgeSchema,
  /**
   * Cards each side of an offer may hold: between the requester and that player on
   * `/players/:code/tradeable`, for the player alone on `/me/tradeable`. 0 below the trade level.
   */
  maxCardsPerSide: z.int().nonnegative(),
  /** Rare duplicates still waiting after their last copy was obtained, with their date. */
  held: z.array(z.object({ cardId: slugSchema, tradeableFrom: timestampSchema })),
});
export type TradeableCardsResponse = z.infer<typeof tradeableCardsResponseSchema>;

const tradeCardsSchema = z.array(slugSchema).min(1).max(3);

/** `POST /trades` body, with an `Idempotency-Key` header. */
export const createTradeRequestSchema = z.object({
  recipientCode: playerCodeSchema,
  /** Cards the proposer gives. */
  give: tradeCardsSchema,
  /** Cards the proposer wants in return. */
  want: tradeCardsSchema,
});
export type CreateTradeRequest = z.input<typeof createTradeRequestSchema>;

export const tradeStatusSchema = z.enum([
  "pending",
  "completed",
  "declined",
  "cancelled",
  "expired",
]);
export type TradeStatus = z.infer<typeof tradeStatusSchema>;

export const tradeSchema = z.object({
  id: z.uuid(),
  /** Empty once that player deleted their account, when `proposer` is `null`. */
  proposerCode: z.string(),
  recipientCode: z.string(),
  proposer: playerBadgeSchema.nullable(),
  recipient: playerBadgeSchema.nullable(),
  give: z.array(slugSchema),
  want: z.array(slugSchema),
  status: tradeStatusSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  resolvedAt: timestampSchema.nullable(),
});
export type Trade = z.infer<typeof tradeSchema>;

/**
 * Refusals, as `{ error }`: 422 on `POST /trades`; 409 on accept, decline and cancel (an offer
 * no longer pending or expired, a card no longer tradeable, a level too low if the rule
 * tightened). `player_not_found` is a 404; `trade_not_found` (also for the wrong party) too.
 */
export const tradeRefusalSchema = z.enum([
  "player_not_found",
  "self_trade",
  "empty_side",
  "too_many_cards",
  "duplicate_card",
  "level_too_low",
  "daily_limit_reached",
  "card_not_tradeable",
  "trade_not_pending",
  "trade_expired",
  "trade_not_found",
]);
export type TradeRefusalCode = z.infer<typeof tradeRefusalSchema>;

/** `GET /trades` query string. */
export const tradesQuerySchema = z.object({
  box: z.enum(["incoming", "outgoing"]),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** `GET /trades`, 200: newest first. */
export const tradesResponseSchema = z.object({
  trades: z.array(tradeSchema),
  nextCursor: z.string().nullable(),
});
export type TradesResponse = z.infer<typeof tradesResponseSchema>;
