import { FRIEND_REACTIONS } from "@leximon/core";
import { sql } from "drizzle-orm";
import {
  boolean,
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
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * A friendship, one row per direction, both written in the same transaction: a player's list
 * and their count read from their own rows, without an `or`.
 */
export const friendships = pgTable(
  "friendships",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.friendId] }),
    index("friendships_friend_idx").on(table.friendId),
    check("friendships_not_self_check", sql`${table.userId} <> ${table.friendId}`),
  ],
);

/**
 * A request to become friends. Waiting while not declined and younger than the rules' delay; a
 * refusal is kept for the delay before asking again, then erased by the maintenance. Accepting
 * deletes the row.
 */
export const friendRequests = pgTable(
  "friend_requests",
  {
    senderId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    declinedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.senderId, table.recipientId] }),
    index("friend_requests_recipient_idx").on(table.recipientId, table.createdAt.desc()),
    index("friend_requests_sender_created_idx").on(table.senderId, table.createdAt.desc()),
    check("friend_requests_not_self_check", sql`${table.senderId} <> ${table.recipientId}`),
  ],
);

/**
 * A player who came by another player's friend link: one inviter, for good. `qualifiedAt` is
 * when the invited player reached the referral level; `rewarded` says whether that month still
 * had room for a reward. Each side claims its bonus booster once.
 */
export const referrals = pgTable(
  "referrals",
  {
    refereeId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `null` once the inviter deleted their account. */
    referrerId: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    qualifiedAt: timestamp({ withTimezone: true }),
    /** Paris month of `qualifiedAt`, `YYYY-MM`, for the monthly cap. */
    qualifiedMonth: text(),
    rewarded: boolean().notNull().default(false),
    referrerClaimedAt: timestamp({ withTimezone: true }),
    refereeClaimedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index("referrals_referrer_idx").on(table.referrerId, table.qualifiedMonth)],
);

export const FRIEND_EVENT_KINDS = ["rare_find", "gilded", "level", "collection_complete"] as const;
export const friendEventKind = pgEnum("friend_event_kind", FRIEND_EVENT_KINDS);
export const friendReaction = pgEnum("friend_reaction", FRIEND_REACTIONS);

/** What a feed event points to; cards and collections are read from the catalogue. */
export type FriendEventPayload =
  | { readonly cardId: string }
  | { readonly level: number }
  | { readonly collectionId: string };

/**
 * What a player found, for their friends' feed: one row per author, read by joining the
 * reader's friends. `dedupeKey` writes each event once when the queue replays a message.
 * Erased after the rules' delay.
 */
export const friendFeedEvents = pgTable(
  "friend_feed_events",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: friendEventKind().notNull(),
    payload: jsonb().$type<FriendEventPayload>().notNull(),
    dedupeKey: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("friend_feed_events_dedupe_idx").on(table.userId, table.dedupeKey),
    index("friend_feed_events_user_idx").on(table.userId, table.id.desc()),
    index("friend_feed_events_created_idx").on(table.createdAt),
  ],
);

/** One fixed reaction per player and per feed event. */
export const friendReactions = pgTable(
  "friend_reactions",
  {
    eventId: integer()
      .notNull()
      .references(() => friendFeedEvents.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reaction: friendReaction().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.userId] }),
    index("friend_reactions_user_idx").on(table.userId),
  ],
);
