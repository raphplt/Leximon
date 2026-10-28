import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { emailCampaigns } from "./email";

/**
 * Waiting list before the public beta: an address to warn when the game opens, nothing promised
 * beyond that. Kept apart from `users`: joining the list creates no player and no session.
 */
export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    /** Lowercase, as the contract normalises it: one row per address. */
    email: text().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /** When the address got an invitation to the closed beta, and by which campaign. */
    invitedAt: timestamp({ withTimezone: true }),
    inviteCampaignId: uuid().references(() => emailCampaigns.id, { onDelete: "set null" }),
  },
  (table) => [
    // The oldest addresses not yet invited are the next ones to invite.
    index("waitlist_signups_to_invite_idx")
      .on(table.createdAt, table.email)
      .where(sql`${table.invitedAt} is null`),
    index("waitlist_signups_campaign_idx")
      .on(table.inviteCampaignId)
      .where(sql`${table.inviteCampaignId} is not null`),
  ],
);
