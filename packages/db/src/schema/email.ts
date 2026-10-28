import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * E-mail campaigns sent from the back office. The database is the only source of truth:
 * the queue carries row ids, so that a lost, replayed or duplicated message changes nothing.
 */

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    subject: text().notNull(),
    /** Reduced Markdown, rendered when sending. */
    bodyMarkdown: text().notNull(),
    /** One action per e-mail (`docs/voix.md`): an optional button, `https://` only. */
    buttonLabel: text(),
    buttonUrl: text(),
    /** `waitlist`, `players` (consenting players) or `test`. */
    audience: text().notNull(),
    /** Addresses of a `test` audience, lowercase. */
    testRecipients: text().array().default(sql`'{}'::text[]`).notNull(),
    /** `draft`, `scheduled`, `sending`, `paused`, `completed` or `cancelled`. */
    status: text().default("draft").notNull(),
    ratePerMinute: integer().default(1000).notNull(),
    /** Number of recipients when the launch was confirmed, after suppression. */
    recipientCount: integer(),
    createdBy: text()
      .notNull()
      .references(() => users.id),
    launchedBy: text().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    scheduledAt: timestamp({ withTimezone: true }),
    launchedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    /** Set by a provider's `Retry-After`: no batch leaves before. */
    holdUntil: timestamp({ withTimezone: true }),
    /** When the pump last handed rows to the queue: a second pump in the same minute skips it. */
    lastQueuedAt: timestamp({ withTimezone: true }),
    /** Waiting list campaign only: when the addresses were erased. */
    waitlistErasedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("email_campaigns_created_idx").on(table.createdAt.desc()),
    index("email_campaigns_active_idx")
      .on(table.status)
      .where(sql`${table.status} in ('scheduled', 'sending')`),
    // The waiting list is written to once. Enforced here, not by the screens.
    uniqueIndex("email_campaigns_waitlist_once_idx")
      .on(table.audience)
      .where(sql`${table.audience} = 'waitlist' and ${table.launchedAt} is not null`),
    check(
      "email_campaigns_audience_check",
      sql`${table.audience} in ('waitlist', 'players', 'test')`,
    ),
    check(
      "email_campaigns_status_check",
      sql`${table.status} in ('draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled')`,
    ),
    check("email_campaigns_rate_check", sql`${table.ratePerMinute} between 10 and 5000`),
  ],
);

/**
 * One row per recipient of a launched campaign. Its id is the idempotency key given to the
 * provider and the target of the unsubscribe link, so the address never appears in a URL.
 */
export const emailCampaignSends = pgTable(
  "email_campaign_sends",
  {
    id: uuid().primaryKey().defaultRandom(),
    campaignId: uuid()
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    /** Lowercase. Erased 30 days after the campaign ends, or with the waiting list. */
    email: text(),
    /** The player, for a `players` campaign: unsubscribing withdraws their consent. */
    userId: text().references(() => users.id, { onDelete: "set null" }),
    /**
     * `pending` → `queued` → `sending` → `sent`, or `failed`, `bounced`, `complained`,
     * `suppressed` (opted out since the launch), `cancelled`.
     */
    status: text().default("pending").notNull(),
    attempts: integer().default(0).notNull(),
    /** When the row was last queued or claimed: a stale claim is put back in circulation. */
    claimedAt: timestamp({ withTimezone: true }),
    sentAt: timestamp({ withTimezone: true }),
    providerMessageId: text(),
    /** The provider's error code, never its message nor the address. */
    lastError: text(),
    unsubscribedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("email_campaign_sends_recipient_idx").on(table.campaignId, table.email),
    index("email_campaign_sends_status_idx").on(table.campaignId, table.status),
    index("email_campaign_sends_claimed_idx")
      .on(table.claimedAt)
      .where(sql`${table.status} in ('queued', 'sending')`),
    index("email_campaign_sends_provider_idx").on(table.providerMessageId),
    // Deleting an account unlinks its sends.
    index("email_campaign_sends_user_idx").on(table.userId).where(sql`${table.userId} is not null`),
    check(
      "email_campaign_sends_status_check",
      sql`${table.status} in ('pending', 'queued', 'sending', 'sent', 'failed', 'bounced', 'complained', 'suppressed', 'cancelled')`,
    ),
  ],
);

/**
 * Addresses that campaigns never write to again: unsubscribed, hard bounce, complaint. Kept in
 * clear: it is the opposition list the CNIL asks to keep. Never applied to sign-in codes.
 */
export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    /** Lowercase. */
    email: text().primaryKey(),
    /** `unsubscribed`, `hard_bounce`, `complaint` or `manual`. */
    reason: text().notNull(),
    /** Where it came from: `unsubscribe_link`, `lettermint_webhook`… */
    source: text().notNull(),
    campaignId: uuid(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "email_suppressions_reason_check",
      sql`${table.reason} in ('unsubscribed', 'hard_bounce', 'complaint', 'manual')`,
    ),
  ],
);

/**
 * A player's consent to campaign e-mails, dated with its source as proof. No row, or a
 * revoked one, means no campaign.
 */
export const emailConsents = pgTable("email_consents", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  grantedAt: timestamp({ withTimezone: true }),
  /** `signup` or `settings`. */
  grantedSource: text(),
  revokedAt: timestamp({ withTimezone: true }),
  /** `settings`, `unsubscribe_link`, `complaint`… */
  revokedSource: text(),
});

/**
 * Sign-in e-mails sent through Cloudflare Email Service: a code, or the invitation-only answer to
 * an address the closed beta refuses. Kept to follow the monthly quota, without the address: the
 * back office counts them, it never needs to know to whom. Erased after 90 days.
 */
export const signInEmails = pgTable(
  "sign_in_emails",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** `code` or `invitation_only`. */
    kind: text().notNull(),
    /** `sent` (accepted by the provider) or `failed`. */
    status: text().notNull(),
    /** The provider's error code, never its message nor the address. */
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sign_in_emails_created_idx").on(table.createdAt),
    check("sign_in_emails_kind_check", sql`${table.kind} in ('code', 'invitation_only')`),
    check("sign_in_emails_status_check", sql`${table.status} in ('sent', 'failed')`),
  ],
);
