import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
