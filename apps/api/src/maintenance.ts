import { CLAN_SCHEDULE, clanRulesAt } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { recountActiveClans } from "./clans/events";

/** How long a client may retry an open with the same idempotency key. */
export const IDEMPOTENCY_RETENTION_MS = 48 * 60 * 60 * 1000;
/** Monthly partitions of the journals (boosters, challenge answers) kept ready in advance. */
const PARTITION_MONTHS_AHEAD = 2;
/** A campaign's recipient addresses are kept this long after it ends, for bounces and support. */
export const CAMPAIGN_ADDRESS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface MaintenanceReport {
  readonly purgedRequests: number;
  readonly erasedCampaignAddresses: number;
  readonly erasedClanMessages: number;
  readonly recountedClans: number;
}

/**
 * Daily housekeeping, run by the Worker's cron trigger. Idempotent: running it twice is harmless.
 * - creates the upcoming monthly partitions of `booster_opens` and `review_logs`;
 * - purges idempotency keys too old to be retried;
 * - erases the addresses of campaigns ended more than 30 days ago (the suppression list stays);
 * - erases clan messages older than 90 days, except those reported and not yet handled;
 * - recounts the clans of this week and the last, in case an event was lost.
 */
export async function runMaintenance(db: Database, now: number): Promise<MaintenanceReport> {
  await db.execute(sql`select leximon_ensure_booster_open_partitions(${PARTITION_MONTHS_AHEAD})`);
  await db.execute(sql`select leximon_ensure_review_log_partitions(${PARTITION_MONTHS_AHEAD})`);
  const purged = await db
    .delete(schema.boosterOpenRequests)
    .where(lt(schema.boosterOpenRequests.openedAt, new Date(now - IDEMPOTENCY_RETENTION_MS)))
    .returning({ openId: schema.boosterOpenRequests.openId });
  const { emailCampaignSends: sends, emailCampaigns: campaigns } = schema;
  const erased = await db
    .update(sends)
    .set({ email: null })
    .where(
      and(
        isNotNull(sends.email),
        inArray(
          sends.campaignId,
          db
            .select({ id: campaigns.id })
            .from(campaigns)
            .where(lt(campaigns.completedAt, new Date(now - CAMPAIGN_ADDRESS_RETENTION_MS))),
        ),
      ),
    )
    .returning({ id: sends.id });
  const retention = clanRulesAt(CLAN_SCHEDULE, now).messageRetentionMs;
  const { clanMessages, moderationReports } = schema;
  const erasedMessages = await db
    .delete(clanMessages)
    .where(
      and(
        lt(clanMessages.createdAt, new Date(now - retention)),
        sql`not exists (select 1 from ${moderationReports}
          where ${moderationReports.messageId} = ${clanMessages.id}
            and ${moderationReports.resolvedAt} is null)`,
      ),
    )
    .returning({ id: clanMessages.id });
  return {
    purgedRequests: purged.length,
    erasedCampaignAddresses: erased.length,
    erasedClanMessages: erasedMessages.length,
    recountedClans: await recountActiveClans(db, now),
  };
}
