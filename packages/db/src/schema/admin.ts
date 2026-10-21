import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Every change made from the back office, kept for audit: who did what to whom, and when. Rows are
 * never updated or deleted. `details` holds the request's parameters (amount, reason), never
 * personal data beyond the ids.
 */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid().primaryKey().defaultRandom(),
    adminId: text()
      .notNull()
      .references(() => users.id),
    action: text().notNull(),
    targetUserId: text(),
    details: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    /** Set for changes to a player's state: a retried request is applied once. */
    idempotencyKey: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("admin_actions_created_idx").on(table.createdAt.desc()),
    index("admin_actions_target_idx").on(table.targetUserId, table.createdAt.desc()),
    uniqueIndex("admin_actions_idempotency_idx")
      .on(table.adminId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);
