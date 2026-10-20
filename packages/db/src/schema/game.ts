import {
  BONUS_KINDS,
  CHALLENGE_FORMATS,
  type GuestLinkOutcome,
  MASTERY_LEVELS,
  type PityCounters,
  RARITIES,
} from "@leximon/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const rarity = pgEnum("rarity", RARITIES);
export const masteryLevel = pgEnum("mastery_level", MASTERY_LEVELS);
export const challengeFormat = pgEnum("challenge_format", CHALLENGE_FORMATS);
export const boosterBonusKind = pgEnum("booster_bonus_kind", BONUS_KINDS);
/** "expired" is never stored: a pending offer past `expires_at` is expired (no scheduled task). */
export const tradeStatus = pgEnum("trade_status", [
  "pending",
  "completed",
  "declined",
  "cancelled",
]);
export const guestLinkOutcome = pgEnum("guest_link_outcome", [
  "transfer",
  "abandon",
] as const satisfies readonly GuestLinkOutcome[]);
/** Side of a trade item, seen from the proposer: cards given, cards wanted in return. */
export const tradeSide = pgEnum("trade_side", ["give", "want"]);

/**
 * Collections: sets of cards, each with its own booster (P14). A collection becomes openable once
 * published; cards of unpublished collections never appear in any booster.
 */
export const collections = pgTable("collections", {
  /** Stable slug, e.g. "grand-siecle". Never reused. */
  id: text().primaryKey(),
  name: text().notNull(),
  /** Openable from this moment. `null` while the collection is being prepared. */
  publishedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/**
 * Cards known to the game. The full card content (definition, illustration…) lives in the
 * published catalog on the CDN; this table holds what the server needs to draw and own cards.
 */
export const cards = pgTable(
  "cards",
  {
    /** Stable slug, e.g. "galimatias". Never reused. */
    id: text().primaryKey(),
    lemma: text().notNull(),
    /** Frozen once published (enforced by a trigger): a re-tiered word becomes a new card. */
    rarity: rarity().notNull(),
    /** Every card belongs to exactly one collection, whatever booster it comes from. */
    collectionId: text()
      .notNull()
      .references(() => collections.id),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /** A retired card leaves the booster pools; copies already owned stay. */
    retiredAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("cards_drawable_idx").on(table.rarity).where(sql`${table.retiredAt} is null`),
    index("cards_collection_drawable_idx")
      .on(table.collectionId, table.rarity)
      .where(sql`${table.retiredAt} is null`),
  ],
);

/** Themes cut across collections (P16): odd words, old insults… Used for albums and events. */
export const themes = pgTable("themes", {
  /** Stable slug, e.g. "insultes". */
  id: text().primaryKey(),
  name: text().notNull(),
});

export const cardThemes = pgTable(
  "card_themes",
  {
    cardId: text()
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    themeId: text()
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.cardId, table.themeId] }),
    index("card_themes_theme_idx").on(table.themeId),
  ],
);

/**
 * One row per player, locked (`SELECT … FOR UPDATE`) while a booster is opened or a challenge
 * answered. Lock order: this row first, before any other row of the player.
 */
export const boosterWallets = pgTable(
  "booster_wallets",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    stored: integer().notNull(),
    progressMs: integer().notNull(),
    asOf: timestamp({ withTimezone: true }).notNull(),
    /** Boosters in a row without each guaranteed rarity, e.g. {"epic": 3, "legendary": 41}. */
    pityCounters: jsonb().$type<PityCounters>().notNull().default({}),
    /** Bonus boosters earned through challenges: spent only when the free stock is empty. */
    bonusBoosters: integer().notNull().default(0),
  },
  (table) => [
    check("booster_wallets_stored_check", sql`${table.stored} >= 0`),
    check("booster_wallets_progress_check", sql`${table.progressMs} >= 0`),
    check("booster_wallets_bonus_check", sql`${table.bonusBoosters} >= 0`),
  ],
);

/**
 * Bonus boosters awarded, one row per award: the primary key makes each award happen once (the
 * daily goal once a day, the gilding once per card), and the rows keep what was lost to the cap.
 */
export const boosterBonusAwards = pgTable(
  "booster_bonus_awards",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: boosterBonusKind().notNull(),
    /** The day in Paris for "daily" (e.g. "2026-10-20"), the card id for "gilded". */
    awardKey: text().notNull(),
    /** Bonus boosters earned, per the rules in force. */
    amount: smallint().notNull(),
    /** Part of `amount` added to the reserve; the rest was lost to its cap. */
    credited: smallint().notNull(),
    /** Idempotency key of the challenge answer that earned it, to replay that answer. */
    challengeId: uuid().notNull(),
    awardedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind, table.awardKey] }),
    index("booster_bonus_awards_user_challenge_idx").on(table.userId, table.challengeId),
    check("booster_bonus_awards_amount_check", sql`${table.amount} > 0`),
    check(
      "booster_bonus_awards_credited_check",
      sql`${table.credited} >= 0 and ${table.credited} <= ${table.amount}`,
    ),
  ],
);

/** Copies owned, as quantities. Mastery lives elsewhere, per word: trading never affects it. */
export const userCards = pgTable(
  "user_cards",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: text()
      .notNull()
      .references(() => cards.id),
    /** "standard" until variants (alternative engraving, illumination…) are introduced. */
    variant: text().notNull().default("standard"),
    quantity: integer().notNull(),
    firstObtainedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /** Last copy gained (booster or trade): rare cards are tradeable only a while after (D-026). */
    lastObtainedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cardId, table.variant] }),
    check("user_cards_quantity_check", sql`${table.quantity} >= 0`),
  ],
);

/**
 * Audit log of every booster opened, partitioned by month on `opened_at` (see the migrations):
 * old months can be archived and dropped without touching recent data.
 */
export const boosterOpens = pgTable(
  "booster_opens",
  {
    id: uuid().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 128-bit seed (hex) that, with the same pool, reproduces the draw exactly. */
    seed: text().notNull(),
    /** Collection whose booster was opened; `null` for the discovery booster (whole catalog). */
    collectionId: text().references(() => collections.id),
    /** SHA-256 of the canonical card pool used, to check a replay used the same cards. */
    poolFingerprint: text().notNull(),
    pityCountersBefore: jsonb().$type<PityCounters>().notNull().default({}),
    cards: jsonb()
      .$type<readonly { cardId: string; rarity: (typeof RARITIES)[number] }[]>()
      .notNull(),
    /** Paid from the bonus reserve, the free stock being empty. */
    fromBonus: boolean().notNull().default(false),
    openedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    // The partition key must be part of the primary key.
    primaryKey({ columns: [table.id, table.openedAt] }),
    index("booster_opens_user_opened_idx").on(table.userId, table.openedAt.desc()),
  ],
);

/**
 * Idempotency keys of recent opens. Only needed while a client may retry: rows older than
 * 48 hours are purged by the daily maintenance.
 */
export const boosterOpenRequests = pgTable(
  "booster_open_requests",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    idempotencyKey: uuid().notNull(),
    openId: uuid().notNull(),
    openedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.idempotencyKey] }),
    foreignKey({
      columns: [table.openId, table.openedAt],
      foreignColumns: [boosterOpens.id, boosterOpens.openedAt],
    }).onDelete("cascade"),
    index("booster_open_requests_opened_idx").on(table.openedAt),
  ],
);

/** Public identity of a player: the code they share to receive trade offers (D-026). */
export const players = pgTable("players", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 8 characters of Crockford base 32, e.g. "K7QF2M9D". Unique, never reused. */
  code: text().notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/**
 * Mastery of a word (D-025), per player, never traded. Holds the FSRS memory state; locked
 * (`SELECT … FOR UPDATE`) while an answer is applied.
 */
export const userMastery = pgTable(
  "user_mastery",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: text()
      .notNull()
      .references(() => cards.id),
    level: masteryLevel().notNull().default("sketch"),
    due: timestamp({ withTimezone: true }).notNull(),
    stability: doublePrecision().notNull(),
    difficulty: doublePrecision().notNull(),
    scheduledDays: integer().notNull(),
    learningSteps: integer().notNull(),
    reps: integer().notNull(),
    lapses: integer().notNull(),
    /** FSRS state: 0 new, 1 learning, 2 review, 3 relearning. */
    state: smallint().notNull(),
    lastReviewedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cardId] }),
    index("user_mastery_due_idx").on(table.userId, table.due),
  ],
);

/**
 * Every challenge answer, partitioned by month on `reviewed_at` like `booster_opens`: the history
 * FSRS can be tuned on, and later the teachers' dashboards.
 */
export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: text()
      .notNull()
      .references(() => cards.id),
    /** Id of the signed challenge answered: an answer sent twice is applied once. */
    challengeId: uuid().notNull(),
    format: challengeFormat().notNull(),
    correct: boolean().notNull(),
    /** FSRS rating: 1 forgotten, 3 recalled. */
    rating: smallint().notNull(),
    levelAfter: masteryLevel().notNull(),
    reviewedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.reviewedAt] }),
    index("review_logs_user_challenge_idx").on(table.userId, table.challengeId),
    index("review_logs_user_reviewed_idx").on(table.userId, table.reviewedAt.desc()),
  ],
);

/**
 * Trade offers (D-026): a proposer gives some duplicates to a recipient for some of theirs.
 * Nothing is reserved while the offer waits; acceptance checks and moves everything at once.
 */
export const trades = pgTable(
  "trades",
  {
    id: uuid().primaryKey(),
    proposerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: tradeStatus().notNull().default("pending"),
    idempotencyKey: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check("trades_not_self_check", sql`${table.proposerId} <> ${table.recipientId}`),
    uniqueIndex("trades_proposer_idempotency_idx").on(table.proposerId, table.idempotencyKey),
    index("trades_proposer_created_idx").on(table.proposerId, table.createdAt.desc()),
    index("trades_recipient_created_idx").on(table.recipientId, table.createdAt.desc()),
  ],
);

export const tradeItems = pgTable(
  "trade_items",
  {
    tradeId: uuid()
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    side: tradeSide().notNull(),
    cardId: text()
      .notNull()
      .references(() => cards.id),
  },
  (table) => [primaryKey({ columns: [table.tradeId, table.side, table.cardId] })],
);

/**
 * Guests archived by a sign-in (P37, P54): the guest is never deleted, its game moved to a new
 * account (transfer) or left behind when the account already plays (abandon). One row per guest:
 * a guest links once, so a retried sign-in finds the row and does nothing. Also the audit of
 * sign-ins from a guest.
 */
export const guestLinks = pgTable(
  "guest_links",
  {
    guestId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outcome: guestLinkOutcome().notNull(),
    /** Copies the guest owned when it was linked. */
    cards: integer().notNull(),
    /** Words the guest had a mastery of when it was linked. */
    words: integer().notNull(),
    linkedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    // For the cascade when an account is deleted, like every other reference to users.id.
    index("guest_links_account_idx").on(table.accountId),
    check("guest_links_not_self_check", sql`${table.guestId} <> ${table.accountId}`),
    check("guest_links_counts_check", sql`${table.cards} >= 0 and ${table.words} >= 0`),
  ],
);
