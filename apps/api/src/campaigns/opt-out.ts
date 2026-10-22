import type { LettermintWebhook } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

/**
 * Everything that stops campaigns to an address: the unsubscribe link, and the provider's bounces
 * and complaints. Each feeds the suppression list, which every later campaign deducts.
 */

const { emailCampaignSends: sends, emailConsents, emailSuppressions } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type SuppressionReason = "unsubscribed" | "hard_bounce" | "complaint";

async function suppress(
  tx: Transaction,
  input: {
    readonly email: string;
    readonly reason: SuppressionReason;
    readonly source: string;
    readonly campaignId: string | null;
    readonly now: EpochMs;
  },
): Promise<void> {
  // The first reason stays: a complaint after an unsubscribe changes nothing for the address.
  await tx
    .insert(emailSuppressions)
    .values({
      email: input.email.toLowerCase(),
      reason: input.reason,
      source: input.source,
      campaignId: input.campaignId,
      createdAt: new Date(input.now),
    })
    .onConflictDoNothing();
}

/** Withdraws a player's consent, keeping the date and the source as proof. */
async function revokeConsent(
  tx: Transaction,
  userId: string,
  source: string,
  now: EpochMs,
): Promise<void> {
  await tx
    .update(emailConsents)
    .set({ revokedAt: new Date(now), revokedSource: source })
    .where(and(eq(emailConsents.userId, userId), isNull(emailConsents.revokedAt)));
}

/**
 * Unsubscribes the recipient of a send row, from the link or the one-click header. Idempotent: a
 * second click finds everything already done. Answers the same whether the row exists or not.
 */
export async function unsubscribe(db: Database, sendId: string, now: EpochMs): Promise<void> {
  await db.transaction(async (tx) => {
    const [send] = await tx
      .select({
        email: sends.email,
        userId: sends.userId,
        campaignId: sends.campaignId,
        unsubscribedAt: sends.unsubscribedAt,
      })
      .from(sends)
      .where(eq(sends.id, sendId))
      .for("update");
    if (send === undefined) return;
    if (send.email !== null) {
      await suppress(tx, {
        email: send.email,
        reason: "unsubscribed",
        source: "unsubscribe_link",
        campaignId: send.campaignId,
        now,
      });
    }
    if (send.userId !== null) await revokeConsent(tx, send.userId, "unsubscribe_link", now);
    if (send.unsubscribedAt === null) {
      await tx
        .update(sends)
        .set({ unsubscribedAt: new Date(now) })
        .where(eq(sends.id, sendId));
    }
  });
}

/** Lettermint events that stop campaigns to an address, and what each records. */
const WEBHOOK_EFFECTS = {
  "message.hard_bounced": { status: "bounced", reason: "hard_bounce" },
  "message.spam_complaint": { status: "complained", reason: "complaint" },
  "message.unsubscribed": { status: null, reason: "unsubscribed" },
  "message.failed": { status: "failed", reason: null },
} as const satisfies Record<
  string,
  { status: "bounced" | "complained" | "failed" | null; reason: SuppressionReason | null }
>;

export type WebhookResult = "applied" | "ignored";

/**
 * Applies a Lettermint event to its send row, found by the id we gave as metadata, or else by the
 * provider's message id. Replaying an event changes nothing more.
 */
export async function applyLettermintEvent(
  db: Database,
  event: LettermintWebhook,
  now: EpochMs,
): Promise<WebhookResult> {
  if (!(event.event in WEBHOOK_EFFECTS)) return "ignored";
  const effect = WEBHOOK_EFFECTS[event.event as keyof typeof WEBHOOK_EFFECTS];
  const sendId = readSendId(event);
  const messageId = event.data?.message_id;
  if (sendId === null && messageId === undefined) return "ignored";

  return db.transaction(async (tx) => {
    const [send] = await tx
      .select({
        id: sends.id,
        email: sends.email,
        userId: sends.userId,
        campaignId: sends.campaignId,
      })
      .from(sends)
      .where(sendId !== null ? eq(sends.id, sendId) : eq(sends.providerMessageId, messageId ?? ""))
      .limit(1)
      .for("update");
    if (send === undefined) return "ignored";

    if (effect.status !== null) {
      // A bounce or a complaint follows a send: only a row the provider took is changed.
      await tx
        .update(sends)
        .set({ status: effect.status, lastError: event.event })
        .where(and(eq(sends.id, send.id), inArray(sends.status, ["sent", "sending"])));
    }
    if (effect.reason !== null && send.email !== null) {
      await suppress(tx, {
        email: send.email,
        reason: effect.reason,
        source: "lettermint_webhook",
        campaignId: send.campaignId,
        now,
      });
    }
    // A complaint or an unsubscribe is the player's will; a bounce only says the box is dead.
    if (
      (effect.reason === "complaint" || effect.reason === "unsubscribed") &&
      send.userId !== null
    ) {
      await revokeConsent(tx, send.userId, `lettermint_${effect.reason}`, now);
    }
    if (effect.reason === "unsubscribed") {
      await tx
        .update(sends)
        .set({ unsubscribedAt: sql`coalesce(${sends.unsubscribedAt}, ${new Date(now)})` })
        .where(eq(sends.id, send.id));
    }
    return "applied";
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readSendId(event: LettermintWebhook): string | null {
  const value = event.data?.metadata?.["send_id"];
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}
