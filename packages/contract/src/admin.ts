import { z } from "zod";
import { raritySchema } from "./boosters";
import { slugSchema, timestampSchema } from "./common";
import { adminWaitlistOpeningSchema } from "./email";
import { progressSchema } from "./progress";
import { tradeStatusSchema } from "./trades";

/**
 * Back office (`/admin/*`), for accounts with the admin role only: 401 without a session, 403
 * for anyone else. Changes to a player's state are logged in `admin_actions`.
 */

const cursorQuery = z.string().max(200).optional();
const reasonSchema = z.string().trim().min(1).max(200);

/**
 * `GET /admin/me`, 200: the admin browsing. The back office asks it rather than `/me/account`,
 * whose role can come from a session cache up to five minutes old.
 */
export const adminMeSchema = z.object({ email: z.string() });
export type AdminMe = z.infer<typeof adminMeSchema>;

/** `GET /admin/overview`, 200: the key figures of the game. */
export const adminOverviewSchema = z.object({
  players: z.object({
    members: z.int().nonnegative(),
    guests: z.int().nonnegative(),
    banned: z.int().nonnegative(),
    newMembers7d: z.int().nonnegative(),
    newGuests7d: z.int().nonnegative(),
  }),
  boosters: z.object({ last24h: z.int().nonnegative(), last7d: z.int().nonnegative() }),
  answers: z.object({ last24h: z.int().nonnegative(), last7d: z.int().nonnegative() }),
  trades: z.object({ pending: z.int().nonnegative(), completed7d: z.int().nonnegative() }),
  waitlist: z.object({ total: z.int().nonnegative(), last7d: z.int().nonnegative() }),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminPlayerKindSchema = z.enum(["member", "guest", "banned", "admin", "all"]);
export type AdminPlayerKind = z.infer<typeof adminPlayerKindSchema>;

/** Columns the player list sorts by. */
export const adminPlayerSortSchema = z.enum([
  "created",
  "lastDay",
  "pseudo",
  "level",
  "cards",
  "boosters",
  "answers",
  "days",
]);
export type AdminPlayerSort = z.infer<typeof adminPlayerSortSchema>;

export const sortDirectionSchema = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

/**
 * `GET /admin/players` query: `q` matches part of an address or a pseudo, a player code or an id.
 * A cursor only reads with the sort it was made with.
 */
export const adminPlayersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  kind: adminPlayerKindSchema.default("member"),
  sort: adminPlayerSortSchema.default("created"),
  dir: sortDirectionSchema.default("desc"),
  cursor: cursorQuery,
});
export type AdminPlayersQuery = z.input<typeof adminPlayersQuerySchema>;

export const adminPlayerSummarySchema = z.object({
  id: z.string(),
  /** null for a guest. */
  email: z.string().nullable(),
  /** null until the player picks one. */
  pseudo: z.string().nullable(),
  isGuest: z.boolean(),
  isAdmin: z.boolean(),
  banned: z.boolean(),
  playerCode: z.string().nullable(),
  level: z.int().positive(),
  createdAt: timestampSchema,
});
export type AdminPlayerSummary = z.infer<typeof adminPlayerSummarySchema>;

/** A row of the player list: the summary and what the player has done. */
export const adminPlayerRowSchema = adminPlayerSummarySchema.extend({
  /** Distinct cards owned. */
  cards: z.int().nonnegative(),
  boosters: z.int().nonnegative(),
  answers: z.int().nonnegative(),
  /** Days the player opened the game. */
  days: z.int().nonnegative(),
  /** Last day they opened the game, Paris time; null if never. */
  lastDay: z.iso.date().nullable(),
});
export type AdminPlayerRow = z.infer<typeof adminPlayerRowSchema>;

/** `GET /admin/players`, 200. */
export const adminPlayersResponseSchema = z.object({
  players: z.array(adminPlayerRowSchema),
  /** Players matching the search and the kind, all pages together. */
  total: z.int().nonnegative(),
  nextCursor: z.string().nullable(),
});
export type AdminPlayersResponse = z.infer<typeof adminPlayersResponseSchema>;

export const adminActionSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  adminEmail: z.string(),
  targetUserId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  createdAt: timestampSchema,
});
export type AdminAction = z.infer<typeof adminActionSchema>;

/** `GET /admin/players/:id`, 200; 404 `player_not_found`. */
export const adminPlayerDetailSchema = z.object({
  player: adminPlayerSummarySchema.extend({
    banReason: z.string().nullable(),
    banExpires: timestampSchema.nullable(),
    /** Set for a guest whose game went to an account, or that was abandoned. */
    archivedInto: z.string().nullable(),
  }),
  wallet: z.object({
    stored: z.int().nonnegative(),
    capacity: z.int().positive(),
    nextRefillAt: timestampSchema.nullable(),
    bonus: z.int().nonnegative(),
    bonusCap: z.int().nonnegative(),
  }),
  progress: progressSchema,
  collection: z.object({
    distinctCards: z.int().nonnegative(),
    copies: z.int().nonnegative(),
    byRarity: z.partialRecord(raritySchema, z.int().nonnegative()),
  }),
  mastery: z.object({
    words: z.int().nonnegative(),
    ink: z.int().nonnegative(),
    gilded: z.int().nonnegative(),
  }),
  opens: z.object({
    total: z.int().nonnegative(),
    recent: z.array(
      z.object({
        openedAt: timestampSchema,
        collectionId: slugSchema.nullable(),
        fromBonus: z.boolean(),
      }),
    ),
  }),
  trades: z.object({ total: z.int().nonnegative(), pending: z.int().nonnegative() }),
  actions: z.array(adminActionSchema),
});
export type AdminPlayerDetail = z.infer<typeof adminPlayerDetailSchema>;

/** `POST /admin/players/:id/bonus` (Idempotency-Key required). */
export const adminGrantBonusRequestSchema = z.object({
  amount: z.int().min(1).max(10),
  reason: reasonSchema,
});
export type AdminGrantBonusRequest = z.infer<typeof adminGrantBonusRequestSchema>;

/** 200: `added` can be less than asked, the reserve being capped. */
export const adminGrantBonusResponseSchema = z.object({
  added: z.int().nonnegative(),
  bonus: z.int().nonnegative(),
});
export type AdminGrantBonusResponse = z.infer<typeof adminGrantBonusResponseSchema>;

/** `POST /admin/players/:id/ban`: `days` null bans until lifted. 409 `cannot_ban_admin`. */
export const adminBanRequestSchema = z.object({
  reason: reasonSchema,
  days: z.int().min(1).max(3650).nullable(),
});
export type AdminBanRequest = z.infer<typeof adminBanRequestSchema>;

/** `GET /admin/waitlist`, 200. The CSV export is `GET /admin/waitlist/export`. */
export const adminWaitlistResponseSchema = z.object({
  total: z.int().nonnegative(),
  entries: z.array(z.object({ email: z.string(), createdAt: timestampSchema })),
  nextCursor: z.string().nullable(),
  /** The opening e-mail, once a campaign to the list exists. */
  opening: adminWaitlistOpeningSchema.nullable(),
});
export type AdminWaitlistResponse = z.infer<typeof adminWaitlistResponseSchema>;

export const adminTradesQuerySchema = z.object({
  status: tradeStatusSchema.optional(),
  cursor: cursorQuery,
});

const tradeParty = z.object({
  id: z.string(),
  email: z.string().nullable(),
  playerCode: z.string().nullable(),
});

export const adminTradeSchema = z.object({
  id: z.uuid(),
  status: tradeStatusSchema,
  proposer: tradeParty,
  recipient: tradeParty,
  give: z.array(slugSchema),
  want: z.array(slugSchema),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  resolvedAt: timestampSchema.nullable(),
});
export type AdminTrade = z.infer<typeof adminTradeSchema>;

/** `GET /admin/trades`, 200. */
export const adminTradesResponseSchema = z.object({
  trades: z.array(adminTradeSchema),
  nextCursor: z.string().nullable(),
});
export type AdminTradesResponse = z.infer<typeof adminTradesResponseSchema>;

/** `POST /admin/trades/:id/cancel`: 404 `trade_not_found`, 409 `trade_not_pending`. */
export const adminCancelTradeRequestSchema = z.object({ reason: reasonSchema });

/** `GET /admin/catalog`, 200: the catalogue as the server draws from it. */
export const adminCatalogSchema = z.object({
  collections: z.array(
    z.object({
      id: slugSchema,
      name: z.string(),
      published: z.boolean(),
      cards: z.int().nonnegative(),
      retired: z.int().nonnegative(),
      byRarity: z.partialRecord(raritySchema, z.int().nonnegative()),
      /** Players owning at least one card of the collection. */
      collectors: z.int().nonnegative(),
    }),
  ),
});
export type AdminCatalog = z.infer<typeof adminCatalogSchema>;

/**
 * `GET /admin/cards/:id`, 200: how a card lives in the game. Its text comes from the static
 * catalogue, like everywhere else. 404 `card_not_found` when the server does not know the card.
 */
export const adminCardStatsSchema = z.object({
  retired: z.boolean(),
  /** Players owning at least one copy. */
  owners: z.int().nonnegative(),
  copies: z.int().nonnegative(),
  mastery: z.object({
    learners: z.int().nonnegative(),
    ink: z.int().nonnegative(),
    gilded: z.int().nonnegative(),
  }),
});
export type AdminCardStats = z.infer<typeof adminCardStatsSchema>;

/** `GET /admin/actions`, 200: the audit log, newest first. */
export const adminActionsResponseSchema = z.object({
  actions: z.array(adminActionSchema),
  nextCursor: z.string().nullable(),
});
export type AdminActionsResponse = z.infer<typeof adminActionsResponseSchema>;

/** Names of the actions logged in `admin_actions`. */
export const ADMIN_ACTIONS = {
  grantBonus: "grant_bonus",
  ban: "ban",
  unban: "unban",
  cancelTrade: "cancel_trade",
  exportWaitlist: "export_waitlist",
  launchCampaign: "launch_campaign",
  pauseCampaign: "pause_campaign",
  resumeCampaign: "resume_campaign",
  cancelCampaign: "cancel_campaign",
  eraseWaitlist: "erase_waitlist",
  dismissReport: "dismiss_report",
  sanction: "sanction",
  resolveContest: "resolve_contest",
} as const;
