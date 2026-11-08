import { PATRON_PLANS } from "@leximon/core";
import { z } from "zod";
import { timestampSchema } from "./common";

export const patronPlanSchema = z.enum(PATRON_PLANS);

/**
 * Whether the subscription can be bought: `closed` before sales open (admins may still buy, to
 * try the real payment), `open` after, `unavailable` when payments are not configured.
 */
export const patronSalesSchema = z.enum(["closed", "open", "unavailable"]);
export type PatronSales = z.infer<typeof patronSalesSchema>;

/**
 * `GET /me/patron`, 200. `subscription` is `null` for a player who never subscribed.
 * - `standing`: `patron` (paid and subscribed), `trial` (subscribed, nothing paid yet), `none`;
 * - `cancelAt`: when a subscription cancelled by the player stops, `null` while it renews;
 * - `paymentFailing`: the latest payment failed and Stripe is retrying it.
 */
export const patronResponseSchema = z.object({
  sales: patronSalesSchema,
  canBuy: z.boolean(),
  trialAvailable: z.boolean(),
  trialDays: z.int().nonnegative(),
  founder: z.boolean(),
  subscription: z
    .object({
      standing: z.enum(["none", "trial", "patron"]),
      plan: patronPlanSchema.nullable(),
      currentPeriodEnd: timestampSchema.nullable(),
      trialEnd: timestampSchema.nullable(),
      cancelAt: timestampSchema.nullable(),
      paymentFailing: z.boolean(),
      since: timestampSchema.nullable(),
    })
    .nullable(),
});
export type PatronResponse = z.infer<typeof patronResponseSchema>;

/**
 * `POST /me/patron/checkout` request body. `waiverAccepted` is the box giving up the right of
 * withdrawal: the law asks for it before a digital service starts at once.
 */
export const patronCheckoutRequestSchema = z.object({
  plan: patronPlanSchema,
  waiverAccepted: z.literal(true),
});
export type PatronCheckoutRequest = z.infer<typeof patronCheckoutRequestSchema>;

/** `POST /me/patron/checkout` and `POST /me/patron/portal`, 200: the Stripe page to go to. */
export const patronRedirectResponseSchema = z.object({ url: z.url() });
export type PatronRedirectResponse = z.infer<typeof patronRedirectResponseSchema>;

/**
 * `POST /me/patron/checkout`, 409: sales are closed, the player is a guest, or already
 * subscribed. `POST /me/patron/portal`, 409: the player never subscribed.
 */
export const patronRefusalSchema = z.object({
  error: z.enum(["sales_closed", "guest", "already_patron", "not_subscribed"]),
});
export type PatronRefusal = z.infer<typeof patronRefusalSchema>["error"];
