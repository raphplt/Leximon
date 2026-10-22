import { CLAN_ENTRY_MODES, CLAN_ROLES, GOAL_TIERS, type GoalTier } from "@leximon/core";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const clanEntryMode = pgEnum("clan_entry_mode", CLAN_ENTRY_MODES);
export const clanRole = pgEnum("clan_role", CLAN_ROLES);
export const goalTier = pgEnum("goal_tier", GOAL_TIERS);
export const clanMessageKind = pgEnum("clan_message_kind", ["message", "event"]);

/**
 * A clan. `memberCount` follows the members in the same transactions, under the clan's
 * row lock, so the list of clans never counts rows.
 */
export const clans = pgTable(
  "clans",
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    /** `pseudoKey` of the name: unique, "Les Plumes" and "les-plumes" are one clan. */
    nameKey: text().notNull(),
    motto: text().notNull().default(""),
    entryMode: clanEntryMode().notNull(),
    /** 8 characters of Crockford base 32, renewed by the chief. */
    inviteCode: text().notNull(),
    emblemEngraving: text().notNull(),
    emblemColor: text().notNull(),
    emblemAccent: text().notNull(),
    memberCount: integer().notNull().default(0),
    /** The clan's own XP: the sum of its weeks' XP, recounted with the current week. */
    xp: integer().notNull().default(0),
    /** Last recount of the library by the queue, to space recounts out. */
    libraryCountedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("clans_name_key_idx").on(table.nameKey),
    uniqueIndex("clans_invite_code_idx").on(table.inviteCode),
    // "Trouver un clan": by name prefix, and the biggest first.
    index("clans_name_prefix_idx").using("btree", sql`${table.nameKey} text_pattern_ops`),
    index("clans_members_idx").on(table.memberCount.desc(), table.id),
    check("clans_member_count_check", sql`${table.memberCount} >= 0`),
  ],
);

/** One clan per player: the player is the key. */
export const clanMembers = pgTable(
  "clan_members",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    clanId: uuid()
      .notNull()
      .references(() => clans.id, { onDelete: "cascade" }),
    role: clanRole().notNull(),
    joinedAt: timestamp({ withTimezone: true }).notNull(),
    /** Silenced by the chief or a deputy until then. */
    mutedUntil: timestamp({ withTimezone: true }),
    /** For the pace of the discussion. */
    lastMessageAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("clan_members_clan_idx").on(table.clanId, table.joinedAt),
    uniqueIndex("clan_members_one_chief_idx").on(table.clanId).where(sql`${table.role} = 'chief'`),
  ],
);

/** Requests to enter a clan "sur demande". Joining any clan drops the player's other requests. */
export const clanJoinRequests = pgTable(
  "clan_join_requests",
  {
    clanId: uuid()
      .notNull()
      .references(() => clans.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.clanId, table.userId] }),
    index("clan_join_requests_user_idx").on(table.userId),
  ],
);

/** The journal's events, written by the server; the shape depends on `type`. */
export type ClanEventPayload =
  | { readonly type: "joined"; readonly userId: string }
  | { readonly type: "left"; readonly userId: string }
  | { readonly type: "excluded"; readonly userId: string }
  | { readonly type: "role"; readonly userId: string; readonly role: "chief" | "deputy" | "member" }
  | { readonly type: "legendary"; readonly userId: string; readonly cardId: string }
  | { readonly type: "tier"; readonly week: string; readonly tier: GoalTier }
  | { readonly type: "level"; readonly level: number }
  | { readonly type: "renamed"; readonly name: string };

/** A member named in a message: the range covers the "@" and the pseudo. */
export interface ClanMention {
  readonly userId: string;
  readonly start: number;
  readonly end: number;
}

/**
 * The clan's discussion and journal, read by cursor on `id`. Erased after 90 days unless
 * reported and not yet handled. A deleted or hidden message keeps its row, without its text.
 */
export const clanMessages = pgTable(
  "clan_messages",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clanId: uuid()
      .notNull()
      .references(() => clans.id, { onDelete: "cascade" }),
    kind: clanMessageKind().notNull(),
    /** `null` for an event, or once the author deleted their account. */
    authorId: text().references(() => users.id, { onDelete: "set null" }),
    body: text(),
    event: jsonb().$type<ClanEventPayload>(),
    /** Writes an event once even when the queue replays a message. */
    eventKey: text(),
    /** Members named with "@" when it was sent, for the highlight and their mail. */
    mentions: jsonb().$type<readonly ClanMention[]>(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    /** Removed by the chief, a deputy or its author. */
    deletedAt: timestamp({ withTimezone: true }),
    deletedBy: text().references(() => users.id, { onDelete: "set null" }),
    /** Hidden by the team. */
    hiddenAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("clan_messages_clan_idx").on(table.clanId, table.id.desc()),
    uniqueIndex("clan_messages_event_idx")
      .on(table.clanId, table.eventKey)
      .where(sql`${table.eventKey} is not null`),
    index("clan_messages_created_idx").on(table.createdAt),
    check("clan_messages_kind_check", sql`(${table.kind} = 'message') = (${table.event} is null)`),
  ],
);

/** A clan's week: the targets fixed when it starts, and the answers counted so far. */
export const clanWeeks = pgTable(
  "clan_weeks",
  {
    clanId: uuid()
      .notNull()
      .references(() => clans.id, { onDelete: "cascade" }),
    /** The Monday in Paris, "2026-10-19" (`gameWeekOf`). */
    week: text().notNull(),
    activeMembers: integer().notNull(),
    bronze: integer().notNull(),
    silver: integer().notNull(),
    gold: integer().notNull(),
    /** The fourth target, `null` when the clan's level had not opened it when the week started. */
    illuminated: integer(),
    /** Correct challenge answers of the members, summed from `clan_week_members`. */
    answers: integer().notNull().default(0),
    /** Clan XP the week brings: answers up to each member's cap, then the tiers reached. */
    xp: integer().notNull().default(0),
    tier: goalTier(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.clanId, table.week] })],
);

/** Each member's correct answers for the clan's week. */
export const clanWeekMembers = pgTable(
  "clan_week_members",
  {
    clanId: uuid()
      .notNull()
      .references(() => clans.id, { onDelete: "cascade" }),
    week: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Correct challenge answers given this week since joining, recounted from `review_logs`. */
    answers: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.clanId, table.week, table.userId] }),
    index("clan_week_members_user_idx").on(table.userId, table.week),
  ],
);

/**
 * Boosters claimed from weekly goals. The key leaves out the clan: at most one claim per
 * tier and week, even after changing clans.
 */
export const clanGoalClaims = pgTable(
  "clan_goal_claims",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    week: text().notNull(),
    tier: goalTier().notNull(),
    clanId: uuid().notNull(),
    boosters: integer().notNull(),
    claimedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.week, table.tier] })],
);

/** The clan's library: cards of each collection held by at least one member. */
export const clanLibrary = pgTable(
  "clan_library",
  {
    clanId: uuid()
      .notNull()
      .references(() => clans.id, { onDelete: "cascade" }),
    collectionId: text().notNull(),
    owned: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.clanId, table.collectionId] })],
);
