import {
  PATRON_PORTAL_RETURN_QUERY,
  type PatronClaimRefusal,
  type PatronRefusal,
  type PatronResponse,
  type PatronSales,
} from "@leximon/contract";
import {
  type ClaimedReward,
  claimableCosmetics,
  type EpochMs,
  isFoundingPayment,
  monthCosmetic,
  PATRON_SCHEDULE,
  type PaidPeriod,
  type PatronCosmetic,
  type PatronMark,
  type PatronPlan,
  type PatronStanding,
  patronMark,
  patronRulesAt,
  patronStanding,
  patronTitle,
  type SubscriptionStatus,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, inArray } from "drizzle-orm";
import { ADMIN_ROLE } from "../auth";
import { type Billing, billingConfigured, type SubscriptionSnapshot } from "./billing";
import { readDiscordLink } from "./discord";
import type { BillingEvent } from "./events";
import { readCurrentPoll } from "./polls";
import { findsLeftOf, readFinds } from "./reserve";
import { readThanksWaiting } from "./thanks";

const {
  patronCosmeticClaims,
  patronPeriods,
  patronSubscriptions,
  playerAgeBrackets,
  stripeEvents,
  users,
} = schema;

type PatronRow = typeof patronSubscriptions.$inferSelect;
type Reader = Pick<Database, "select">;

const standingOf = (row: Pick<PatronRow, "status" | "firstPaidAt">): PatronStanding =>
  patronStanding(row.status as SubscriptionStatus | null, row.firstPaidAt?.getTime() ?? null);

/** A subscription Stripe still bills or may bill again: the account cannot open a second one. */
const LIVE_STATUSES: ReadonlySet<string> = new Set<SubscriptionStatus>([
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

async function readRow(db: Database, userId: string): Promise<PatronRow | undefined> {
  const [row] = await db
    .select()
    .from(patronSubscriptions)
    .where(eq(patronSubscriptions.userId, userId));
  return row;
}

export const standingOfRow = (
  row: Pick<PatronRow, "status" | "firstPaidAt"> | undefined,
): PatronStanding => (row === undefined ? "none" : standingOf(row));

export async function readPatron(
  db: Database,
  input: {
    readonly userId: string;
    readonly sales: PatronSales;
    readonly discordAvailable: boolean;
    readonly now: EpochMs;
  },
): Promise<PatronResponse> {
  const [row, buyer, bracket, periods, claimed, finds, poll, discord, thanksWaiting] =
    await Promise.all([
      readRow(db, input.userId),
      readBuyer(db, input.userId),
      db
        .select({ bracket: playerAgeBrackets.bracket })
        .from(playerAgeBrackets)
        .where(eq(playerAgeBrackets.userId, input.userId)),
      readPeriods(db, input.userId),
      readClaimedMonths(db, input.userId),
      readFinds(db, input.userId),
      readCurrentPoll(db, input.userId, input.now),
      readDiscordLink(db, input.userId),
      readThanksWaiting(db, input.userId, input.now),
    ]);
  const rules = patronRulesAt(PATRON_SCHEDULE, input.now);
  const standing = standingOfRow(row);
  const founder = row?.founderAt != null;
  return {
    sales: input.sales,
    minor: bracket[0]?.bracket === "15-17",
    mark: patronMark(standing, founder),
    monthCosmetic: monthCosmetic(rules, input.now),
    claimable: claimableCosmetics(rules, periods, claimed, input.now),
    canBuy: buyRefusal(input.sales, buyer, row) === null,
    founder,
    foundingOffer: isFoundingPayment(rules, input.now),
    thanksListed: row?.thanksHidden !== true,
    thanksWaiting,
    poll,
    discord: { available: input.discordAvailable, username: discord?.username ?? null },
    finds: {
      left: findsLeftOf(rules, periods, finds, standing, input.now),
      words: finds.map((find) => ({
        id: find.id,
        word: find.word,
        state: find.state,
        foundAt: find.foundAt.toISOString(),
      })),
    },
    subscription:
      row?.stripeSubscriptionId == null
        ? null
        : {
            standing,
            plan: row.plan as PatronPlan | null,
            currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
            cancelAt: row.cancelAt?.toISOString() ?? null,
            paymentFailing: row.status === "past_due",
            since: row.firstPaidAt?.toISOString() ?? null,
          },
  };
}

export async function readPeriods(db: Reader, userId: string): Promise<PaidPeriod[]> {
  const rows = await db
    .select({
      startsAt: patronPeriods.startsAt,
      endsAt: patronPeriods.endsAt,
      refundedAt: patronPeriods.refundedAt,
      plan: patronPeriods.plan,
    })
    .from(patronPeriods)
    .where(eq(patronPeriods.userId, userId));
  return rows.map((row) => ({
    startsAt: row.startsAt.getTime(),
    endsAt: row.endsAt.getTime(),
    refunded: row.refundedAt !== null,
    plan: row.plan as PatronPlan,
  }));
}

async function readClaimedMonths(db: Reader, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ month: patronCosmeticClaims.month })
    .from(patronCosmeticClaims)
    .where(eq(patronCosmeticClaims.userId, userId));
  return new Set(rows.map((row) => row.month));
}

export type CosmeticClaimResult =
  | { readonly kind: "claimed"; readonly cosmetics: readonly PatronCosmetic[] }
  | { readonly kind: "refused"; readonly reason: PatronClaimRefusal };

/**
 * Claims the cosmetic of a month paid for. Under the lock of the patron's row, as the webhook
 * that writes the periods: a refund applied at the same time is seen, or sees the claim.
 */
export async function claimCosmetic(
  db: Database,
  input: { readonly userId: string; readonly month: string; readonly now: EpochMs },
): Promise<CosmeticClaimResult> {
  return db.transaction(async (tx): Promise<CosmeticClaimResult> => {
    const [row] = await tx
      .select({ userId: patronSubscriptions.userId })
      .from(patronSubscriptions)
      .where(eq(patronSubscriptions.userId, input.userId))
      .for("update");
    if (row === undefined) return { kind: "refused", reason: "nothing_to_claim" };
    const rules = patronRulesAt(PATRON_SCHEDULE, input.now);
    const [periods, claimed] = await Promise.all([
      readPeriods(tx, input.userId),
      readClaimedMonths(tx, input.userId),
    ]);
    const found = claimableCosmetics(rules, periods, claimed, input.now).find(
      (claimable) => claimable.month === input.month,
    );
    if (found === undefined) return { kind: "refused", reason: "nothing_to_claim" };
    await tx.insert(patronCosmeticClaims).values({
      userId: input.userId,
      month: found.month,
      cosmetics: found.cosmetics,
      claimedAt: new Date(input.now),
    });
    return { kind: "claimed", cosmetics: found.cosmetics };
  });
}

/**
 * What a patron may wear, read as coffrets so that the profile's wardrobe takes it in: the
 * cosmetics claimed, kept for life, then the title and the extra pinned cards while subscribed.
 */
export async function readPatronWardrobe(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<ClaimedReward[]> {
  const [rows, claims] = await Promise.all([
    db
      .select({
        status: patronSubscriptions.status,
        firstPaidAt: patronSubscriptions.firstPaidAt,
        founderAt: patronSubscriptions.founderAt,
      })
      .from(patronSubscriptions)
      .where(eq(patronSubscriptions.userId, userId)),
    db
      .select({ cosmetics: patronCosmeticClaims.cosmetics })
      .from(patronCosmeticClaims)
      .where(eq(patronCosmeticClaims.userId, userId)),
  ]);
  const row = rows[0];
  const standing = row === undefined ? "none" : standingOf(row);
  const title = row === undefined ? null : patronTitle(standing, row.founderAt !== null);
  const slots = standing === "patron" ? patronRulesAt(PATRON_SCHEDULE, now).extraPinnedSlots : 0;
  return [
    ...claims.map((claim) => ({ rewards: [...claim.cosmetics] })),
    ...(title === null ? [] : [{ rewards: [{ kind: "title" as const, title }] }]),
    ...(slots === 0
      ? []
      : [{ rewards: Array.from({ length: slots }, () => ({ kind: "pinned_slot" as const })) }]),
  ];
}

/** A paying patron now, unlike a founder who stopped and keeps the mark. */
export async function paysAsPatron(db: Reader, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: patronSubscriptions.status, firstPaidAt: patronSubscriptions.firstPaidAt })
    .from(patronSubscriptions)
    .where(eq(patronSubscriptions.userId, userId));
  return standingOfRow(row) === "patron";
}

/** The marks of several players in one query, by user id; players without one are missing. */
export async function readPatronMarks(
  db: Reader,
  userIds: readonly string[],
): Promise<Map<string, Exclude<PatronMark, null>>> {
  const marks = new Map<string, Exclude<PatronMark, null>>();
  if (userIds.length === 0) return marks;
  const rows = await db
    .select({
      userId: patronSubscriptions.userId,
      status: patronSubscriptions.status,
      firstPaidAt: patronSubscriptions.firstPaidAt,
      founderAt: patronSubscriptions.founderAt,
    })
    .from(patronSubscriptions)
    .where(inArray(patronSubscriptions.userId, [...new Set(userIds)]));
  for (const row of rows) {
    const mark = patronMark(standingOf(row), row.founderAt !== null);
    if (mark !== null) marks.set(row.userId, mark);
  }
  return marks;
}

export type CheckoutResult =
  | { readonly kind: "opened"; readonly url: string }
  | { readonly kind: "refused"; readonly reason: PatronRefusal };

/**
 * Opens a Stripe checkout. Nothing is granted here: the subscription exists once Stripe says so,
 * through the webhook. The customer is made before the first checkout and kept, so that every
 * checkout and the portal know the player.
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
  const session = await billing.createCheckout({
    customerId: row.stripeCustomerId,
    userId: input.userId,
    plan: input.plan,
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
  const url = await billing.createPortal(
    row.stripeCustomerId,
    `${input.webUrl}/mecene?${PATRON_PORTAL_RETURN_QUERY}`,
  );
  return { kind: "opened", url };
}

/**
 * Back from Stripe's portal: the subscription read again from Stripe, so that a cancellation
 * shows at once even when the webhook is late. Returns whether the standing changed, for the
 * Discord role to follow.
 */
export async function refreshSubscription(
  db: Database,
  billing: Billing,
  input: { readonly userId: string; readonly now: EpochMs },
): Promise<boolean> {
  const found = await readRow(db, input.userId);
  if (found?.stripeSubscriptionId == null) return false;
  const snapshot = await billing.retrieveSubscription(found.stripeSubscriptionId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(patronSubscriptions)
      .where(eq(patronSubscriptions.userId, input.userId))
      .for("update");
    // A newer subscription came meanwhile: the webhook tells about it.
    if (row === undefined || row.stripeSubscriptionId !== snapshot.id) return false;
    await tx
      .update(patronSubscriptions)
      .set({ ...subscriptionColumns(snapshot), updatedAt: new Date(input.now) })
      .where(eq(patronSubscriptions.userId, input.userId));
    return standingOf(row) !== standingOf({ ...row, status: snapshot.status });
  });
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
): Promise<{ readonly result: EventResult; readonly userId: string | null }> {
  const [seen] = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, event.id));
  if (seen !== undefined) return { result: "duplicate", userId: null };
  const snapshot =
    event.subscriptionId === null ? null : await billing.retrieveSubscription(event.subscriptionId);

  const outcome = await db.transaction(async (tx) => {
    const [recorded] = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type, receivedAt: new Date(now) })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    const none = { surplus: null, userId: null };
    if (recorded === undefined) return { result: "duplicate" as const, ...none };
    const customerId = snapshot?.customerId ?? event.customerId;
    if (customerId === null) return { result: "ignored" as const, ...none };
    const [row] = await tx
      .select()
      .from(patronSubscriptions)
      .where(eq(patronSubscriptions.stripeCustomerId, customerId))
      .for("update");
    if (row === undefined) return { result: "unknown_customer" as const, ...none };

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
        ...(change.kind === "take" ? subscriptionColumns(change.snapshot) : {}),
        firstPaidAt,
        founderAt,
        updatedAt: at,
      })
      .where(eq(patronSubscriptions.userId, row.userId));
    return {
      result: "applied" as const,
      surplus: change.kind === "surplus" ? change.snapshot.id : null,
      userId: row.userId,
    };
  });

  if (outcome.surplus !== null) {
    // Two checkouts paid despite the older one being expired: the second subscription goes.
    console.error("Second patron subscription cancelled", { subscriptionId: outcome.surplus });
    await billing.cancelSubscription(outcome.surplus);
  }
  return { result: outcome.result, userId: outcome.userId };
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

function subscriptionColumns(snapshot: SubscriptionSnapshot) {
  const toDate = (time: EpochMs | null) => (time === null ? null : new Date(time));
  return {
    stripeSubscriptionId: snapshot.id,
    status: snapshot.status,
    plan: snapshot.plan,
    currentPeriodEnd: toDate(snapshot.currentPeriodEnd),
    cancelAt: toDate(snapshot.cancelAt),
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
