import {
  BONUS_KINDS,
  CHALLENGE_FORMATS,
  type GuestLinkOutcome,
  type LevelReward,
  MASTERY_LEVELS,
  type PityCounters,
  RARITIES,
  SANCTION_KINDS,
} from "@leximon/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
 * Collections: sets of cards, each with its own booster. A collection becomes openable once
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

/** Themes cut across collections: odd words, old insults… Used for albums and events. */
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
    /** Of `bonusBoosters`, the garni ones won by level, spent first. */
    garniBoosters: integer().notNull().default(0),
    /** Places added to the reserve cap by level rewards. */
    reserveSlots: smallint().notNull().default(0),
    /** Day in Paris of the last booster opened: the first one of a day earns more XP. */
    lastOpenedDay: date({ mode: "string" }),
    /** Days in Paris with at least one booster opened, for the profile. */
    daysPlayed: integer().notNull().default(0),
  },
  (table) => [
    check("booster_wallets_stored_check", sql`${table.stored} >= 0`),
    check("booster_wallets_progress_check", sql`${table.progressMs} >= 0`),
    check("booster_wallets_bonus_check", sql`${table.bonusBoosters} >= 0`),
    check(
      "booster_wallets_garni_check",
      sql`${table.garniBoosters} >= 0 and ${table.garniBoosters} <= ${table.bonusBoosters}`,
    ),
    check("booster_wallets_reserve_slots_check", sql`${table.reserveSlots} >= 0`),
  ],
);

/**
 * Account level: the experience earned, one row per player, created by the first action
 * that earns any. The level is derived from it (`levelOf` in core), never stored.
 */
export const userProgress = pgTable(
  "user_progress",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    xp: integer().notNull().default(0),
  },
  (table) => [check("user_progress_xp_check", sql`${table.xp} >= 0`)],
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

/**
 * Level rewards claimed, one row per level: the primary key makes a claim happen once, and
 * `rewards` keeps what it gave under the rules in force.
 */
export const userLevelRewards = pgTable(
  "user_level_rewards",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: smallint().notNull(),
    rewards: jsonb().$type<readonly LevelReward[]>().notNull(),
    claimedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.level] }),
    check("user_level_rewards_level_check", sql`${table.level} >= 2`),
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
    /** Last copy gained (booster or trade): rare cards are tradeable only a while after. */
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
    /** A garni booster: its last card was at least the garni rarity of the rules. */
    garni: boolean().notNull().default(false),
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

/**
 * Public identity of a player: the code they share to receive trade offers, and their
 * profile. Cosmetics are checked against the coffrets claimed when
 * they are chosen; `null` wears the default (a starting avatar, the latest title).
 */
export const players = pgTable(
  "players",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 8 characters of Crockford base 32, e.g. "K7QF2M9D". Unique, never reused. */
    code: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /** As the player wrote it (filtered). Members only; `null` until chosen. */
    pseudo: text(),
    /** `pseudoKey` in core: lower case, no accents nor separators. Unique. */
    pseudoKey: text(),
    pseudoChangedAt: timestamp({ withTimezone: true }),
    /** Card id of the engraved avatar worn. */
    avatar: text(),
    frame: text(),
    title: text(),
    /** public by default; private shows only the pseudo and the avatar to others. */
    profilePublic: boolean().notNull().default(true),
    /** Last request, to the nearest few minutes: "online" and "seen 2 days ago" in a clan. */
    lastSeenAt: timestamp({ withTimezone: true }),
    /** When the player last left a clan of their own will: 24 h before joining another. */
    clanLeftAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("players_pseudo_key_idx").on(table.pseudoKey),
    check(
      "players_pseudo_check",
      sql`(${table.pseudo} is null) = (${table.pseudoKey} is null) and (${table.pseudo} is null) = (${table.pseudoChangedAt} is null)`,
    ),
  ],
);

/**
 * Cards pinned to a profile: owned cards only. A trade that takes the last copy unpins the
 * card in the same transaction.
 */
export const pinnedCards = pgTable(
  "pinned_cards",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: text()
      .notNull()
      .references(() => cards.id),
    /** Place on the profile, from 0. */
    position: smallint().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cardId] }),
    uniqueIndex("pinned_cards_position_idx").on(table.userId, table.position),
    check("pinned_cards_position_check", sql`${table.position} >= 0`),
  ],
);

/** A player blocked by another: no offer either way, and they disappear from each other. */
export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    // For "is this player blocked by the other one", read from the blocked side.
    index("user_blocks_blocked_idx").on(table.blockedId),
    check("user_blocks_not_self_check", sql`${table.blockerId} <> ${table.blockedId}`),
  ],
);

export const reportTarget = pgEnum("report_target", ["pseudo", "clan_name", "message"]);
export const reportResolution = pgEnum("report_resolution", ["dismissed", "sanctioned"]);

/**
 * Reports of what a player wrote: a pseudo, a clan name or motto, a message. `content` keeps
 * the text as it was reported, since it may change in between; `pseudo` the author's pseudo then.
 * One report per reporter and target (`targetKey`: the pseudo, the clan id, the message id).
 */
export const moderationReports = pgTable(
  "moderation_reports",
  {
    id: uuid().primaryKey(),
    reporterId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pseudo: text().notNull(),
    targetKind: reportTarget().notNull().default("pseudo"),
    targetKey: text().notNull(),
    /** The reported text, for a clan name or a message. */
    content: text(),
    clanId: uuid(),
    /** No foreign key: a reported message is kept until its report is handled. */
    messageId: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedBy: text().references(() => users.id),
    resolution: reportResolution(),
  },
  (table) => [
    uniqueIndex("moderation_reports_target_once_idx").on(
      table.reporterId,
      table.targetKind,
      table.targetKey,
    ),
    index("moderation_reports_open_idx")
      .on(table.createdAt)
      .where(sql`${table.resolvedAt} is null`),
    index("moderation_reports_reported_idx").on(table.reportedId),
    index("moderation_reports_message_idx")
      .on(table.messageId)
      .where(sql`${table.messageId} is not null`),
    check(
      "moderation_reports_resolution_check",
      sql`(${table.resolvedAt} is null) = (${table.resolution} is null)`,
    ),
  ],
);

export const sanctionKind = pgEnum("sanction_kind", SANCTION_KINDS);
export const contestOutcome = pgEnum("contest_outcome", ["upheld", "revoked"]);

/**
 * Sanctions decided by the team, each with its reason, shown to the player and contestable.
 * Rows are never deleted while the account exists: a lifted sanction gets `revokedAt`.
 */
export const sanctions = pgTable(
  "sanctions",
  {
    id: uuid().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: sanctionKind().notNull(),
    /** Shown to the player as it is written: what they did and which rule it breaks. */
    reason: text().notNull(),
    /** End of a timed sanction (mute, trade ban, suspension). */
    until: timestamp({ withTimezone: true }),
    reportId: uuid().references(() => moderationReports.id, { onDelete: "set null" }),
    messageId: integer(),
    clanId: uuid(),
    createdBy: text()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    /** The player saw it in the game. */
    seenAt: timestamp({ withTimezone: true }),
    contestedAt: timestamp({ withTimezone: true }),
    contestText: text(),
    contestResolvedAt: timestamp({ withTimezone: true }),
    contestOutcome: contestOutcome(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("sanctions_user_idx").on(table.userId, table.createdAt.desc()),
    index("sanctions_contested_idx")
      .on(table.contestedAt)
      .where(sql`${table.contestedAt} is not null and ${table.contestResolvedAt} is null`),
    check(
      "sanctions_until_check",
      sql`(${table.until} is not null) = (${table.kind} in ('mute', 'trade_ban', 'suspend'))`,
    ),
    check(
      "sanctions_contest_check",
      sql`(${table.contestedAt} is null) = (${table.contestText} is null)`,
    ),
  ],
);

/**
 * What the player wants to be told. Read by the notifications once the queue exists; a
 * player without a row gets everything.
 */
export const userPreferences = pgTable("user_preferences", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notifyReviews: boolean().notNull().default(true),
  notifyTrades: boolean().notNull().default(true),
  /** Only when someone names the player in the clan's discussion. */
  notifyClanMentions: boolean().notNull().default(true),
});

/**
 * Mastery of a word, per player, never traded. Holds the FSRS memory state; locked
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
 * Trade offers: a proposer gives some duplicates to a recipient for some of theirs.
 * Nothing is reserved while the offer waits; acceptance checks and moves everything at once.
 * A deleted account leaves its side `null`: the other player keeps their history. Its
 * pending offers are cancelled first, so a pending offer always has both players.
 */
export const trades = pgTable(
  "trades",
  {
    id: uuid().primaryKey(),
    proposerId: text().references(() => users.id, { onDelete: "set null" }),
    recipientId: text().references(() => users.id, { onDelete: "set null" }),
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
 * Guests archived by a sign-in: the guest is never deleted, its game moved to a new
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
