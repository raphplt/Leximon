import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Waiting list before the public beta: an address to warn when the game opens, nothing promised
 * beyond that. Kept apart from `users`: joining the list creates no player and no session.
 */
export const waitlistSignups = pgTable("waitlist_signups", {
  /** Lowercase, as the contract normalises it: one row per address. */
  email: text().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
