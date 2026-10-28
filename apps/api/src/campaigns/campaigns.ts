import {
  ADMIN_ACTIONS,
  type AdminCampaign,
  type AdminCampaignInput,
  type AdminCampaignSummary,
  type AdminWaitlistOpening,
  type CampaignAudience,
  type CampaignCounts,
  type CampaignStatus,
} from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { isWaitlistClosed, lockWaitlist } from "../waitlist/closure";

/**
 * Campaigns as the back office handles them: drafts, launch, pause, cancel, and the erasure of
 * the waiting list once its e-mail has left. Sending itself is in `delivery.ts`.
 *
 * Every change is logged in `admin_actions` in its own transaction.
 */

const {
  adminActions,
  emailCampaignSends: sends,
  emailCampaigns: campaigns,
  emailConsents,
  emailSuppressions,
  users,
  waitlistSignups,
} = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

/** A scheduled launch is at most this far ahead. */
export const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

type CampaignRow = typeof campaigns.$inferSelect;

/**
 * The recipients of an audience, one row per address, opted-out addresses left out: the same query
 * counts them for the confirmation and copies them into `email_campaign_sends` at launch.
 */
function audienceQuery(campaign: Pick<CampaignRow, "id" | "audience">) {
  const source = audienceSource(campaign);
  return sql`
    select distinct on (recipient.email) recipient.email, recipient.user_id
    from (${source}) as recipient
    where recipient.email is not null
      and not exists (select 1 from ${emailSuppressions}
        where ${emailSuppressions.email} = recipient.email)
    order by recipient.email, recipient.user_id nulls last`;
}

function audienceSource(campaign: Pick<CampaignRow, "id" | "audience">) {
  switch (campaign.audience as CampaignAudience) {
    case "waitlist":
      return sql`select lower(${waitlistSignups.email}) as email, null::text as user_id
        from ${waitlistSignups}`;
    case "waitlist_invite":
      return sql`select lower(${waitlistSignups.email}) as email, null::text as user_id
        from ${waitlistSignups} where ${waitlistSignups.inviteCampaignId} = ${campaign.id}`;
    case "players":
      // Explicit consent, still standing. Guests have no address of their own.
      return sql`select lower(${users.email}) as email, ${users.id} as user_id
        from ${users} join ${emailConsents} on ${emailConsents.userId} = ${users.id}
        where ${emailConsents.grantedAt} is not null and ${emailConsents.revokedAt} is null
          and not ${users.isAnonymous} and ${users.banned} is not true`;
    case "test":
      return sql`select lower(address) as email, null::text as user_id
        from ${campaigns}, unnest(${campaigns.testRecipients}) as address
        where ${campaigns.id} = ${campaign.id}`;
  }
}

/** Exact number of recipients if the campaign were launched now. */
export async function countAudience(
  db: Executor,
  campaign: Pick<CampaignRow, "id" | "audience">,
): Promise<number> {
  const result = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from (${audienceQuery(campaign)}) as audience`,
  );
  return result.rows[0]?.n ?? 0;
}

export type DraftResult =
  | { readonly kind: "saved"; readonly id: string }
  | { readonly kind: "campaign_not_found" }
  | { readonly kind: "not_a_draft" }
  /** the waiting list already got its e-mail. */
  | { readonly kind: "waitlist_closed" };

function draftValues(input: AdminCampaignInput) {
  return {
    name: input.name,
    subject: input.subject,
    bodyMarkdown: input.bodyMarkdown,
    buttonLabel: input.buttonLabel,
    buttonUrl: input.buttonUrl,
    audience: input.audience,
    testRecipients: input.audience === "test" ? [...input.testRecipients] : [],
    ratePerMinute: input.ratePerMinute,
  };
}

export async function createDraft(
  db: Database,
  input: { readonly adminId: string; readonly campaign: AdminCampaignInput },
): Promise<DraftResult> {
  if (input.campaign.audience === "waitlist" && (await isWaitlistClosed(db))) {
    return { kind: "waitlist_closed" };
  }
  const [created] = await db
    .insert(campaigns)
    .values({ ...draftValues(input.campaign), createdBy: input.adminId })
    .returning({ id: campaigns.id });
  if (created === undefined) throw new Error("Campaign insert returned no row");
  return { kind: "saved", id: created.id };
}

/** Only a draft changes: what was launched is what was confirmed. */
export async function updateDraft(
  db: Database,
  input: { readonly id: string; readonly campaign: AdminCampaignInput; readonly now: EpochMs },
): Promise<DraftResult> {
  if (input.campaign.audience === "waitlist" && (await isWaitlistClosed(db))) {
    return { kind: "waitlist_closed" };
  }
  const updated = await db
    .update(campaigns)
    .set({ ...draftValues(input.campaign), updatedAt: new Date(input.now) })
    .where(and(eq(campaigns.id, input.id), eq(campaigns.status, "draft")))
    .returning({ id: campaigns.id });
  if (updated[0] !== undefined) return { kind: "saved", id: input.id };
  return (await campaignExists(db, input.id))
    ? { kind: "not_a_draft" }
    : { kind: "campaign_not_found" };
}

async function campaignExists(db: Executor, id: string): Promise<boolean> {
  const [row] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, id));
  return row !== undefined;
}

export type LaunchResult =
  | { readonly kind: "launched"; readonly status: CampaignStatus; readonly recipients: number }
  | { readonly kind: "campaign_not_found" }
  | { readonly kind: "not_a_draft" }
  | { readonly kind: "waitlist_closed" }
  | { readonly kind: "no_recipients" }
  /** The audience moved since the admin read the number: they confirm the new one. */
  | { readonly kind: "recipient_count_changed"; readonly recipients: number };

/**
 * Freezes the recipient list and starts (or schedules) the sending. The admin confirms the exact
 * number they were shown: any difference refuses the launch rather than sending to people they
 * did not count.
 *
 * A waiting list launch takes the list's lock exclusively: no sign-up can slip in between the copy
 * and the closure. A retried request with the same key returns the first result.
 */
export async function launchCampaign(
  db: Database,
  input: {
    readonly adminId: string;
    readonly id: string;
    readonly expectedRecipients: number;
    readonly scheduledAt: EpochMs | null;
    readonly idempotencyKey: string;
    readonly now: EpochMs;
  },
): Promise<LaunchResult> {
  const { adminId, id, expectedRecipients, scheduledAt, idempotencyKey, now } = input;
  return db.transaction(async (tx) => {
    const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for("update");
    if (campaign === undefined) return { kind: "campaign_not_found" };

    const [previous] = await tx
      .select({ details: adminActions.details })
      .from(adminActions)
      .where(
        and(eq(adminActions.adminId, adminId), eq(adminActions.idempotencyKey, idempotencyKey)),
      );
    if (previous !== undefined) {
      return {
        kind: "launched",
        status: campaign.status as CampaignStatus,
        recipients: campaign.recipientCount ?? 0,
      };
    }
    if (campaign.status !== "draft") return { kind: "not_a_draft" };

    if (campaign.audience === "waitlist") {
      await lockWaitlist(tx, "exclusive");
      if (await isWaitlistClosed(tx)) return { kind: "waitlist_closed" };
    }

    const recipients = await countAudience(tx, campaign);
    if (recipients === 0) return { kind: "no_recipients" };
    if (recipients !== expectedRecipients) return { kind: "recipient_count_changed", recipients };

    await tx.execute(sql`
      insert into ${sends} (campaign_id, email, user_id)
      select ${id}::uuid, audience.email, audience.user_id
      from (${audienceQuery(campaign)}) as audience`);

    const status: CampaignStatus =
      scheduledAt !== null && scheduledAt > now ? "scheduled" : "sending";
    await tx
      .update(campaigns)
      .set({
        status,
        recipientCount: recipients,
        launchedAt: new Date(now),
        launchedBy: adminId,
        scheduledAt: status === "scheduled" && scheduledAt !== null ? new Date(scheduledAt) : null,
        updatedAt: new Date(now),
      })
      .where(eq(campaigns.id, id));
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.launchCampaign,
      details: {
        campaignId: id,
        name: campaign.name,
        audience: campaign.audience,
        recipients,
        scheduledAt: status === "scheduled" ? new Date(scheduledAt ?? now).toISOString() : null,
      },
      idempotencyKey,
      createdAt: new Date(now),
    });
    return { kind: "launched", status, recipients };
  });
}

export type ControlResult =
  | { readonly kind: "done"; readonly status: CampaignStatus }
  | { readonly kind: "campaign_not_found" }
  /** The campaign is not in a state this action applies to. */
  | { readonly kind: "invalid_state" };

const CONTROLS = {
  /** Stops handing rows to the queue; batches already claimed finish. */
  pause: { from: ["scheduled", "sending"], action: ADMIN_ACTIONS.pauseCampaign },
  resume: { from: ["paused"], action: ADMIN_ACTIONS.resumeCampaign },
  /** Final: no row left waiting will ever leave. */
  cancel: { from: ["scheduled", "sending", "paused"], action: ADMIN_ACTIONS.cancelCampaign },
} as const satisfies Record<string, { from: readonly CampaignStatus[]; action: string }>;

export type CampaignControl = keyof typeof CONTROLS;

export async function controlCampaign(
  db: Database,
  input: {
    readonly adminId: string;
    readonly id: string;
    readonly control: CampaignControl;
    readonly now: EpochMs;
  },
): Promise<ControlResult> {
  const { adminId, id, control, now } = input;
  const rule = CONTROLS[control];
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .select({ status: campaigns.status, scheduledAt: campaigns.scheduledAt })
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .for("update");
    if (campaign === undefined) return { kind: "campaign_not_found" };
    if (!(rule.from as readonly string[]).includes(campaign.status))
      return { kind: "invalid_state" };

    let status: CampaignStatus;
    switch (control) {
      case "pause":
        status = "paused";
        // Queued rows go back: a message still in the queue then finds nothing to claim.
        await tx
          .update(sends)
          .set({ status: "pending", claimedAt: null })
          .where(and(eq(sends.campaignId, id), eq(sends.status, "queued")));
        break;
      case "resume":
        status =
          campaign.scheduledAt !== null && campaign.scheduledAt.getTime() > now
            ? "scheduled"
            : "sending";
        break;
      case "cancel":
        status = "cancelled";
        await tx
          .update(sends)
          .set({ status: "cancelled", claimedAt: null })
          .where(and(eq(sends.campaignId, id), inArray(sends.status, ["pending", "queued"])));
        break;
    }
    await tx
      .update(campaigns)
      .set({
        status,
        updatedAt: new Date(now),
        ...(status === "cancelled" ? { completedAt: new Date(now) } : {}),
        ...(control === "resume" ? { holdUntil: null } : {}),
      })
      .where(eq(campaigns.id, id));
    await tx.insert(adminActions).values({
      adminId,
      action: rule.action,
      details: { campaignId: id },
      createdAt: new Date(now),
    });
    return { kind: "done", status };
  });
}

type CountsRow = { campaign_id: string } & Record<keyof CampaignCounts, number>;

const EMPTY_COUNTS: CampaignCounts = {
  waiting: 0,
  sent: 0,
  failed: 0,
  bounced: 0,
  complained: 0,
  suppressed: 0,
  cancelled: 0,
  unsubscribed: 0,
};

/**
 * Counters of several campaigns in one query. `sent` counts every e-mail the provider accepted,
 * bounced and complained ones included: those two are details of it.
 */
async function readCounts(
  db: Executor,
  ids: readonly string[],
): Promise<Map<string, CampaignCounts>> {
  if (ids.length === 0) return new Map();
  const result = await db.execute<CountsRow>(sql`
    select ${sends.campaignId} as campaign_id,
      count(*) filter (where ${sends.status} in ('pending', 'queued', 'sending'))::int as waiting,
      count(*) filter (where ${sends.status} in ('sent', 'bounced', 'complained'))::int as sent,
      count(*) filter (where ${sends.status} = 'failed')::int as failed,
      count(*) filter (where ${sends.status} = 'bounced')::int as bounced,
      count(*) filter (where ${sends.status} = 'complained')::int as complained,
      count(*) filter (where ${sends.status} = 'suppressed')::int as suppressed,
      count(*) filter (where ${sends.status} = 'cancelled')::int as cancelled,
      count(*) filter (where ${sends.unsubscribedAt} is not null)::int as unsubscribed
    from ${sends}
    where ${sends.campaignId} in (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    group by ${sends.campaignId}`);
  return new Map(
    result.rows.map(({ campaign_id, ...counts }) => [campaign_id, { ...EMPTY_COUNTS, ...counts }]),
  );
}

const iso = (date: Date | null) => (date === null ? null : date.toISOString());

function toSummary(row: CampaignRow, counts: CampaignCounts | undefined): AdminCampaignSummary {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    audience: row.audience as CampaignAudience,
    status: row.status as CampaignStatus,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt.toISOString(),
    scheduledAt: iso(row.scheduledAt),
    launchedAt: iso(row.launchedAt),
    completedAt: iso(row.completedAt),
    counts: counts ?? EMPTY_COUNTS,
  };
}

/** The 100 latest campaigns: a handful a month is expected, no pagination needed. */
export async function listCampaigns(db: Database): Promise<AdminCampaignSummary[]> {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(100);
  const counts = await readCounts(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toSummary(row, counts.get(row.id)));
}

export async function readCampaign(db: Database, id: string): Promise<AdminCampaign | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (row === undefined) return null;
  const counts = await readCounts(db, [id]);
  return {
    ...toSummary(row, counts.get(id)),
    bodyMarkdown: row.bodyMarkdown,
    buttonLabel: row.buttonLabel,
    buttonUrl: row.buttonUrl,
    testRecipients: row.testRecipients,
    ratePerMinute: row.ratePerMinute,
    waitlistErasedAt: iso(row.waitlistErasedAt),
  };
}

/** The campaign row as stored, for the routes that need its audience or its content. */
export async function readCampaignRow(db: Executor, id: string): Promise<CampaignRow | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return row ?? null;
}

/** The opening e-mail of the waiting list, or null while none was written. */
export async function readWaitlistOpening(db: Executor): Promise<AdminWaitlistOpening | null> {
  const [row] = await db
    .select({
      id: campaigns.id,
      status: campaigns.status,
      launchedAt: campaigns.launchedAt,
      waitlistErasedAt: campaigns.waitlistErasedAt,
    })
    .from(campaigns)
    .where(and(eq(campaigns.audience, "waitlist"), isNotNull(campaigns.launchedAt)))
    .limit(1);
  if (row === undefined) return null;
  return {
    campaignId: row.id,
    status: row.status as CampaignStatus,
    closed: true,
    erasedAt: iso(row.waitlistErasedAt),
  };
}

export type EraseWaitlistResult =
  | { readonly kind: "erased"; readonly erased: number }
  /** The opening e-mail has not finished leaving: erasing now would lose recipients. */
  | { readonly kind: "not_sent_yet" }
  | { readonly kind: "count_changed"; readonly count: number };

/**
 * Erases the waiting list once its e-mail has left: the addresses, and their copies in the
 * campaign's send rows. The suppression list stays (opposition kept, as the CNIL asks). The admin
 * confirms the number of addresses erased.
 */
export async function eraseWaitlist(
  db: Database,
  input: { readonly adminId: string; readonly expectedCount: number; readonly now: EpochMs },
): Promise<EraseWaitlistResult> {
  const { adminId, expectedCount, now } = input;
  return db.transaction(async (tx) => {
    await lockWaitlist(tx, "exclusive");
    const [opening] = await tx
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.audience, "waitlist"), isNotNull(campaigns.launchedAt)))
      .for("update");
    if (opening === undefined || !["completed", "cancelled"].includes(opening.status)) {
      return { kind: "not_sent_yet" };
    }
    const [total] = await tx.select({ n: sql<number>`count(*)::int` }).from(waitlistSignups);
    const count = total?.n ?? 0;
    if (count !== expectedCount) return { kind: "count_changed", count };

    await tx.delete(waitlistSignups);
    await tx.update(sends).set({ email: null }).where(eq(sends.campaignId, opening.id));
    await tx
      .update(campaigns)
      .set({ waitlistErasedAt: new Date(now), updatedAt: new Date(now) })
      .where(eq(campaigns.id, opening.id));
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.eraseWaitlist,
      details: { campaignId: opening.id, erased: count },
      createdAt: new Date(now),
    });
    return { kind: "erased", erased: count };
  });
}
