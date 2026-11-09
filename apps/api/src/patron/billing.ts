import {
  type EpochMs,
  type PatronPlan,
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "@leximon/core";
import Stripe from "stripe";
import { z } from "zod";

/**
 * What the game asks of Stripe, and nothing more. Behind an interface so that tests run without
 * the network; the webhook signature is checked by the real library in tests too.
 */
export interface Billing {
  /** A customer for one account, made once: the same request made again returns the same one. */
  createCustomer(userId: string): Promise<string>;
  createCheckout(input: CheckoutInput): Promise<{ readonly id: string; readonly url: string }>;
  /** Expires a checkout not paid yet; one already paid or expired is left as it is. */
  expireCheckout(sessionId: string): Promise<void>;
  createPortal(customerId: string, returnUrl: string): Promise<string>;
  retrieveSubscription(subscriptionId: string): Promise<SubscriptionSnapshot>;
  /** Stops a subscription at once; one already stopped is left as it is. */
  cancelSubscription(subscriptionId: string): Promise<void>;
  /** Removes the account's id from its customer, whose invoices Stripe keeps. */
  forgetCustomer(customerId: string): Promise<void>;
  /** Refunds what an invoice was paid; refunded twice, Stripe makes it once. */
  refundInvoice(invoiceId: string): Promise<void>;
  /** The invoice a payment paid; `null` for a payment that paid none. */
  invoiceOfPayment(paymentIntentId: string): Promise<string | null>;
}

export type BillingFactory = (env: Env) => Billing;

export interface CheckoutInput {
  readonly customerId: string;
  readonly userId: string;
  readonly plan: PatronPlan;
  readonly successUrl: string;
  readonly cancelUrl: string;
  /** The client's key: a checkout asked twice is opened once. */
  readonly idempotencyKey: string;
}

/** A subscription as Stripe returns it, read into what the game keeps. */
export interface SubscriptionSnapshot {
  readonly id: string;
  readonly customerId: string;
  /** `null` for a status this code does not know: treated as not subscribed. */
  readonly status: SubscriptionStatus | null;
  readonly plan: PatronPlan | null;
  readonly currentPeriodEnd: EpochMs | null;
  readonly cancelAt: EpochMs | null;
}

/** The two prices, found by their lookup key so that a new price takes the same name. */
export const PLAN_LOOKUP_KEYS: Readonly<Record<PatronPlan, string>> = {
  monthly: "patron_monthly",
  yearly: "patron_yearly",
};

export function planOfLookupKey(key: string | null | undefined): PatronPlan | null {
  if (key === PLAN_LOOKUP_KEYS.monthly) return "monthly";
  if (key === PLAN_LOOKUP_KEYS.yearly) return "yearly";
  return null;
}

/** Payments work only with both secrets: without them, nothing is sold. */
export function billingConfigured(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_WEBHOOK_SECRET?.trim());
}

const statusSchema = z.enum(SUBSCRIPTION_STATUSES);

export function subscriptionSnapshot(subscription: Stripe.Subscription): SubscriptionSnapshot {
  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end ?? null;
  const status = statusSchema.safeParse(subscription.status);
  const cancelAt = subscription.cancel_at ?? (subscription.cancel_at_period_end ? periodEnd : null);
  return {
    id: subscription.id,
    customerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    status: status.success ? status.data : null,
    plan: planOfLookupKey(item?.price.lookup_key),
    currentPeriodEnd: secondsToMs(periodEnd),
    cancelAt: secondsToMs(cancelAt),
  };
}

function secondsToMs(seconds: number | null): EpochMs | null {
  return seconds === null ? null : seconds * 1000;
}

/** The real thing. The Workers build of the library talks to Stripe with `fetch`. */
export const createStripeBilling: BillingFactory = (env) => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
  return {
    async createCustomer(userId) {
      const customer = await stripe.customers.create(
        { metadata: { userId } },
        { idempotencyKey: `customer-${userId}` },
      );
      return customer.id;
    },

    async createCheckout(input) {
      const prices = await stripe.prices.list({
        lookup_keys: [PLAN_LOOKUP_KEYS[input.plan]],
        active: true,
        limit: 1,
      });
      const price = prices.data[0];
      if (price === undefined) throw new Error(`No active price for ${input.plan}`);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: input.customerId,
          client_reference_id: input.userId,
          line_items: [{ price: price.id, quantity: 1 }],
          payment_method_collection: "always",
          locale: "fr",
          subscription_data: { metadata: { userId: input.userId } },
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
        { idempotencyKey: `checkout-${input.userId}-${input.idempotencyKey}` },
      );
      if (session.url === null) throw new Error("Checkout session without a URL");
      return { id: session.id, url: session.url };
    },

    async expireCheckout(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
    },

    async createPortal(customerId, returnUrl) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        locale: "fr",
      });
      return session.url;
    },

    async retrieveSubscription(subscriptionId) {
      return subscriptionSnapshot(await stripe.subscriptions.retrieve(subscriptionId));
    },

    async cancelSubscription(subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
        return;
      }
      await stripe.subscriptions.cancel(subscriptionId);
    },

    async forgetCustomer(customerId) {
      await stripe.customers.update(customerId, { metadata: { userId: "" } });
    },

    async refundInvoice(invoiceId) {
      const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid" });
      for (const { payment } of payments.data) {
        const intent = payment.payment_intent;
        const intentId = typeof intent === "string" ? intent : intent?.id;
        if (intentId === undefined) continue;
        await stripe.refunds.create(
          { payment_intent: intentId },
          { idempotencyKey: `refund-${invoiceId}-${intentId}` },
        );
      }
    },

    async invoiceOfPayment(paymentIntentId) {
      const payments = await stripe.invoicePayments.list({
        payment: { type: "payment_intent", payment_intent: paymentIntentId },
        limit: 1,
      });
      const invoice = payments.data[0]?.invoice;
      if (invoice === undefined) return null;
      return typeof invoice === "string" ? invoice : (invoice.id ?? null);
    },
  };
};
