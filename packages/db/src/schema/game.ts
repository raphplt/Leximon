import { type PityCounters, RARITIES } from "@leximon/core";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const rarity = pgEnum("rarity", RARITIES);

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

/** One row per player, locked (`SELECT … FOR UPDATE`) while a booster is opened. */
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
  },
  (table) => [
    check("booster_wallets_stored_check", sql`${table.stored} >= 0`),
    check("booster_wallets_progress_check", sql`${table.progressMs} >= 0`),
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
