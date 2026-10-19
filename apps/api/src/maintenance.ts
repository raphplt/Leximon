import { type Database, schema } from "@leximon/db";
import { lt, sql } from "drizzle-orm";

/** How long a client may retry an open with the same idempotency key. */
export const IDEMPOTENCY_RETENTION_MS = 48 * 60 * 60 * 1000;
/** Monthly partitions of the booster journal kept ready in advance. */
const PARTITION_MONTHS_AHEAD = 2;

export interface MaintenanceReport {
  readonly purgedRequests: number;
}

/**
 * Daily housekeeping, run by the Worker's cron trigger. Idempotent: running it twice is harmless.
 * - creates the upcoming monthly partitions of `booster_opens`;
 * - purges idempotency keys too old to be retried.
 */
export async function runMaintenance(db: Database, now: number): Promise<MaintenanceReport> {
  await db.execute(sql`select leximon_ensure_booster_open_partitions(${PARTITION_MONTHS_AHEAD})`);
  const purged = await db
    .delete(schema.boosterOpenRequests)
    .where(lt(schema.boosterOpenRequests.openedAt, new Date(now - IDEMPOTENCY_RETENTION_MS)))
    .returning({ openId: schema.boosterOpenRequests.openId });
  return { purgedRequests: purged.length };
}
