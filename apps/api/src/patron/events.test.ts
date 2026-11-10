import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { planOfLookupKey, subscriptionSnapshot } from "./billing";
import { billingEventOf, stripeEventLabel } from "./events";

const event = (type: string, object: unknown) => ({
  id: "evt_1",
  object: "event",
  type,
  data: { object },
});

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: "in_1",
  customer: "cus_1",
  amount_paid: 2999,
  status_transitions: { paid_at: 1_800_000_000 },
  parent: { subscription_details: { subscription: "sub_1" } },
  lines: { data: [{ period: { start: 1_800_000_000, end: 1_831_536_000 } }] },
  ...overrides,
});

describe("Stripe events", () => {
  it("read a paid invoice into the months it pays for", () => {
    expect(billingEventOf(event("invoice.paid", invoice()))).toEqual({
      id: "evt_1",
      type: "invoice.paid",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      paidInvoice: {
        id: "in_1",
        subscriptionId: "sub_1",
        amountPaid: 2999,
        paidAt: 1_800_000_000_000,
        startsAt: 1_800_000_000_000,
        endsAt: 1_831_536_000_000,
      },
      refundedPayment: null,
    });
  });

  it("read a charge refunded in full into its payment, and leave a part refunded", () => {
    const charge = (refunded: boolean) =>
      event("charge.refunded", { customer: "cus_1", refunded, payment_intent: "pi_1" });
    expect(billingEventOf(charge(true))).toMatchObject({
      customerId: "cus_1",
      refundedPayment: "pi_1",
    });
    expect(billingEventOf(charge(false))?.refundedPayment).toBeNull();
  });

  it("span every line of an invoice that changes plan", () => {
    const changed = invoice({
      lines: {
        data: [
          { period: { start: 1_800_500_000, end: 1_801_000_000 } },
          { period: { start: 1_800_000_000, end: 1_831_536_000 } },
        ],
      },
    });
    expect(billingEventOf(event("invoice.paid", changed))?.paidInvoice).toMatchObject({
      startsAt: 1_800_000_000_000,
      endsAt: 1_831_536_000_000,
    });
  });

  it("keep the period of an invoice a promotion code paid entirely", () => {
    const offered = billingEventOf(event("invoice.paid", invoice({ amount_paid: 0 })));
    expect(offered?.paidInvoice).toMatchObject({ amountPaid: 0 });
  });

  it("find the subscription where older API versions put it", () => {
    const old = invoice({ parent: null, subscription: "sub_old" });
    expect(billingEventOf(event("invoice.paid", old))?.subscriptionId).toBe("sub_old");
  });

  it("keep no period for a failed payment, only the subscription to read again", () => {
    const failed = billingEventOf(event("invoice.payment_failed", invoice({ amount_paid: 0 })));
    expect(failed).toMatchObject({ subscriptionId: "sub_1", paidInvoice: null });
  });

  it("ignore an invoice that is not a subscription's", () => {
    const single = invoice({ parent: null });
    expect(billingEventOf(event("invoice.paid", single))).toMatchObject({
      subscriptionId: null,
      paidInvoice: null,
    });
  });

  it("ignore a checkout that is not a subscription", () => {
    const payment = { mode: "payment", customer: "cus_1", subscription: null };
    expect(billingEventOf(event("checkout.session.completed", payment))?.subscriptionId).toBeNull();
  });

  it("refuse an event without the shape Stripe documents", () => {
    expect(billingEventOf(event("invoice.paid", { id: "in_1" }))).toBeNull();
    expect(billingEventOf({ type: "invoice.paid" })).toBeNull();
  });

  it("name a refused event by its id and type only", () => {
    const refused = event("invoice.paid", { id: "in_1", customer: "cus_1" });
    expect(stripeEventLabel(refused)).toEqual({ id: "evt_1", type: "invoice.paid" });
    expect(stripeEventLabel(null)).toEqual({ id: null, type: null });
  });
});

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      data: [{ current_period_end: 1_802_000_000, price: { lookup_key: "patron_monthly" } }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("Stripe subscriptions", () => {
  it("read the plan from the price's lookup key", () => {
    expect(subscriptionSnapshot(subscription())).toEqual({
      id: "sub_1",
      customerId: "cus_1",
      status: "active",
      plan: "monthly",
      currentPeriodEnd: 1_802_000_000_000,
      cancelAt: null,
    });
    expect(planOfLookupKey("patron_yearly")).toBe("yearly");
    expect(planOfLookupKey("something_else")).toBeNull();
  });

  it("stop at the end of the period when the player cancelled", () => {
    const cancelled = subscriptionSnapshot(subscription({ cancel_at_period_end: true }));
    expect(cancelled.cancelAt).toBe(1_802_000_000_000);
  });

  it("know no status Stripe might add later", () => {
    const unknown = subscription({ status: "frozen" as Stripe.Subscription.Status });
    expect(subscriptionSnapshot(unknown).status).toBeNull();
  });
});
