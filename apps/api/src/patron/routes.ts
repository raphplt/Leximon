import {
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type PatronRedirectResponse,
  type PatronRefusal,
  type PatronResponse,
  patronCheckoutRequestSchema,
} from "@leximon/contract";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { refuseLockedWrites } from "../moderation/restrictions";
import type { BillingFactory } from "./billing";
import { billingEventOf, verifiedStripeEvent } from "./events";
import { applyBillingEvent, openCheckout, openPortal, patronSales, readPatron } from "./patron";

/** Invoices list their lines: larger than other webhooks, still far below this. */
const MAX_WEBHOOK_BYTES = 256 * 1024;

const webUrlOf = (env: Env) => env.PUBLIC_WEB_URL.replace(/\/+$/, "");

/** The patron subscription, under `/me/patron` (signed-in player, rate limited). */
export function patronRoutes(createBilling: BillingFactory) {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (c) =>
    c.json<PatronResponse>(
      await readPatron(c.var.db, {
        userId: c.var.userId,
        sales: patronSales(c.env),
        now: Date.now(),
      }),
    ),
  );

  routes.post("/checkout", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = patronCheckoutRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const sales = patronSales(c.env);
    if (sales === "unavailable") {
      return c.json<{ error: PatronRefusal }>({ error: "sales_closed" }, 409);
    }
    const result = await openCheckout(c.var.db, createBilling(c.env), {
      userId: c.var.userId,
      plan: body.data.plan,
      sales,
      idempotencyKey: key.data,
      webUrl: webUrlOf(c.env),
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: PatronRefusal }>({ error: result.reason }, 409);
    }
    return c.json<PatronRedirectResponse>({ url: result.url });
  });

  routes.post("/portal", async (c) => {
    if (patronSales(c.env) === "unavailable") {
      return c.json<{ error: PatronRefusal }>({ error: "not_subscribed" }, 409);
    }
    const result = await openPortal(c.var.db, createBilling(c.env), {
      userId: c.var.userId,
      webUrl: webUrlOf(c.env),
    });
    if (result.kind === "refused") {
      return c.json<{ error: PatronRefusal }>({ error: result.reason }, 409);
    }
    return c.json<PatronRedirectResponse>({ url: result.url });
  });

  return routes;
}

/**
 * `POST /stripe/webhook`: what Stripe tells of subscriptions and invoices. Answers 2xx once the
 * event is applied or known; any other answer makes Stripe send it again, for three days.
 */
export function stripeWebhookRoutes(createBilling: BillingFactory) {
  const routes = new Hono<AppEnv>();

  routes.post("/webhook", async (c) => {
    const secret = c.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
    if (secret === "" || patronSales(c.env) === "unavailable") {
      return c.json({ error: "billing_not_configured" }, 503);
    }
    const length = Number(c.req.header("content-length") ?? "0");
    if (length > MAX_WEBHOOK_BYTES) return c.json({ error: "payload_too_large" }, 413);
    const rawBody = await c.req.text();
    if (rawBody.length > MAX_WEBHOOK_BYTES) return c.json({ error: "payload_too_large" }, 413);
    const verified = await verifiedStripeEvent(
      rawBody,
      c.req.header("stripe-signature") ?? "",
      secret,
    );
    if (verified === null) return c.json({ error: "invalid_signature" }, 400);
    const event = billingEventOf(verified);
    if (event === null) return c.json({ error: "invalid_request" }, 400);
    const result = await applyBillingEvent(c.var.db, createBilling(c.env), event, Date.now());
    if (result === "unknown_customer") {
      console.warn("Stripe event for a customer the game did not make", { type: event.type });
    }
    return c.json({ result });
  });

  return routes;
}
