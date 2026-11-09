import {
  ADMIN_ACTIONS,
  type AdminPatron,
  type AdminPatronRefundRefusal,
  type AdminPatronsResponse,
  type PatronSales,
} from "@leximon/contract";
import {
  type EpochMs,
  type PatronPlan,
  patronStanding,
  type SubscriptionStatus,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { decodeTimeCursor, nextCursor, type TimeCursor } from "../admin/cursor";
import type { Billing } from "./billing";

const { adminActions, patronPeriods, patronSubscriptions, players, users } = schema;

const PAGE = 50;

/** Statuses Stripe still bills: the subscribers of the counts. */
const BILLED = sql`${patronSubscriptions.status} in ('active', 'past_due')`;

export class InvalidPatronCursorError extends Error {}

/** `GET /admin/patrons`: the counts, then the subscribers, the latest change first. */
export async function listPatrons(
  db: Database,
  input: { readonly cursor: string | undefined; readonly sales: PatronSales },
): Promise<AdminPatronsResponse> {
  const after = input.cursor === undefined ? undefined : decodeTimeCursor(input.cursor);
  if (after === undefined && input.cursor !== undefined) throw new InvalidPatronCursorError();
  const paid = isNotNull(patronSubscriptions.firstPaidAt);
  const [counts] = await db
    .select({
      patrons: sql<number>`count(*) filter (where ${BILLED} and ${paid})::int`,
      cancelling: sql<number>`count(*) filter (where ${BILLED}
        and ${patronSubscriptions.cancelAt} is not null)::int`,
      failing: sql<number>`count(*) filter (where ${patronSubscriptions.status} = 'past_due')::int`,
      founders: sql<number>`count(*) filter (where ${patronSubscriptions.founderAt} is not null)::int`,
    })
    .from(patronSubscriptions);
  // What each paying subscriber paid last, a yearly payment spread over twelve months.
  const revenue = await db.execute<{ cents: number }>(sql`
    select coalesce(round(sum(case when p.plan = 'yearly' then p.amount_paid / 12.0
      else p.amount_paid end)), 0)::int as cents
    from ${patronSubscriptions} s
    join lateral (
      select plan, amount_paid from ${patronPeriods}
      where user_id = s.user_id and refunded_at is null
      order by paid_at desc limit 1
    ) p on true
    where s.status in ('active', 'past_due')`);

  const rows = await db
    .select({
      userId: patronSubscriptions.userId,
      email: users.email,
      pseudo: players.pseudo,
      playerCode: players.code,
      status: patronSubscriptions.status,
      plan: patronSubscriptions.plan,
      firstPaidAt: patronSubscriptions.firstPaidAt,
      currentPeriodEnd: patronSubscriptions.currentPeriodEnd,
      cancelAt: patronSubscriptions.cancelAt,
      founderAt: patronSubscriptions.founderAt,
      updatedAt: patronSubscriptions.updatedAt,
    })
    .from(patronSubscriptions)
    .innerJoin(users, eq(users.id, patronSubscriptions.userId))
    .leftJoin(players, eq(players.userId, patronSubscriptions.userId))
    .where(
      and(
        isNotNull(patronSubscriptions.stripeSubscriptionId),
        after === undefined
          ? undefined
          : sql`(${patronSubscriptions.updatedAt}, ${patronSubscriptions.userId})
            < (${new Date(after.at)}, ${after.id})`,
      ),
    )
    .orderBy(desc(patronSubscriptions.updatedAt), desc(patronSubscriptions.userId))
    .limit(PAGE + 1);
  const page = rows.slice(0, PAGE);
  const lastPayments = await readLastPayments(
    db,
    page.map((row) => row.userId),
  );

  return {
    sales: input.sales,
    counts: counts ?? { patrons: 0, cancelling: 0, failing: 0, founders: 0 },
    monthlyRevenue: revenue.rows[0]?.cents ?? 0,
    patrons: page.map(
      (row): AdminPatron => ({
        userId: row.userId,
        email: row.email,
        pseudo: row.pseudo,
        playerCode: row.playerCode,
        standing: patronStanding(
          row.status as SubscriptionStatus | null,
          row.firstPaidAt?.getTime() ?? null,
        ),
        plan: row.plan as PatronPlan | null,
        since: row.firstPaidAt?.toISOString() ?? null,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
        cancelAt: row.cancelAt?.toISOString() ?? null,
        paymentFailing: row.status === "past_due",
        founder: row.founderAt !== null,
        lastPayment: lastPayments.get(row.userId) ?? null,
      }),
    ),
    nextCursor: nextCursor(
      rows,
      PAGE,
      (row): TimeCursor => ({ at: row.updatedAt.toISOString(), id: row.userId }),
    ),
  };
}

async function readLastPayments(
  db: Database,
  userIds: readonly string[],
): Promise<Map<string, NonNullable<AdminPatron["lastPayment"]>>> {
  const last = new Map<string, NonNullable<AdminPatron["lastPayment"]>>();
  if (userIds.length === 0) return last;
  const rows = await db
    .selectDistinctOn([patronPeriods.userId], {
      userId: patronPeriods.userId,
      invoiceId: patronPeriods.invoiceId,
      amount: patronPeriods.amountPaid,
      paidAt: patronPeriods.paidAt,
      refundedAt: patronPeriods.refundedAt,
    })
    .from(patronPeriods)
    .where(inArray(patronPeriods.userId, [...userIds]))
    .orderBy(patronPeriods.userId, desc(patronPeriods.paidAt));
  for (const row of rows) {
    last.set(row.userId, {
      invoiceId: row.invoiceId,
      amount: row.amount,
      paidAt: row.paidAt.toISOString(),
      refunded: row.refundedAt !== null,
    });
  }
  return last;
}

export type RefundResult =
  | { readonly kind: "done"; readonly refunded: number }
  | { readonly kind: "refused"; readonly reason: AdminPatronRefundRefusal };

/**
 * Refunds the latest payment and stops the subscription at once: what a parent asks for a minor,
 * or a player within the law's delay. Stripe first, so that nothing is written for a refund that
 * did not happen; Stripe's own idempotency makes a retried request refund once. The subscription's
 * end comes back through the webhook.
 */
export async function refundPatron(
  db: Database,
  billing: Billing,
  input: {
    readonly adminId: string;
    readonly userId: string;
    readonly idempotencyKey: string;
    readonly now: EpochMs;
  },
): Promise<RefundResult> {
  const [done] = await db
    .select({ details: adminActions.details })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.adminId, input.adminId),
        eq(adminActions.idempotencyKey, input.idempotencyKey),
      ),
    );
  if (done !== undefined) {
    return { kind: "done", refunded: Number(done.details["refunded"] ?? 0) };
  }
  const [row] = await db
    .select()
    .from(patronSubscriptions)
    .where(eq(patronSubscriptions.userId, input.userId));
  if (row?.stripeSubscriptionId == null) return { kind: "refused", reason: "not_subscribed" };
  const [last] = await db
    .select({ invoiceId: patronPeriods.invoiceId, amount: patronPeriods.amountPaid })
    .from(patronPeriods)
    .where(and(eq(patronPeriods.userId, input.userId), isNull(patronPeriods.refundedAt)))
    .orderBy(desc(patronPeriods.paidAt))
    .limit(1);

  if (last !== undefined) await billing.refundInvoice(last.invoiceId);
  await billing.cancelSubscription(row.stripeSubscriptionId);

  const at = new Date(input.now);
  await db.transaction(async (tx) => {
    if (last !== undefined) {
      await tx
        .update(patronPeriods)
        .set({ refundedAt: at })
        .where(eq(patronPeriods.invoiceId, last.invoiceId));
    }
    await tx
      .insert(adminActions)
      .values({
        adminId: input.adminId,
        action: ADMIN_ACTIONS.patronRefund,
        targetUserId: input.userId,
        details: { invoiceId: last?.invoiceId ?? null, refunded: last?.amount ?? 0 },
        idempotencyKey: input.idempotencyKey,
        createdAt: at,
      })
      .onConflictDoNothing();
  });
  return { kind: "done", refunded: last?.amount ?? 0 };
}
