import {
  adminPatronRefundResponseSchema,
  adminPatronsResponseSchema,
  editionRefusalSchema,
  editionsResponseSchema,
  findRefusalSchema,
  findResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  patronClaimRefusalSchema,
  patronClaimResponseSchema,
  patronRedirectResponseSchema,
  patronRefusalSchema,
  patronResponseSchema,
  profileResponseSchema,
  publicProfileSchema,
  reserveResponseSchema,
} from "@leximon/contract";
import {
  PATRON_SCHEDULE,
  parisMonthOf,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
  xpToReach,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { rejectFind } from "@leximon/db/catalog";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ADMIN_ROLE } from "../auth";
import { TEST_ORIGIN, TEST_STRIPE_WEBHOOK_SECRET, testEnv } from "../test-env";
import {
  type Guest,
  STARTER_COLLECTION,
  seedTestCatalog,
  setOwnedCards,
  setXp,
  signInAsGuest,
  signInAsMember,
} from "../test-support";
import { ensurePlayer } from "../trades/players";
import type { Billing, CheckoutInput, SubscriptionSnapshot } from "./billing";

/** The calendar is empty until the cosmetics are drawn: this month gets one for the tests. */
vi.mock("@leximon/core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@leximon/core")>();
  const [rules] = core.PATRON_SCHEDULE;
  return {
    ...core,
    PATRON_SCHEDULE: [
      { ...rules, cosmetics: { [core.parisMonthOf(Date.now())]: { kind: "frame", frame: "wax" } } },
    ],
  };
});

const url = testDatabaseUrl();
const env = testEnv(url);
const { db, close } = createDb(url, { maxConnections: 4 });
afterAll(close);

const DAY = 86_400_000;
const TRIAL_DAYS = PATRON_SCHEDULE[0].trialDays;
const THIS_MONTH = parisMonthOf(Date.now());

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
  const refunds: string[] = [];
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
    async refundInvoice(invoiceId) {
      reachable();
      refunds.push(invoiceId);
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
    refunds,
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
      minor: false,
      mark: null,
      monthCosmetic: { month: THIS_MONTH, cosmetic: { kind: "frame", frame: "wax" } },
      claimable: [],
      canBuy: true,
      trialAvailable: true,
      trialDays: TRIAL_DAYS,
      founder: false,
      foundingOffer: false,
      finds: { left: 0, words: [] },
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

/** A member whose first month is paid. */
async function payingPatron() {
  const { member, customerId } = await memberWithCustomer();
  const subscription = subscribe(customerId, { status: "active", trialEnd: null });
  await checkoutCompleted(subscription);
  await invoicePaid(subscription);
  return { member, customerId, subscription };
}

async function readProfile(player: Guest) {
  const response = await request(player, "GET", "/me/profile");
  expect(response.status).toBe(200);
  return profileResponseSchema.parse(await response.json());
}

const claim = (player: Guest, month = THIS_MONTH) =>
  request(player, "POST", `/me/patron/cosmetics/${month}/claim`);

describe("the cosmetic of the month", () => {
  it("is claimed once by a patron who paid for the month, and kept in the wardrobe", async () => {
    const { member } = await payingPatron();
    expect((await readPatron(member)).claimable).toEqual([
      { month: THIS_MONTH, cosmetic: { kind: "frame", frame: "wax" } },
    ]);
    const claimed = await claim(member);
    expect(claimed.status).toBe(200);
    expect(patronClaimResponseSchema.parse(await claimed.json()).cosmetic).toEqual({
      kind: "frame",
      frame: "wax",
    });
    expect((await readProfile(member)).wardrobe.frames).toContain("wax");
    expect((await readPatron(member)).claimable).toEqual([]);
    const again = await claim(member);
    expect(again.status).toBe(409);
    expect(patronClaimRefusalSchema.parse(await again.json()).error).toBe("nothing_to_claim");
  });

  it("is claimed once when two claims come at the same time", async () => {
    const { member } = await payingPatron();
    const statuses = (await Promise.all([claim(member), claim(member)])).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it("waits for the first payment: nothing during the trial", async () => {
    const { member, customerId } = await memberWithCustomer();
    await checkoutCompleted(subscribe(customerId));
    expect((await readPatron(member)).claimable).toEqual([]);
    expect((await claim(member)).status).toBe(409);
  });

  it("stays in the wardrobe after the subscription ends", async () => {
    const { member, customerId, subscription } = await payingPatron();
    await claim(member);
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", { id: subscription.id, customer: customerId });
    expect((await readProfile(member)).wardrobe.frames).toContain("wax");
  });
});

describe("the title and the mark", () => {
  it("come with the trial and go with the subscription, the claimed cosmetics stay", async () => {
    const { member, customerId } = await memberWithCustomer();
    const subscription = subscribe(customerId);
    await checkoutCompleted(subscription);
    const during = await readProfile(member);
    expect(during.wardrobe.titles).toContain("Mécène");
    expect(during.patron).toBe("patron");
    expect((await readPatron(member)).mark).toBe("patron");

    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", { id: subscription.id, customer: customerId });
    const after = await readProfile(member);
    expect(after.wardrobe.titles).not.toContain("Mécène");
    expect(after.patron).toBeNull();
  });

  it("keeps a founder's mark for life", async () => {
    const { member, customerId, subscription } = await payingPatron();
    await db
      .update(schema.patronSubscriptions)
      .set({ founderAt: new Date() })
      .where(eq(schema.patronSubscriptions.userId, member.userId));
    expect((await readProfile(member)).wardrobe.titles).toContain("Mécène fondateur");
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", { id: subscription.id, customer: customerId });
    const after = await readProfile(member);
    expect(after.patron).toBe("founder");
    expect(after.wardrobe.titles).not.toContain("Mécène fondateur");
  });

  it("asks a player declared 15 to 17 for a parent's agreement", async () => {
    const member = await signInAsMember(app, env, db);
    await db.insert(schema.playerAgeBrackets).values({ userId: member.userId, bracket: "15-17" });
    expect((await readPatron(member)).minor).toBe(true);
  });
});

describe("the back office", () => {
  async function admin() {
    const player = await signInAsMember(app, env, db);
    await db
      .update(schema.users)
      .set({ role: ADMIN_ROLE })
      .where(eq(schema.users.id, player.userId));
    return player;
  }

  it("is for admins only", async () => {
    const member = await signInAsMember(app, env, db);
    expect((await request(member, "GET", "/admin/patrons")).status).toBe(403);
  });

  it("lists the subscribers with their latest payment, and counts them", async () => {
    const { member } = await payingPatron();
    const response = await request(await admin(), "GET", "/admin/patrons");
    expect(response.status).toBe(200);
    const list = adminPatronsResponseSchema.parse(await response.json());
    const row = list.patrons.find((patron) => patron.userId === member.userId);
    expect(row).toMatchObject({ standing: "patron", plan: "monthly", founder: false });
    expect(row?.lastPayment).toMatchObject({ amount: 399, refunded: false });
    expect(list.counts.patrons).toBeGreaterThanOrEqual(1);
    expect(list.monthlyRevenue).toBeGreaterThanOrEqual(399);
  });

  it("refunds the latest payment and stops the subscription, once for a retried request", async () => {
    const { member, subscription } = await payingPatron();
    const officer = await admin();
    const key = crypto.randomUUID();
    const refund = () =>
      app.request(
        `/admin/patrons/${member.userId}/refund`,
        {
          method: "POST",
          headers: { origin: TEST_ORIGIN, cookie: officer.cookie, [IDEMPOTENCY_KEY_HEADER]: key },
        },
        env,
      );
    const first = await refund();
    expect(first.status).toBe(200);
    expect(adminPatronRefundResponseSchema.parse(await first.json()).refunded).toBe(399);
    const refundsBefore = stripe.refunds.length;
    expect((await refund()).status).toBe(200);
    expect(stripe.refunds.length).toBe(refundsBefore);
    expect(stripe.cancelled).toContain(subscription.id);
    const [period] = await db
      .select()
      .from(schema.patronPeriods)
      .where(eq(schema.patronPeriods.userId, member.userId));
    expect(period?.refundedAt).not.toBeNull();
    expect((await readPatron(member)).claimable).toEqual([]);
  });

  it("refuses a refund for a player who never subscribed", async () => {
    const member = await signInAsMember(app, env, db);
    const response = await request(await admin(), "POST", `/admin/patrons/${member.userId}/refund`);
    expect(response.status).toBe(409);
  });
});

/** Words of the reserve under a prefix of their own, so that each test reads only its words. */
async function reserveOf(count: number) {
  const prefix = `zq${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const words = Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    word: `${prefix}${index}`,
    definition: "Un mot de la réserve.",
    theme: null,
    partOfSpeech: "s. m.",
    searchKey: `${prefix}${index}`,
    release: "2026-11-08.1",
  }));
  await db.insert(schema.reserveWords).values(words);
  return { prefix, ids: words.map((word) => word.id) };
}

/** A patron who paid a year: one word to find at once. */
async function yearlyPatron(pseudo: string | null = `Mecene${crypto.randomUUID().slice(0, 6)}`) {
  const { member, customerId } = await memberWithCustomer();
  const subscription = subscribe(customerId, { status: "active", trialEnd: null, plan: "yearly" });
  await checkoutCompleted(subscription);
  await invoicePaid(subscription);
  await ensurePlayer(db, member.userId);
  await db
    .update(schema.players)
    .set({
      pseudo,
      pseudoKey: pseudo?.toLowerCase() ?? null,
      pseudoChangedAt: pseudo === null ? null : new Date(),
    })
    .where(eq(schema.players.userId, member.userId));
  return { member, subscription };
}

const find = (player: Guest, wordId: string) =>
  request(player, "POST", `/me/patron/reserve/${wordId}/find`);

async function searchReserve(player: Guest, q: string) {
  const response = await request(player, "GET", `/me/patron/reserve?q=${q}`);
  expect(response.status).toBe(200);
  return reserveResponseSchema.parse(await response.json());
}

async function refusal(response: Response) {
  expect(response.status).toBe(409);
  return findRefusalSchema.parse(await response.json()).error;
}

describe("finding a word", () => {
  it("spends a right on a word of the reserve, which leaves it for everyone", async () => {
    const { member } = await yearlyPatron();
    const { prefix, ids } = await reserveOf(2);
    const [first = "", second = ""] = ids;
    expect((await readPatron(member)).finds.left).toBe(1);
    expect((await searchReserve(member, prefix)).words.map((word) => word.id)).toEqual(ids);

    const found = await find(member, first);
    expect(found.status).toBe(200);
    expect(findResponseSchema.parse(await found.json()).find).toMatchObject({
      id: first,
      state: "reserved",
    });
    const patron = await readPatron(member);
    expect(patron.finds.left).toBe(0);
    expect(patron.finds.words.map((word) => word.id)).toEqual([first]);
    expect((await searchReserve(member, prefix)).words.map((word) => word.id)).toEqual([second]);

    expect((await find(member, first)).status).toBe(200);
    expect(await refusal(await find(member, second))).toBe("no_right");
  });

  it("gives a word to one patron only when two find it at the same time", async () => {
    const [one, two] = await Promise.all([yearlyPatron(), yearlyPatron()]);
    const { ids } = await reserveOf(1);
    const wordId = ids[0] ?? "";
    const statuses = (await Promise.all([find(one.member, wordId), find(two.member, wordId)])).map(
      (response) => response.status,
    );
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it("spends one right once when a patron finds two words at the same time", async () => {
    const { member } = await yearlyPatron();
    const { ids } = await reserveOf(2);
    const statuses = (await Promise.all(ids.map((id) => find(member, id)))).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it("waits three paid months for a monthly patron", async () => {
    const { member } = await payingPatron();
    const { ids } = await reserveOf(1);
    expect((await readPatron(member)).finds.left).toBe(0);
    expect(await refusal(await find(member, ids[0] ?? ""))).toBe("no_right");
  });

  it("asks for a pseudo first, since the card is signed with it", async () => {
    const { member } = await yearlyPatron(null);
    const { ids } = await reserveOf(1);
    expect(await refusal(await find(member, ids[0] ?? ""))).toBe("no_pseudo");
  });

  it("gives the right back for a word the quality check sets aside, even after the stop", async () => {
    const { member, subscription } = await yearlyPatron();
    const { ids } = await reserveOf(2);
    const [first = "", second = ""] = ids;
    expect((await find(member, first)).status).toBe(200);
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", {
      id: subscription.id,
      customer: subscription.customerId,
    });
    expect(await rejectFind(db, first, new Date())).toBe(true);
    const patron = await readPatron(member);
    expect(patron.finds.left).toBe(1);
    expect(patron.finds.words[0]?.state).toBe("rejected");
    expect((await find(member, second)).status).toBe(200);
    expect((await readPatron(member)).finds.left).toBe(0);
  });
});

const LAUNCH_EDITIONS = PATRON_SCHEDULE[0].launchEditions;
const [EDITION = "", OTHER_EDITION = ""] = LAUNCH_EDITIONS;
const CARD = `${STARTER_COLLECTION}-rare-1`;
const OTHER_CARD = `${STARTER_COLLECTION}-rare-2`;

beforeAll(() => seedTestCatalog(db));

async function readEditions(player: Guest) {
  const response = await request(player, "GET", "/me/editions");
  expect(response.status).toBe(200);
  return editionsResponseSchema.parse(await response.json());
}

const printAlbum = (player: Guest, edition: string | null) =>
  request(player, "PUT", "/me/editions/album", { edition });
const printCard = (player: Guest, cardId: string, edition: string | null) =>
  request(player, "PUT", `/me/editions/cards/${cardId}`, { edition });

async function editionRefusal(response: Response) {
  expect(response.status).toBe(403);
  return editionRefusalSchema.parse(await response.json()).error;
}

describe("library editions", () => {
  it("come with the first payment, not with the trial", async () => {
    const { member, customerId } = await memberWithCustomer();
    await checkoutCompleted(subscribe(customerId));
    expect((await readEditions(member)).owned).toEqual([]);
    expect(await editionRefusal(await printAlbum(member, EDITION))).toBe("edition_not_owned");

    const { member: patron } = await payingPatron();
    expect((await readEditions(patron)).owned).toEqual([...LAUNCH_EDITIONS]);
  });

  it("open the cabinet of the words to a paying patron only", async () => {
    const { member, customerId } = await memberWithCustomer();
    expect((await readEditions(member)).cabinet).toBe(false);
    await checkoutCompleted(subscribe(customerId));
    expect((await readEditions(member)).cabinet).toBe(false);

    const { member: patron, customerId: patronCustomer, subscription } = await payingPatron();
    expect((await readEditions(patron)).cabinet).toBe(true);
    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", {
      id: subscription.id,
      customer: patronCustomer,
    });
    expect((await readEditions(patron)).cabinet).toBe(false);
  });

  it("print an owned card, and the whole album, which drops the cards' own choices", async () => {
    const { member } = await payingPatron();
    await setOwnedCards(db, member.userId, [
      { cardId: CARD, quantity: 1 },
      { cardId: OTHER_CARD, quantity: 1 },
    ]);
    expect(
      await editionRefusal(await printCard(member, `${STARTER_COLLECTION}-epic-3`, EDITION)),
    ).toBe("card_not_owned");
    expect((await printCard(member, CARD, EDITION)).status).toBe(204);
    expect((await printCard(member, OTHER_CARD, null)).status).toBe(204);
    expect(await readEditions(member)).toMatchObject({
      album: null,
      cards: { [CARD]: EDITION, [OTHER_CARD]: null },
    });

    expect((await printAlbum(member, OTHER_EDITION)).status).toBe(204);
    expect(await readEditions(member)).toMatchObject({ album: OTHER_EDITION, cards: {} });
  });

  it("keep the latest of two choices made at the same time", async () => {
    const { member } = await payingPatron();
    await setOwnedCards(db, member.userId, [{ cardId: CARD, quantity: 1 }]);
    const statuses = (
      await Promise.all([printCard(member, CARD, EDITION), printCard(member, CARD, OTHER_EDITION)])
    ).map((response) => response.status);
    expect(statuses).toEqual([204, 204]);
    const chosen = (await readEditions(member)).cards[CARD];
    expect([EDITION, OTHER_EDITION]).toContain(chosen);
  });

  it("show on the pinned cards of the public profile, and are kept after the subscription", async () => {
    const { member, customerId, subscription } = await payingPatron();
    const pseudo = `Edition${crypto.randomUUID().slice(0, 6)}`;
    await ensurePlayer(db, member.userId);
    await db
      .update(schema.players)
      .set({ pseudo, pseudoKey: pseudo.toLowerCase(), pseudoChangedAt: new Date() })
      .where(eq(schema.players.userId, member.userId));
    await setXp(
      db,
      member.userId,
      xpToReach(unlockRulesAt(UNLOCK_SCHEDULE, Date.now()).levels.public_profile),
    );
    await setOwnedCards(db, member.userId, [
      { cardId: CARD, quantity: 1 },
      { cardId: OTHER_CARD, quantity: 1 },
    ]);
    expect(
      (await request(member, "PUT", "/me/pinned-cards", { cardIds: [CARD, OTHER_CARD] })).status,
    ).toBe(200);
    await printAlbum(member, EDITION);
    await printCard(member, OTHER_CARD, null);

    const publicProfile = async () => {
      const response = await request(member, "GET", `/players/${pseudo}`);
      expect(response.status).toBe(200);
      return publicProfileSchema.parse(await response.json());
    };
    const during = await publicProfile();
    expect(during.visibility === "public" && during.editions).toEqual({ [CARD]: EDITION });

    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", { id: subscription.id, customer: customerId });
    expect((await readEditions(member)).album).toBe(EDITION);
  });
});

describe("pinned cards of a patron", () => {
  it("are three more while paying, not during the trial, and the extra ones hide at the end", async () => {
    const trial = await memberWithCustomer();
    await checkoutCompleted(subscribe(trial.customerId));
    const before = (await readProfile(trial.member)).pinnedSlots;

    const { member, customerId, subscription } = await payingPatron();
    const slots = (await readProfile(member)).pinnedSlots;
    expect(slots).toBe(before + PATRON_SCHEDULE[0].extraPinnedSlots);

    const cards = Array.from({ length: slots }, (_, index) => ({
      cardId: `${STARTER_COLLECTION}-${index % 2 === 0 ? "common" : "uncommon"}-${(index % 3) + 1}`,
      quantity: 1,
    }));
    const unique = [...new Map(cards.map((card) => [card.cardId, card])).values()];
    await setOwnedCards(db, member.userId, unique);
    const pins = unique.slice(0, Math.min(slots, unique.length)).map((card) => card.cardId);
    expect((await request(member, "PUT", "/me/pinned-cards", { cardIds: pins })).status).toBe(200);

    stripe.subscriptions.set(subscription.id, { ...subscription, status: "canceled" });
    await sendEvent("customer.subscription.deleted", { id: subscription.id, customer: customerId });
    const after = await readProfile(member);
    expect(after.pinnedSlots).toBe(before);
    expect(after.pinned).toEqual(pins.slice(0, before));
  });
});
