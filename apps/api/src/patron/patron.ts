import type { PatronRefusal, PatronResponse, PatronSales } from "@leximon/contract";
import {
  type EpochMs,
  isFoundingPayment,
  PATRON_SCHEDULE,
  type PatronPlan,
  patronRulesAt,
  patronStanding,
  type SubscriptionStatus,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq } from "drizzle-orm";
import { ADMIN_ROLE } from "../auth";
import { type Billing, billingConfigured, type SubscriptionSnapshot } from "./billing";
import type { BillingEvent } from "./events";

const { patronPeriods, patronSubscriptions, stripeEvents, users } = schema;

type PatronRow = typeof patronSubscriptions.$inferSelect;

/** A subscription Stripe still bills or may bill again: the account cannot open a second one. */
const LIVE_STATUSES: ReadonlySet<string> = new Set<SubscriptionStatus>([
  "trialing",
  "active",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
]);

const isLive = (status: string | null) => status !== null && LIVE_STATUSES.has(status);

/** Closed until the owner opens sales in the Worker's settings; nothing without Stripe's secrets. */
export function patronSales(env: Env): PatronSales {
  if (!billingConfigured(env)) return "unavailable";
  return env.PATRON_SALES === "open" ? "open" : "closed";
}

interface Buyer {
  readonly isGuest: boolean;
  readonly isAdmin: boolean;
}

async function readBuyer(db: Database, userId: string): Promise<Buyer> {
  const [user] = await db
    .select({ isAnonymous: users.isAnonymous, role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  return { isGuest: user?.isAnonymous !== false, isAdmin: user?.role === ADMIN_ROLE };
}

/** Before sales open, admins may still buy: the real payment is tried before players see it. */
function buyRefusal(sales: PatronSales, buyer: Buyer, row: PatronRow | undefined) {
  if (sales === "unavailable" || (sales === "closed" && !buyer.isAdmin)) return "sales_closed";
  if (buyer.isGuest) return "guest";
  if (row !== undefined && isLive(row.status)) return "already_patron";
  return null;
}

/** A trial once per account, and never after a payment. */
const trialAvailable = (row: PatronRow | undefined) =>
  row === undefined || (row.trialUsedAt === null && row.firstPaidAt === null);

async function readRow(db: Database, userId: string): Promise<PatronRow | undefined> {
  const [row] = await db
    .select()
    .from(patronSubscriptions)
    .where(eq(patronSubscriptions.userId, userId));
  return row;
}

export async function readPatron(
  db: Database,
  input: { readonly userId: string; readonly sales: PatronSales; readonly now: EpochMs },
): Promise<PatronResponse> {
  const [row, buyer] = await Promise.all([readRow(db, input.userId), readBuyer(db, input.userId)]);
  const rules = patronRulesAt(PATRON_SCHEDULE, input.now);
  return {
    sales: input.sales,
    canBuy: buyRefusal(input.sales, buyer, row) === null,
    trialAvailable: trialAvailable(row),
    trialDays: rules.trialDays,
    founder: row?.founderAt != null,
    subscription:
      row?.stripeSubscriptionId == null
        ? null
        : {
            standing: patronStanding(
              row.status as SubscriptionStatus | null,
              row.firstPaidAt?.getTime() ?? null,
            ),
            plan: row.plan as PatronPlan | null,
            currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
            trialEnd: row.trialEnd?.toISOString() ?? null,
            cancelAt: row.cancelAt?.toISOString() ?? null,
            paymentFailing: row.status === "past_due",
            since: row.firstPaidAt?.toISOString() ?? null,
          },
  };
}

export type CheckoutResult =
  | { readonly kind: "opened"; readonly url: string }
  | { readonly kind: "refused"; readonly reason: PatronRefusal };

/**
 * Opens a Stripe checkout. Nothing is granted here: the subscription exists once Stripe says so,
 * through the webhook. The customer is made before the first checkout and kept, so that every
 * checkout, the portal and the trial once per account all know the player.
 */
export async function openCheckout(
  db: Database,
  billing: Billing,
  input: {
    readonly userId: string;
    readonly plan: PatronPlan;
    readonly sales: PatronSales;
    readonly idempotencyKey: string;
    readonly webUrl: string;
    readonly now: EpochMs;
  },
): Promise<CheckoutResult> {
  const [found, buyer] = await Promise.all([
    readRow(db, input.userId),
    readBuyer(db, input.userId),
  ]);
  const refusal = buyRefusal(input.sales, buyer, found);
  if (refusal !== null) return { kind: "refused", reason: refusal };

  const row = found ?? (await createCustomerRow(db, billing, input.userId));
  // Two checkouts open in two tabs would make two subscriptions: the older one goes.
  if (row.checkoutSessionId !== null) await billing.expireCheckout(row.checkoutSessionId);
  const rules = patronRulesAt(PATRON_SCHEDULE, input.now);
  const session = await billing.createCheckout({
    customerId: row.stripeCustomerId,
    userId: input.userId,
    plan: input.plan,
    trialDays: trialAvailable(row) ? rules.trialDays : null,
    successUrl: `${input.webUrl}/mecene?merci`,
    cancelUrl: `${input.webUrl}/mecene`,
    idempotencyKey: input.idempotencyKey,
  });
  const at = new Date(input.now);
  await db
    .update(patronSubscriptions)
    .set({ checkoutSessionId: session.id, waiverAcceptedAt: at, updatedAt: at })
    .where(eq(patronSubscriptions.userId, input.userId));
  return { kind: "opened", url: session.url };
}

/** Stripe returns the same customer to a request made twice: two first checkouts at once agree. */
async function createCustomerRow(
  db: Database,
  billing: Billing,
  userId: string,
): Promise<PatronRow> {
  const customerId = await billing.createCustomer(userId);
  await db
    .insert(patronSubscriptions)
    .values({ userId, stripeCustomerId: customerId })
    .onConflictDoNothing({ target: patronSubscriptions.userId });
  const row = await readRow(db, userId);
  if (row === undefined) throw new Error("Patron row missing right after its insert");
  return row;
}

export type PortalResult =
  | { readonly kind: "opened"; readonly url: string }
  | { readonly kind: "refused"; readonly reason: PatronRefusal };

/** Stripe's page to change plan, card, see invoices or cancel. */
export async function openPortal(
  db: Database,
  billing: Billing,
  input: { readonly userId: string; readonly webUrl: string },
): Promise<PortalResult> {
  const row = await readRow(db, input.userId);
  if (row?.stripeSubscriptionId == null) return { kind: "refused", reason: "not_subscribed" };
  const url = await billing.createPortal(row.stripeCustomerId, `${input.webUrl}/mecene`);
  return { kind: "opened", url };
}

export type EventResult =
  | "applied"
  | "duplicate"
  | "ignored"
  /** A customer this game did not make: another product on the same Stripe account. */
  | "unknown_customer";

/**
 * Applies a Stripe event. The subscription is read again from Stripe first, outside the
 * transaction, so that a late event never brings back an older state. The event's row is written
 * in the same transaction as its effect: an event Stripe sends again changes nothing, and one
 * that failed is applied when Stripe retries it.
 */
export async function applyBillingEvent(
  db: Database,
  billing: Billing,
  event: BillingEvent,
  now: EpochMs,
): Promise<EventResult> {
  const [seen] = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, event.id));
  if (seen !== undefined) return "duplicate";
  const snapshot =
    event.subscriptionId === null ? null : await billing.retrieveSubscription(event.subscriptionId);

  const outcome = await db.transaction(async (tx) => {
    const [recorded] = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type, receivedAt: new Date(now) })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (recorded === undefined) return { result: "duplicate" as const, surplus: null };
    const customerId = snapshot?.customerId ?? event.customerId;
    if (customerId === null) return { result: "ignored" as const, surplus: null };
    const [row] = await tx
      .select()
      .from(patronSubscriptions)
      .where(eq(patronSubscriptions.stripeCustomerId, customerId))
      .for("update");
    if (row === undefined) return { result: "unknown_customer" as const, surplus: null };

    const change =
      snapshot === null ? { kind: "keep" as const } : subscriptionChange(row, snapshot);
    const at = new Date(now);
    let firstPaidAt = row.firstPaidAt;
    let founderAt = row.founderAt;
    const invoice = event.paidInvoice;
    if (invoice !== null && change.kind !== "surplus") {
      const [period] = await tx
        .insert(patronPeriods)
        .values({
          invoiceId: invoice.id,
          userId: row.userId,
          stripeSubscriptionId: invoice.subscriptionId,
          plan: snapshot?.plan ?? row.plan ?? "monthly",
          startsAt: new Date(invoice.startsAt),
          endsAt: new Date(invoice.endsAt),
          amountPaid: invoice.amountPaid,
          paidAt: new Date(invoice.paidAt),
        })
        .onConflictDoNothing()
        .returning({ paidAt: patronPeriods.paidAt });
      if (period !== undefined && firstPaidAt === null) {
        firstPaidAt = period.paidAt;
        const rules = patronRulesAt(PATRON_SCHEDULE, invoice.paidAt);
        if (founderAt === null && isFoundingPayment(rules, invoice.paidAt))
          founderAt = period.paidAt;
      }
    }
    await tx
      .update(patronSubscriptions)
      .set({
        ...(change.kind === "take" ? subscriptionColumns(row, change.snapshot, at) : {}),
        firstPaidAt,
        founderAt,
        updatedAt: at,
      })
      .where(eq(patronSubscriptions.userId, row.userId));
    return {
      result: "applied" as const,
      surplus: change.kind === "surplus" ? change.snapshot.id : null,
    };
  });

  if (outcome.surplus !== null) {
    // Two checkouts paid despite the older one being expired: the second subscription goes.
    console.error("Second patron subscription cancelled", { subscriptionId: outcome.surplus });
    await billing.cancelSubscription(outcome.surplus);
  }
  return outcome.result;
}

type SubscriptionChange =
  | { readonly kind: "take"; readonly snapshot: SubscriptionSnapshot }
  /** An older subscription of the account, ended: it says nothing about the current one. */
  | { readonly kind: "keep" }
  /** A second live subscription next to the current one. */
  | { readonly kind: "surplus"; readonly snapshot: SubscriptionSnapshot };

function subscriptionChange(row: PatronRow, snapshot: SubscriptionSnapshot): SubscriptionChange {
  if (row.stripeSubscriptionId === null || row.stripeSubscriptionId === snapshot.id) {
    return { kind: "take", snapshot };
  }
  if (!isLive(snapshot.status)) return { kind: "keep" };
  if (isLive(row.status)) return { kind: "surplus", snapshot };
  return { kind: "take", snapshot };
}

function subscriptionColumns(row: PatronRow, snapshot: SubscriptionSnapshot, at: Date) {
  const toDate = (time: EpochMs | null) => (time === null ? null : new Date(time));
  return {
    stripeSubscriptionId: snapshot.id,
    status: snapshot.status,
    plan: snapshot.plan,
    currentPeriodEnd: toDate(snapshot.currentPeriodEnd),
    trialEnd: toDate(snapshot.trialEnd),
    cancelAt: toDate(snapshot.cancelAt),
    trialUsedAt: row.trialUsedAt ?? (snapshot.trialEnd === null ? null : at),
  };
}

/**
 * Before an account is deleted: its subscription stops at once and its customer forgets it.
 * Throws when Stripe cannot be reached, so that a deleted account is never billed again.
 */
export async function endBillingOfAccount(
  db: Database,
  billing: Billing,
  userId: string,
): Promise<void> {
  const row = await readRow(db, userId);
  if (row === undefined) return;
  if (row.stripeSubscriptionId !== null && isLive(row.status)) {
    await billing.cancelSubscription(row.stripeSubscriptionId);
  }
  await billing.forgetCustomer(row.stripeCustomerId);
}
