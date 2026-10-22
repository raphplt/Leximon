import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Closed beta and its measures. Everything here comes from the game itself: no tracker, no
 * third party. Rows go with the player when their account is deleted.
 */

/**
 * An invitation link (`/invitation/{code}`), one per group of testers. Never deleted: players keep
 * pointing at the link they came by. `uses` is raised by a single conditional update, so that two
 * sign-ups at once never take more places than `max_uses`.
 */
export const invites = pgTable("invites", {
  id: uuid().primaryKey().defaultRandom(),
  /** Lowercase, as the contract normalises it. */
  code: text().notNull().unique(),
  /** What the admin calls the group ("Amis", "LinkedIn"): shown in the measures. */
  label: text().notNull(),
  maxUses: integer().notNull(),
  uses: integer().default(0).notNull(),
  expiresAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  createdBy: text()
    .notNull()
    .references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/**
 * How a player first arrived: the invitation they used and the `?src=` of their first link. One
 * row per player who came after the beta opened, written with the guest (or the account, when it
 * is created without a guest) and moved with the guest's game.
 */
export const playerSignups = pgTable(
  "player_signups",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteId: uuid().references(() => invites.id),
    source: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("player_signups_invite_idx").on(table.inviteId)],
);

/** Age bracket declared freely with a new account. Accounts only: a guest declares nothing. */
export const playerAgeBrackets = pgTable("player_age_brackets", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  bracket: text().notNull(),
  declaredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/**
 * One row per player and per day they opened the game (Paris time), the basis of retention. The
 * first row of a player is the day they arrived.
 */
export const playerDays = pgTable(
  "player_days",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.day] }),
    index("player_days_day_idx").on(table.day),
  ],
);

/** A tester's note, written from a screen of the game, read in the back office. */
export const playerFeedback = pgTable(
  "player_feedback",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    screen: text().notNull(),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("player_feedback_created_idx").on(table.createdAt.desc(), table.id.desc()),
    index("player_feedback_unread_idx").on(table.createdAt).where(sql`${table.readAt} is null`),
  ],
);

/** Interest in an offer not sold yet (`patron_door`, `patron_notify`): the first date only. */
export const playerInterest = pgTable(
  "player_interest",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.kind] })],
);
