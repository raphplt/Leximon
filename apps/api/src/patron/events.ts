import type { EpochMs } from "@leximon/core";
import Stripe from "stripe";
import { z } from "zod";

/** A Stripe event, read into what the game acts on. */
export interface BillingEvent {
  readonly id: string;
  readonly type: string;
  readonly customerId: string | null;
  /** The subscription to read again from Stripe: its latest state, whatever order events came in. */
  readonly subscriptionId: string | null;
  readonly paidInvoice: PaidInvoice | null;
  /** The payment of a charge refunded in full, wherever the refund was made. */
  readonly refundedPayment: string | null;
}

/** An invoice paid with money, and the months it pays for. */
export interface PaidInvoice {
  readonly id: string;
  readonly subscriptionId: string;
  /** In cents of euro. */
  readonly amountPaid: number;
  readonly paidAt: EpochMs;
  readonly startsAt: EpochMs;
  readonly endsAt: EpochMs;
}

/**
 * Checks the signature with the library's own code, then reads the event. `null` for a forged or
 * stale request: Stripe's tolerance is five minutes.
 */
export async function verifiedStripeEvent(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<unknown> {
  try {
    return await Stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    return null;
  }
}

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.unknown() }),
});

const checkoutSessionSchema = z.object({
  mode: z.string(),
  customer: z.string().nullable(),
  subscription: z.string().nullable(),
});

const subscriptionSchema = z.object({ id: z.string().min(1), customer: z.string().min(1) });

const invoiceSchema = z.object({
  id: z.string().min(1),
  customer: z.string().min(1),
  amount_paid: z.int().nonnegative(),
  status_transitions: z.object({ paid_at: z.int().nullable() }),
  parent: z
    .object({
      subscription_details: z.object({ subscription: z.string().min(1) }).nullish(),
    })
    .nullish(),
  /** Where API versions before 2025 put it, for an endpoint left on an old version. */
  subscription: z.string().nullish(),
  lines: z.object({
    data: z.array(z.object({ period: z.object({ start: z.int(), end: z.int() }) })),
  }),
});

const chargeSchema = z.object({
  customer: z.string().nullable(),
  refunded: z.boolean(),
  payment_intent: z.string().nullable(),
});

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/** `null` when the event does not have the shape Stripe documents for its type. */
export function billingEventOf(raw: unknown): BillingEvent | null {
  const event = eventSchema.safeParse(raw);
  if (!event.success) return null;
  const { id, type } = event.data;
  const object = event.data.data.object;
  const ignored: BillingEvent = {
    id,
    type,
    customerId: null,
    subscriptionId: null,
    paidInvoice: null,
    refundedPayment: null,
  };

  if (type === "checkout.session.completed") {
    const session = checkoutSessionSchema.safeParse(object);
    if (!session.success) return null;
    if (session.data.mode !== "subscription") return ignored;
    return {
      ...ignored,
      customerId: session.data.customer,
      subscriptionId: session.data.subscription,
    };
  }

  if (SUBSCRIPTION_EVENTS.has(type)) {
    const subscription = subscriptionSchema.safeParse(object);
    if (!subscription.success) return null;
    return {
      ...ignored,
      customerId: subscription.data.customer,
      subscriptionId: subscription.data.id,
    };
  }

  if (type === "invoice.paid" || type === "invoice.payment_failed") {
    const invoice = invoiceSchema.safeParse(object);
    if (!invoice.success) return null;
    const subscriptionId =
      invoice.data.parent?.subscription_details?.subscription ?? invoice.data.subscription ?? null;
    if (subscriptionId === null) return ignored;
    return {
      ...ignored,
      customerId: invoice.data.customer,
      subscriptionId,
      paidInvoice: type === "invoice.paid" ? paidInvoiceOf(invoice.data, subscriptionId) : null,
    };
  }

  if (type === "charge.refunded") {
    const charge = chargeSchema.safeParse(object);
    if (!charge.success) return null;
    // A part refunded leaves the period paid: only a whole refund takes it back.
    if (!charge.data.refunded || charge.data.payment_intent === null) return ignored;
    return {
      ...ignored,
      customerId: charge.data.customer,
      refundedPayment: charge.data.payment_intent,
    };
  }

  return ignored;
}

/** `null` for an invoice of zero or without a line. */
function paidInvoiceOf(
  invoice: z.infer<typeof invoiceSchema>,
  subscriptionId: string,
): PaidInvoice | null {
  const paidAt = invoice.status_transitions.paid_at;
  if (invoice.amount_paid === 0 || paidAt === null || invoice.lines.data.length === 0) return null;
  // A change of plan bills what is left of the old period and the new one: the whole span.
  const starts = invoice.lines.data.map((line) => line.period.start);
  const ends = invoice.lines.data.map((line) => line.period.end);
  return {
    id: invoice.id,
    subscriptionId,
    amountPaid: invoice.amount_paid,
    paidAt: paidAt * 1000,
    startsAt: Math.min(...starts) * 1000,
    endsAt: Math.max(...ends) * 1000,
  };
}
