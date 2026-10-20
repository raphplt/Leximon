import { type Database, schema } from "@leximon/db";
import { lt, sql } from "drizzle-orm";

/** How long a client may retry an open with the same idempotency key. */
export const IDEMPOTENCY_RETENTION_MS = 48 * 60 * 60 * 1000;
/** Monthly partitions of the journals (boosters, challenge answers, events) kept ready in advance. */
const PARTITION_MONTHS_AHEAD = 2;
/** Months of the A/B event log kept (D-030): the CNIL allows 13 for audience measurement. */
export const ANALYTICS_RETENTION_MONTHS = 13;

export interface MaintenanceReport {
  readonly purgedRequests: number;
  readonly droppedAnalyticsMonths: number;
}

/**
 * Daily housekeeping, run by the Worker's cron trigger. Idempotent: running it twice is harmless.
 * - creates the upcoming monthly partitions of `booster_opens`, `review_logs` and
 *   `analytics_events`;
 * - purges idempotency keys too old to be retried;
 * - drops the months of `analytics_events` past their retention.
 */
export async function runMaintenance(db: Database, now: number): Promise<MaintenanceReport> {
  await db.execute(sql`select leximon_ensure_booster_open_partitions(${PARTITION_MONTHS_AHEAD})`);
  await db.execute(sql`select leximon_ensure_review_log_partitions(${PARTITION_MONTHS_AHEAD})`);
  await db.execute(
    sql`select leximon_ensure_analytics_event_partitions(${PARTITION_MONTHS_AHEAD})`,
  );
  const { rows } = await db.execute<{ dropped: number }>(
    sql`select leximon_drop_old_analytics_event_partitions(${ANALYTICS_RETENTION_MONTHS}) as dropped`,
  );
  const purged = await db
    .delete(schema.boosterOpenRequests)
    .where(lt(schema.boosterOpenRequests.openedAt, new Date(now - IDEMPOTENCY_RETENTION_MS)))
    .returning({ openId: schema.boosterOpenRequests.openId });
  return { purgedRequests: purged.length, droppedAnalyticsMonths: rows[0]?.dropped ?? 0 };
}
