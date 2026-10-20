import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * First-party event log of the A/B tests (D-030), partitioned by month on `received_at` (see the
 * migrations). Rows carry a pseudonymous subject, never the player id, and have no foreign key:
 * the log is not meant to be joined with game data. Months older than the retention are dropped
 * whole by the daily maintenance.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    /** HMAC of the player id, keyed by a secret of the API. */
    subject: text().notNull(),
    name: text().notNull(),
    /** The event's own fields, as validated by the contract (`analyticsEventSchema`). */
    props: jsonb().$type<Record<string, unknown>>().notNull(),
    /** The subject's variant in each experiment running when the event was received. */
    variants: jsonb().$type<Record<string, string>>().notNull(),
    /** Clock of the player's device: for ordering a session, not trusted for partitioning. */
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    index("analytics_events_name_received_idx").on(table.name, table.receivedAt),
    index("analytics_events_subject_received_idx").on(table.subject, table.receivedAt),
  ],
);
