import { CLAN_SCHEDULE, clanRulesAt } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { recountActiveClans } from "./clans/events";
import { purgeFeed } from "./friends/feed";
import { purgeFriendRequests } from "./friends/friends";
import { purgeMail } from "./mail/mail";
import { SIGN_IN_CODE_DAILY_QUOTA } from "./middleware/rate-limit";
import { purgeNotifications } from "./notifications/notifications";
import { inBatches, purgeRows } from "./purge";

/** How long a client may retry an open with the same idempotency key. */
export const IDEMPOTENCY_RETENTION_MS = 48 * 60 * 60 * 1000;
/** Monthly partitions of the journals (boosters, challenge answers) kept ready in advance. */
const PARTITION_MONTHS_AHEAD = 2;
/** A campaign's recipient addresses are kept this long after it ends, for bounces and support. */
export const CAMPAIGN_ADDRESS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A guest has no address and no password: once its last session is gone, nobody can come back as
 * it. It is erased at this age, past the beta's measures of who stays.
 */
export const ABANDONED_GUEST_AGE_MS = 180 * DAY_MS;
/** A handled report is kept this long, for an appeal or a repeat offence. */
export const RESOLVED_REPORT_RETENTION_MS = 365 * DAY_MS;
/** Erasing a player cascades into every table of its game: fewer at a time. */
const GUEST_BATCH_ROWS = 200;

export interface MaintenanceReport {
  readonly purgedRequests: number;
  readonly erasedCampaignAddresses: number;
  readonly erasedClanMessages: number;
  readonly erasedLetters: number;
  readonly erasedNotifications: number;
  readonly erasedCodeQuotas: number;
  readonly erasedSessions: number;
  readonly erasedGuests: number;
  readonly erasedReports: number;
  readonly erasedFriendRequests: number;
  readonly erasedFeedEvents: number;
  readonly recountedClans: number;
}

/**
 * Daily housekeeping, run by the Worker's cron trigger. Idempotent: running it twice is harmless.
 * Purges go a batch at a time and only count what they erase.
 * - creates the upcoming monthly partitions of `booster_opens` and `review_logs`;
 * - purges idempotency keys too old to be retried;
 * - erases the addresses of campaigns ended more than 30 days ago (the suppression list stays);
 * - erases clan messages older than 90 days, except those reported and not yet handled;
 * - erases the counters of sign-in codes whose 24-hour window is over;
 * - erases expired sessions (with their address and browser) and expired sign-in codes;
 * - erases guests no session can reach any more, 180 days after they came;
 * - erases reports handled more than a year ago;
 * - recounts the clans of this week and the last, in case an event was lost.
 */
export async function runMaintenance(db: Database, now: number): Promise<MaintenanceReport> {
  await db.execute(sql`select leximon_ensure_booster_open_partitions(${PARTITION_MONTHS_AHEAD})`);
  await db.execute(sql`select leximon_ensure_review_log_partitions(${PARTITION_MONTHS_AHEAD})`);
  const { boosterOpenRequests: requests } = schema;
  const purged = await purgeRows(
    db,
    requests,
    lt(requests.openedAt, new Date(now - IDEMPOTENCY_RETENTION_MS)),
  );
  const erased = await eraseCampaignAddresses(db, now);
  const retention = clanRulesAt(CLAN_SCHEDULE, now).messageRetentionMs;
  const { clanMessages, moderationReports } = schema;
  const erasedMessages = await purgeRows(
    db,
    clanMessages,
    sql`${lt(clanMessages.createdAt, new Date(now - retention))}
      and not exists (select 1 from ${moderationReports}
        where ${moderationReports.messageId} = ${clanMessages.id}
          and ${moderationReports.resolvedAt} is null)`,
  );
  const { signInCodeQuotas: quotas } = schema;
  const erasedQuotas = await purgeRows(
    db,
    quotas,
    lt(quotas.windowStart, new Date(now - SIGN_IN_CODE_DAILY_QUOTA.windowMs)),
  );
  const erasedSessions = await eraseExpiredSessions(db, now);
  return {
    purgedRequests: purged,
    erasedCampaignAddresses: erased,
    erasedClanMessages: erasedMessages,
    erasedLetters: await purgeMail(db, now),
    erasedNotifications: await purgeNotifications(db, now),
    erasedCodeQuotas: erasedQuotas,
    erasedSessions,
    erasedGuests: await eraseAbandonedGuests(db, now),
    erasedReports: await purgeRows(
      db,
      moderationReports,
      lt(moderationReports.resolvedAt, new Date(now - RESOLVED_REPORT_RETENTION_MS)),
    ),
    erasedFriendRequests: await purgeFriendRequests(db, now),
    erasedFeedEvents: await purgeFeed(db, now),
    recountedClans: await recountActiveClans(db, now),
  };
}

/** A campaign's recipient addresses, 30 days after it ended; the suppression list stays. */
export function eraseCampaignAddresses(db: Database, now: number): Promise<number> {
  const { emailCampaignSends: sends, emailCampaigns: campaigns } = schema;
  const ended = sql`${isNotNull(sends.email)} and ${inArray(
    sends.campaignId,
    db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(lt(campaigns.completedAt, new Date(now - CAMPAIGN_ADDRESS_RETENTION_MS))),
  )}`;
  return inBatches((limit) =>
    db.execute(sql`update ${sends} set email = null where ctid = any(array(
      select ctid from ${sends} where ${ended} limit ${limit}))`),
  );
}

async function eraseExpiredSessions(db: Database, now: number): Promise<number> {
  const { sessions, verifications } = schema;
  const at = new Date(now);
  await purgeRows(db, verifications, lt(verifications.expiresAt, at));
  return purgeRows(db, sessions, lt(sessions.expiresAt, at));
}

/**
 * Guests without a session left, never turned into an account (those are kept, linked to it),
 * old enough, and in no pending trade.
 */
function eraseAbandonedGuests(db: Database, now: number): Promise<number> {
  const { guestLinks, sessions, trades, users } = schema;
  const abandoned = sql`${and(
    eq(users.isAnonymous, true),
    lt(users.createdAt, new Date(now - ABANDONED_GUEST_AGE_MS)),
  )}
    and not exists (select 1 from ${sessions} where ${sessions.userId} = ${users.id})
    and not exists (select 1 from ${guestLinks} where ${guestLinks.guestId} = ${users.id})
    and not exists (select 1 from ${trades} where ${trades.status} = 'pending'
      and (${trades.proposerId} = ${users.id} or ${trades.recipientId} = ${users.id}))`;
  return purgeRows(db, users, abandoned, GUEST_BATCH_ROWS);
}
