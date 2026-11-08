import {
  IDEMPOTENCY_KEY_HEADER,
  patronRedirectResponseSchema,
  patronRefusalSchema,
  patronResponseSchema,
} from "@leximon/contract";
import { PATRON_SCHEDULE } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { ADMIN_ROLE } from "../auth";
import { TEST_ORIGIN, TEST_STRIPE_WEBHOOK_SECRET, testEnv } from "../test-env";
import { type Guest, signInAsGuest, signInAsMember } from "../test-support";
import type { Billing, CheckoutInput, SubscriptionSnapshot } from "./billing";

const url = testDatabaseUrl();
const env = testEnv(url);
const { db, close } = createDb(url, { maxConnections: 4 });
afterAll(close);

const DAY = 86_400_000;
const TRIAL_DAYS = PATRON_SCHEDULE[0].trialDays;

/** Stripe, as far as the game asks it: subscriptions are set by the test, as Stripe would. */
function fakeStripe() {
  let next = 0;
  const id = (prefix: string) => `${prefix}_${++next}_${crypto.randomUUID().slice(0, 8)}`;
  const customers = new Map<string, string>();
  const subscriptions = new Map<string, SubscriptionSnapshot>();
  const checkouts: CheckoutInput[] = [];
  const expired: string[] = [];
  const cancelled: string[] = [];
  const forgotten: string[] = [];
  let failing = false;
  const reachable = () => {
    if (failing) throw new Error("Stripe unreachable");
  };
  const billing: Billing = {
    async createCustomer(userId) {
      reachable();
      const known = customers.get(userId);
      if (known !== undefined) return known;
      const customerId = id("cus");
      customers.set(userId, customerId);
      return customerId;
    },
    async createCheckout(input) {
      reachable();
      checkouts.push(input);
      const sessionId = id("cs");
      return { id: sessionId, url: `https://checkout.stripe.com/c/pay/${sessionId}` };
    },
    async expireCheckout(sessionId) {
      reachable();
      expired.push(sessionId);
    },
    async createPortal(customerId) {
      reachable();
      return `https://billing.stripe.com/p/session/${customerId}`;
    },
    async retrieveSubscription(subscriptionId) {
      reachable();
      const subscription = subscriptions.get(subscriptionId);
      if (subscription === undefined) throw new Error(`No subscription ${subscriptionId}`);
      return subscription;
    },
    async cancelSubscription(subscriptionId) {
      reachable();
      cancelled.push(subscriptionId);
      const subscription = subscriptions.get(subscriptionId);
      if (subscription !== undefined) {
        subscriptions.set(subscriptionId, { ...subscription, status: "canceled" });
      }
    },
    async forgetCustomer(customerId) {
      reachable();
      forgotten.push(customerId);
    },
  };
  return {
    billing,
    customers,
    subscriptions,
    checkouts,
    expired,
    cancelled,
    forgotten,
    newSubscriptionId: () => id("sub"),
    setFailing: (value: boolean) => {
      failing = value;
    },
  };
}

const stripe = fakeStripe();
const app = createApp({ billing: () => stripe.billing });

function request(
  player: Guest,
  method: string,
  path: string,
  body?: unknown,
  requestEnv: Env = env,
) {
  const headers: Record<string, string> = {
    origin: TEST_ORIGIN,
    cookie: player.cookie,
    "content-type": "application/json",
    [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
  };
  return app.request(
    path,
    { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    requestEnv,
  );
}

async function readPatron(player: Guest) {
  const response = await request(player, "GET", "/me/patron");
  expect(response.status).toBe(200);
  return patronResponseSchema.parse(await response.json());
}

const checkout = (player: Guest, plan = "monthly", requestEnv: Env = env) =>
  request(player, "POST", "/me/patron/checkout", { plan, waiverAccepted: true }, requestEnv);

async function sendEvent(type: string, object: Record<string, unknown>, eventId?: string) {
  const payload = JSON.stringify({
    id: eventId ?? `evt_${crypto.randomUUID()}`,
    object: "event",
    type,
    data: { object },
  });
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: TEST_STRIPE_WEBHOOK_SECRET,
  });
  return app.request(
    "/stripe/webhook",
    {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: payload,
    },
    env,
  );
}

async function eventResult(response: Response) {
  expect(response.status).toBe(200);
  return ((await response.json()) as { result: string }).result;
}

const seconds = (time: number) => Math.floor(time / 1000);

/** What Stripe has once a checkout is paid: a subscription, and the customer's id. */
function subscribe(
  customerId: string,
  overrides: Partial<SubscriptionSnapshot> = {},
): SubscriptionSnapshot {
  const now = Date.now();
  const subscription: SubscriptionSnapshot = {
    id: stripe.newSubscriptionId(),
    customerId,
    status: "trialing",
    plan: "monthly",
    currentPeriodEnd: now + TRIAL_DAYS * DAY,
    trialEnd: now + TRIAL_DAYS * DAY,
    cancelAt: null,
    ...overrides,
  };
  stripe.subscriptions.set(subscription.id, subscription);
  return subscription;
}

const checkoutCompleted = (subscription: SubscriptionSnapshot) =>
  sendEvent("checkout.session.completed", {
    id: `cs_${crypto.randomUUID()}`,
    object: "checkout.session",
    mode: "subscription",
    customer: subscription.customerId,
    subscription: subscription.id,
    client_reference_id: "ignored",
  });

function invoicePaid(subscription: SubscriptionSnapshot, invoiceId = `in_${crypto.randomUUID()}`) {
  const now = Date.now();
  return sendEvent("invoice.paid", {
    id: invoiceId,
    object: "invoice",
    customer: subscription.customerId,
    amount_paid: 399,
    status_transitions: { paid_at: seconds(now) },
    parent: {
      type: "subscription_details",
      subscription_details: { subscription: subscription.id },
    },
    lines: {
      object: "list",
      data: [{ period: { start: seconds(now), end: seconds(now + 30 * DAY) } }],
    },
  });
}

/** A member who went through checkout once: the customer exists. */
async function memberWithCustomer() {
  const member = await signInAsMember(app, env, db);
  expect((await checkout(member)).status).toBe(200);
  const customerId = stripe.customers.get(member.userId);
  if (customerId === undefined) throw new Error("No customer made");
  return { member, customerId };
}

async function rowOf(userId: string) {
  const [row] = await db
    .select()
    .from(schema.patronSubscriptions)
    .where(eq(schema.patronSubscriptions.userId, userId));
  return row;
}

describe("the patron page", () => {
  it("offers the subscription and its trial to a member who never subscribed", async () => {
    const member = await signInAsMember(app, env, db);
    expect(await readPatron(member)).toEqual({
      sales: "open",
      canBuy: true,
      trialAvailable: true,
      trialDays: TRIAL_DAYS,
      founder: false,
      subscription: null,
    });
  });

  it("does not sell to a guest", async () => {
    const guest = await signInAsGuest(app, env);
    expect((await readPatron(guest)).canBuy).toBe(false);
    const response = await checkout(guest);
    expect(response.status).toBe(409);
    expect(patronRefusalSchema.parse(await response.json()).error).toBe("guest");
  });

  it("sells to admins alone before sales open", async () => {
    const closed = { ...env, PATRON_SALES: "closed" };
    const member = await signInAsMember(app, env, db);
    const refused = await checkout(member, "monthly", closed);
    expect(refused.status).toBe(409);
    expect(patronRefusalSchema.parse(await refused.json()).error).toBe("sales_closed");

    const admin = await signInAsMember(app, env, db);
    await db
      .update(schema.users)
      .set({ role: ADMIN_ROLE })
      .where(eq(schema.users.id, admin.userId));
    expect((await checkout(admin, "yearly", closed)).status).toBe(200);
  });

  it("sells nothing without Stripe's secrets", async () => {
    const unconfigured = { ...env, STRIPE_SECRET_KEY: "" };
    const member = await signInAsMember(app, env, db);
    const page = await request(member, "GET", "/me/patron", undefined, unconfigured);
    expect(patronResponseSchema.parse(await page.json()).sales).toBe("unavailable");
    expect((await checkout(member, "monthly", unconfigured)).status).toBe(409);
  });
});

describe("checkout", () => {
  it("asks for the box giving up the right of withdrawal", async () => {
    const member = await signInAsMember(app, env, db);
    const response = await request(member, "POST", "/me/patron/checkout", {
      plan: "monthly",
      waiverAccepted: false,
    });
    expect(response.status).toBe(400);
  });

  it("opens Stripe's page with the trial, the plan and the way back", async () => {
    const member = await signInAsMember(app, env, db);
    const response = await checkout(member, "yearly");
    expect(response.status).toBe(200);
    const { url: pageUrl } = patronRedirectResponseSchema.parse(await response.json());
    expect(pageUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const sent = stripe.checkouts.at(-1);
    expect(sent).toMatchObject({
      userId: member.userId,
      plan: "yearly",
      trialDays: TRIAL_DAYS,
      successUrl: "http://localhost:3000/mecene?merci",
      cancelUrl: "http://localhost:3000/mecene",
    });
    const row = await rowOf(member.userId);
    expect(row?.waiverAcceptedAt).not.toBeNull();
    expect(row?.stripeSubscriptionId).toBeNull();
  });

  it("keeps one customer per account and expires the checkout left open", async () => {
    const { member, customerId } = await memberWithCustomer();
    const first = (await rowOf(member.userId))?.checkoutSessionId;
    expect((await checkout(member)).status).toBe(200);
    expect(stripe.customers.get(member.userId)).toBe(customerId);
    expect(stripe.expired).toContain(first);
    expect(stripe.checkouts.at(-1)?.customerId).toBe(customerId);
  });

  it("makes one customer when two first checkouts come at once", async () => {
    const member = await signInAsMember(app, env, db);
    const responses = await Promise.all([checkout(member), checkout(member)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const rows = await db
      .select()
      .from(schema.patronSubscriptions)
      .where(eq(schema.patronSubscriptions.userId, member.userId));
    expect(rows).toHaveLength(1);
  });
});

describe("Stripe's webhook", () => {
  it("refuses a request Stripe did not sign", async () => {
    const response = await app.request(
      "/stripe/webhook",
      {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=forged" },
        body: JSON.stringify({ id: "evt_forged", type: "invoice.paid", data: { object: {} } }),
      },
      env,
    );
    expect(response.status).toBe(400);
  });

  it("starts a trial with the title and the badge, and nothing more to buy", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId);
    expect(await eventResult(await checkoutCompleted(subscription))).toBe("applied");

    const patron = await readPatron(member);
    expect(patron.subscription).toMatchObject({ standing: "trial", plan: "monthly", since: null });
    expect(patron.canBuy).toBe(false);
    expect(patron.trialAvailable).toBe(false);
    const again = await checkout(member);
    expect(patronRefusalSchema.parse(await again.json()).error).toBe("already_patron");
  });

  it("makes a patron at the first payment, and keeps the months paid", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId);
    await checkoutCompleted(subscription);
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "active" });
    expect(await eventResult(await invoicePaid(subscription))).toBe("applied");

    const patron = await readPatron(member);
    expect(patron.subscription?.standing).toBe("patron");
    expect(patron.subscription?.since).not.toBeNull();
    const periods = await db
      .select()
      .from(schema.patronPeriods)
      .where(eq(schema.patronPeriods.userId, member.userId));
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ plan: "monthly", amountPaid: 399 });
  });

  it("counts no period for the invoice of zero that starts a trial", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId);
    const response = await sendEvent("invoice.paid", {
      id: `in_${crypto.randomUUID()}`,
      object: "invoice",
      customer: customerId,
      amount_paid: 0,
      status_transitions: { paid_at: seconds(Date.now()) },
      parent: { subscription_details: { subscription: subscription.id } },
      lines: { data: [{ period: { start: 1, end: 2 } }] },
    });
    expect(await eventResult(response)).toBe("applied");
    expect((await readPatron(member)).subscription?.standing).toBe("trial");
    const periods = await db
      .select()
      .from(schema.patronPeriods)
      .where(eq(schema.patronPeriods.userId, member.userId));
    expect(periods).toHaveLength(0);
  });

  it("applies an event once, even sent twice at the same time", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId, { status: "active", trialEnd: null });
    await checkoutCompleted(subscription);
    const invoiceId = `in_${crypto.randomUUID()}`;
    const eventId = `evt_${crypto.randomUUID()}`;
    const send = () =>
      sendEvent(
        "invoice.paid",
        {
          id: invoiceId,
          customer: customerId,
          amount_paid: 399,
          status_transitions: { paid_at: seconds(Date.now()) },
          parent: { subscription_details: { subscription: subscription.id } },
          lines: {
            data: [{ period: { start: seconds(Date.now()), end: seconds(Date.now() + DAY) } }],
          },
        },
        eventId,
      );
    const results = await Promise.all([send(), send(), send()]);
    const outcomes = await Promise.all(results.map(eventResult));
    expect(outcomes.filter((outcome) => outcome === "applied")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "duplicate")).toHaveLength(2);
    const periods = await db
      .select()
      .from(schema.patronPeriods)
      .where(eq(schema.patronPeriods.userId, member.userId));
    expect(periods).toHaveLength(1);
  });

  it("follows Stripe's latest state whatever order the events come in", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId, { status: "active", trialEnd: null });
    await checkoutCompleted(subscription);
    const cancelAt = Date.now() + 10 * DAY;
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled", cancelAt });
    await sendEvent("customer.subscription.deleted", { id: subscription.id, customer: customerId });
    // The update that came before the deletion arrives last.
    await sendEvent("customer.subscription.updated", { id: subscription.id, customer: customerId });

    const patron = await readPatron(member);
    expect(patron.subscription?.standing).toBe("none");
    expect(patron.canBuy).toBe(true);
  });

  it("says when a subscription stops, and when a payment fails", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId, { status: "active", trialEnd: null });
    await checkoutCompleted(subscription);
    await invoicePaid(subscription);
    const cancelAt = Date.now() + 20 * DAY;
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "past_due", cancelAt });
    await sendEvent("invoice.payment_failed", {
      id: `in_${crypto.randomUUID()}`,
      customer: customerId,
      amount_paid: 0,
      status_transitions: { paid_at: null },
      parent: { subscription_details: { subscription: subscription.id } },
      lines: { data: [] },
    });
    const patron = await readPatron(member);
    expect(patron.subscription).toMatchObject({
      standing: "patron",
      paymentFailing: true,
      cancelAt: new Date(cancelAt).toISOString(),
    });
  });

  it("gives no second trial, after a trial or after a payment", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId);
    await checkoutCompleted(subscription);
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", { id: subscription.id, customer: customerId });

    expect((await readPatron(member)).trialAvailable).toBe(false);
    expect((await checkout(member)).status).toBe(200);
    expect(stripe.checkouts.at(-1)?.trialDays).toBeNull();
  });

  it("cancels a second subscription opened next to a live one", async () => {
    const { member, customerId } = await memberWithCustomer();
    const first = subscribe(customerId, { status: "active", trialEnd: null });
    await checkoutCompleted(first);
    const second = subscribe(customerId, { status: "active", trialEnd: null });
    expect(await eventResult(await checkoutCompleted(second))).toBe("applied");

    expect(stripe.cancelled).toContain(second.id);
    expect((await rowOf(member.userId))?.stripeSubscriptionId).toBe(first.id);
  });

  it("leaves alone the customers of other products", async () => {
    const subscription = subscribe("cus_someone_else", { status: "active" });
    expect(await eventResult(await checkoutCompleted(subscription))).toBe("unknown_customer");
  });

  it("acknowledges the events it does not act on", async () => {
    const response = await sendEvent("customer.created", { id: "cus_x" });
    expect(await eventResult(response)).toBe("ignored");
  });
});

describe("the subscription portal", () => {
  it("opens for a subscriber only", async () => {
    const { member, customerId } = await memberWithCustomer();
    const before = await request(member, "POST", "/me/patron/portal");
    expect(patronRefusalSchema.parse(await before.json()).error).toBe("not_subscribed");

    await checkoutCompleted(subscribe(customerId));
    const after = await request(member, "POST", "/me/patron/portal");
    expect(after.status).toBe(200);
    expect(patronRedirectResponseSchema.parse(await after.json()).url).toContain(customerId);
  });
});

describe("deleting an account", () => {
  it("stops the subscription and makes Stripe forget the account", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId, { status: "active", trialEnd: null });
    await checkoutCompleted(subscription);

    expect((await request(member, "DELETE", "/me/account")).status).toBe(204);
    expect(stripe.cancelled).toContain(subscription.id);
    expect(stripe.forgotten).toContain(customerId);
    expect(await rowOf(member.userId)).toBeUndefined();
  });

  it("deletes nothing while Stripe cannot be reached", async () => {
    const { member, customerId } = await memberWithCustomer();
    await checkoutCompleted(subscribe(customerId, { status: "active", trialEnd: null }));
    stripe.setFailing(true);
    try {
      expect((await request(member, "DELETE", "/me/account")).status).toBe(503);
    } finally {
      stripe.setFailing(false);
    }
    expect(await rowOf(member.userId)).toBeDefined();
  });
});
