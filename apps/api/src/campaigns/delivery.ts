import type { EpochMs } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { BatchOutcome, CampaignMailer, CampaignMessage } from "./mailer";
import { prepareCampaignEmail, type RecipientLinks } from "./render";
import { createUnsubscribeSigner } from "./signatures";

/**
 * Sending a launched campaign (D-035). Every minute the pump hands up to `rate_per_minute` rows to
 * the queue; the consumer claims them, sends them in one batch, and records what became of each.
 *
 * No e-mail leaves twice: a row is claimed by one conditional update (`queued` → `sending`), so a
 * replayed or duplicated message finds nothing to claim; and the row id is the provider's
 * idempotency key, so a batch retried after a crash or a timeout is not sent again.
 */

const {
  emailCampaignSends: sends,
  emailCampaigns: campaigns,
  emailConsents,
  emailSuppressions,
} = schema;

/** Rows per queue message, and so per provider call. */
export const SENDS_PER_MESSAGE = 100;
/** A row claimed longer ago is assumed lost (the consumer's wall time is 15 minutes at most). */
export const STALE_CLAIM_MS = 15 * 60 * 1000;
/** Temporary failures before a row is given up. */
export const MAX_ATTEMPTS = 5;
/** Pause after a temporary refusal that did not say how long to wait. */
const DEFAULT_HOLD_S = 60;

export const campaignJobSchema = z.object({
  campaignId: z.uuid(),
  sendIds: z.array(z.uuid()).min(1).max(SENDS_PER_MESSAGE),
});
export type CampaignJob = z.infer<typeof campaignJobSchema>;

/** The part of the queue the pump uses; the Worker's `CAMPAIGN_QUEUE` binding fits it. */
export interface CampaignQueue {
  sendBatch(messages: Iterable<MessageSendRequest<CampaignJob>>): Promise<unknown>;
}

export interface PumpReport {
  readonly started: number;
  readonly reclaimed: number;
  readonly queued: number;
  readonly completed: number;
}

/**
 * Run every minute by the cron trigger. Idempotent, and safe if two runs overlap: rows are taken
 * with `SKIP LOCKED`.
 */
export async function pumpCampaigns(
  db: Database,
  queue: CampaignQueue,
  now: EpochMs,
): Promise<PumpReport> {
  const started = await db
    .update(campaigns)
    .set({ status: "sending", updatedAt: new Date(now) })
    .where(and(eq(campaigns.status, "scheduled"), lt(campaigns.scheduledAt, new Date(now + 1))))
    .returning({ id: campaigns.id });

  const reclaimed = await db
    .update(sends)
    .set({ status: "pending", claimedAt: null })
    .where(
      and(
        inArray(sends.status, ["queued", "sending"]),
        lt(sends.claimedAt, new Date(now - STALE_CLAIM_MS)),
      ),
    )
    .returning({ id: sends.id });

  const active = await db
    .select({ id: campaigns.id, rate: campaigns.ratePerMinute })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "sending"),
        sql`(${campaigns.holdUntil} is null or ${campaigns.holdUntil} <= ${new Date(now)})`,
      ),
    );
  let queued = 0;
  for (const campaign of active) {
    queued += await queueCampaignRows(db, queue, campaign, now);
  }

  const completed = await db
    .update(campaigns)
    .set({ status: "completed", completedAt: new Date(now), updatedAt: new Date(now) })
    .where(
      and(
        eq(campaigns.status, "sending"),
        sql`not exists (select 1 from ${sends} where ${sends.campaignId} = ${campaigns.id}
          and ${sends.status} in ('pending', 'queued', 'sending'))`,
      ),
    )
    .returning({ id: campaigns.id });

  return {
    started: started.length,
    reclaimed: reclaimed.length,
    queued,
    completed: completed.length,
  };
}

/**
 * One minute's worth of rows, spread over the minute in messages of 100: the rate holds even
 * though the queue delivers as fast as it can. The messages leave before the transaction commits:
 * one that arrives first waits on the row locks, then claims. If the commit fails, the messages
 * find no `queued` row and send nothing.
 */
async function queueCampaignRows(
  db: Database,
  queue: CampaignQueue,
  campaign: { readonly id: string; readonly rate: number },
  now: EpochMs,
): Promise<number> {
  return db.transaction(async (tx) => {
    // Two overlapping pumps would each take a minute's worth: the second one skips the campaign.
    const [locked] = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "sending")))
      .for("update", { skipLocked: true });
    if (locked === undefined) return 0;
    const rows = await tx
      .select({ id: sends.id })
      .from(sends)
      .where(and(eq(sends.campaignId, campaign.id), eq(sends.status, "pending")))
      .orderBy(sends.id)
      .limit(campaign.rate)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return 0;
    const ids = rows.map((row) => row.id);
    await tx
      .update(sends)
      .set({ status: "queued", claimedAt: new Date(now) })
      .where(inArray(sends.id, ids));

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += SENDS_PER_MESSAGE) {
      chunks.push(ids.slice(i, i + SENDS_PER_MESSAGE));
    }
    await queue.sendBatch(
      chunks.map((sendIds, index) => ({
        body: { campaignId: campaign.id, sendIds },
        delaySeconds: Math.floor((index * 60) / chunks.length),
      })),
    );
    return ids.length;
  });
}

export interface DeliveryConfig {
  /** Signs the unsubscribe links (`EMAIL_LINK_SECRET`). */
  readonly linkSecret: string;
  /** Web app, for the unsubscribe page. */
  readonly webUrl: string;
  /** API, for the one-click address. */
  readonly apiUrl: string;
}

export type DeliveryReport =
  | { readonly kind: "nothing_to_send" }
  | {
      readonly kind: "delivered";
      readonly outcome: BatchOutcome["kind"];
      readonly claimed: number;
    };

/**
 * Handles one queue message. Expected failures are recorded on the rows, never thrown: the queue
 * only retries a message when the database itself failed, and then the claim keeps it harmless.
 */
export async function deliverCampaignJob(
  db: Database,
  mailer: CampaignMailer,
  config: DeliveryConfig,
  job: CampaignJob,
  now: EpochMs,
): Promise<DeliveryReport> {
  const claimedAt = new Date(now);
  // Only while the campaign is sending: a pause or a cancel stops what is still in the queue.
  const claimed = await db
    .update(sends)
    .set({ status: "sending", claimedAt })
    .where(
      and(
        inArray(sends.id, [...job.sendIds]),
        eq(sends.campaignId, job.campaignId),
        eq(sends.status, "queued"),
        sql`exists (select 1 from ${campaigns} where ${campaigns.id} = ${job.campaignId}
          and ${campaigns.status} = 'sending')`,
      ),
    )
    .returning({ id: sends.id });
  if (claimed.length === 0) return { kind: "nothing_to_send" };
  const claimedIds = claimed.map((row) => row.id);

  // Opted out since the launch (unsubscribe, bounce, consent withdrawn): never written to.
  await db
    .update(sends)
    .set({ status: "suppressed", claimedAt: null })
    .where(
      and(
        inArray(sends.id, claimedIds),
        sql`(${sends.email} is null
          or exists (select 1 from ${emailSuppressions}
            where ${emailSuppressions.email} = ${sends.email})
          or (${sends.userId} is not null and not exists (select 1 from ${emailConsents}
            where ${emailConsents.userId} = ${sends.userId}
              and ${emailConsents.grantedAt} is not null and ${emailConsents.revokedAt} is null)))`,
      ),
    );

  const recipients = await db
    .select({ id: sends.id, email: sends.email })
    .from(sends)
    .where(and(inArray(sends.id, claimedIds), eq(sends.status, "sending")))
    .orderBy(sends.id);
  const [campaign] = await db
    .select({
      subject: campaigns.subject,
      bodyMarkdown: campaigns.bodyMarkdown,
      buttonLabel: campaigns.buttonLabel,
      buttonUrl: campaigns.buttonUrl,
    })
    .from(campaigns)
    .where(eq(campaigns.id, job.campaignId));
  if (recipients.length === 0 || campaign === undefined) {
    return { kind: "delivered", outcome: "accepted", claimed: 0 };
  }

  const render = prepareCampaignEmail(campaign);
  const sign = createUnsubscribeSigner(config.linkSecret);
  const messages: CampaignMessage[] = [];
  for (const recipient of recipients) {
    if (recipient.email === null) continue;
    const email = render(unsubscribeLinks(config, await sign(recipient.id)));
    messages.push({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
      idempotencyKey: recipient.id,
      sendId: recipient.id,
    });
  }

  let outcome: BatchOutcome;
  try {
    outcome = await mailer.sendBatch(messages);
  } catch (error) {
    // No provider for this environment: a person has to act, like a refused key.
    outcome = { kind: "blocked", code: error instanceof Error ? error.name : "unknown_error" };
  }
  await recordOutcome(
    db,
    job.campaignId,
    messages.map((message) => message.sendId),
    claimedAt,
    outcome,
    now,
  );
  return { kind: "delivered", outcome: outcome.kind, claimed: messages.length };
}

export function unsubscribeLinks(config: DeliveryConfig, token: string): RecipientLinks {
  return {
    unsubscribePage: `${trimSlash(config.webUrl)}/desinscription/${token}`,
    oneClick: `${trimSlash(config.apiUrl)}/email/unsubscribe/${token}`,
  };
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * Writes the outcome of a batch on its rows. Each update only touches rows still under this claim:
 * a row reclaimed as stale and taken by another consumer is not overwritten.
 */
async function recordOutcome(
  db: Database,
  campaignId: string,
  ids: readonly string[],
  claimedAt: Date,
  outcome: BatchOutcome,
  now: EpochMs,
): Promise<void> {
  const ours = (subset: readonly string[]) =>
    and(
      inArray(sends.id, [...subset]),
      eq(sends.status, "sending"),
      eq(sends.claimedAt, claimedAt),
    );
  const sentAt = new Date(now);

  switch (outcome.kind) {
    case "accepted":
      await markSent(
        db,
        ids.map((id, index) => ({ id, messageId: outcome.messageIds[index] ?? null })),
        claimedAt,
        sentAt,
      );
      return;
    case "partial": {
      const accepted = outcome.accepted.flatMap(({ index, messageId }) => {
        const id = ids[index];
        return id === undefined ? [] : [{ id, messageId }];
      });
      await markSent(db, accepted, claimedAt, sentAt);
      const failed = ids[outcome.failedIndex];
      if (failed !== undefined) {
        await db
          .update(sends)
          .set({ status: "failed", lastError: outcome.code, claimedAt: null })
          .where(ours([failed]));
      }
      // Not tried: back in line, without counting an attempt.
      await db
        .update(sends)
        .set({ status: "pending", claimedAt: null })
        .where(ours(ids.slice(outcome.failedIndex + 1)));
      return;
    }
    case "retry_later":
      await db
        .update(sends)
        .set({
          status: sql`case when ${sends.attempts} + 1 >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end`,
          attempts: sql`${sends.attempts} + 1`,
          lastError: outcome.code,
          claimedAt: null,
        })
        .where(ours(ids));
      await db
        .update(campaigns)
        .set({ holdUntil: new Date(now + (outcome.retryAfterS ?? DEFAULT_HOLD_S) * 1000) })
        .where(eq(campaigns.id, campaignId));
      return;
    case "blocked":
      console.error("Campaign paused: the provider refused to send", {
        campaignId,
        code: outcome.code,
      });
      await db
        .update(sends)
        .set({ status: "pending", lastError: outcome.code, claimedAt: null })
        .where(ours(ids));
      await db
        .update(campaigns)
        .set({ status: "paused", updatedAt: sentAt })
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "sending")));
      return;
  }
}

async function markSent(
  db: Database,
  rows: readonly { readonly id: string; readonly messageId: string | null }[],
  claimedAt: Date,
  sentAt: Date,
): Promise<void> {
  if (rows.length === 0) return;
  // One statement for the batch: the message ids come in as a pair of arrays.
  await db.execute(sql`
    update email_campaign_sends as send
    set status = 'sent', sent_at = ${sentAt}, claimed_at = null,
      provider_message_id = sent.message_id, last_error = null
    from unnest(
      ${sql.param(rows.map((row) => row.id))}::uuid[],
      ${sql.param(rows.map((row) => row.messageId))}::text[]
    ) as sent(id, message_id)
    where send.id = sent.id and send.status = 'sending' and send.claimed_at = ${claimedAt}`);
}
