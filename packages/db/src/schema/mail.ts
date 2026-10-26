import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const MAIL_KINDS = [
  "offer_received",
  "offer_completed",
  "offer_declined",
  "clan_mention",
  "clan_request",
  "friend_request",
  "friend_accepted",
  "referral_arrived",
  "referral_qualified",
  "friend_reaction",
] as const;
export const mailKind = pgEnum("mail_kind", MAIL_KINDS);

/** What a letter points to; the players and texts are read when the mail is. */
export type MailPayload =
  | { readonly tradeId: string; readonly playerId: string | null }
  | { readonly clanId: string; readonly messageId: number; readonly playerId: string | null }
  | { readonly clanId: string; readonly playerId: string }
  | { readonly playerId: string }
  | { readonly eventId: number; readonly playerId: string };

/**
 * The player's mail: news written by the queue's consumer (an offer received or answered, a
 * mention in the clan, a request to enter it). What waits in the game's state (coffrets, goal
 * boosters) is not stored here. `dedupeKey` writes each letter once when the queue replays a
 * message. Erased after 90 days.
 */
export const mailLetters = pgTable(
  "mail_letters",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mailKind().notNull(),
    payload: jsonb().$type<MailPayload>().notNull(),
    dedupeKey: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    readAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("mail_letters_dedupe_idx").on(table.userId, table.dedupeKey),
    index("mail_letters_user_idx").on(table.userId, table.id.desc()),
    index("mail_letters_unread_idx").on(table.userId).where(sql`${table.readAt} is null`),
    index("mail_letters_created_idx").on(table.createdAt),
  ],
);

/**
 * E-mails that tell a player about their game: `news` (letters wait unread) and `reminder` (the
 * player stays away while their sachets are full). The row is claimed before sending, so that a
 * replayed message never sends twice: one of each kind per player and per day in Paris, which
 * the unique index enforces. Its id signs the unsubscribe link. Erased after 90 days.
 */
export const notificationEmails = pgTable(
  "notification_emails",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `news` or `reminder`. */
    kind: text().notNull(),
    /** Day in Paris the e-mail belongs to. */
    day: date({ mode: "string" }).notNull(),
    /** `sending`, then `sent` or `failed`. */
    status: text().default("sending").notNull(),
    /** The provider's error code, never its message nor the address. */
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("notification_emails_once_idx").on(table.userId, table.kind, table.day),
    // The day's count, against the daily budget.
    index("notification_emails_day_idx").on(table.day),
    index("notification_emails_created_idx").on(table.createdAt),
    check("notification_emails_kind_check", sql`${table.kind} in ('news', 'reminder')`),
    check(
      "notification_emails_status_check",
      sql`${table.status} in ('sending', 'sent', 'failed')`,
    ),
  ],
);
