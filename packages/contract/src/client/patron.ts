import {
  type AdminPatronRefundResponse,
  type AdminPatronsResponse,
  adminPatronRefundResponseSchema,
  adminPatronsResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type PatronClaimRefusal,
  type PatronCosmeticView,
  type PatronPlan,
  type PatronRefusal,
  type PatronResponse,
  patronClaimRefusalSchema,
  patronClaimResponseSchema,
  patronRedirectResponseSchema,
  patronRefusalSchema,
  patronResponseSchema,
} from "../index";
import { ApiError, errorCode, type Http, json, parse, segment, withQuery } from "./http";

export type PatronRedirectResult =
  | { readonly kind: "redirect"; readonly url: string }
  | { readonly kind: "refused"; readonly reason: PatronRefusal };

export type PatronClaimResult =
  | { readonly kind: "claimed"; readonly cosmetic: PatronCosmeticView }
  | { readonly kind: "refused"; readonly reason: PatronClaimRefusal };

/** The patron subscription (`/me/patron`). Never signs in as a guest: a guest cannot subscribe. */
export function patronRoutes(http: Http) {
  const { send } = http;

  async function redirect(response: Response, failure: string): Promise<PatronRedirectResult> {
    if (response.status === 409) {
      return { kind: "refused", reason: (await parse(response, patronRefusalSchema)).error };
    }
    if (!response.ok) throw new ApiError(failure, response.status);
    return { kind: "redirect", url: (await parse(response, patronRedirectResponseSchema)).url };
  }

  return {
    async fetchPatron(): Promise<PatronResponse> {
      const response = await send("/me/patron");
      if (!response.ok) throw new ApiError("patron_unavailable", response.status);
      return parse(response, patronResponseSchema);
    },

    /**
     * Opens Stripe's payment page. `waiverAccepted` is the box giving up the right of withdrawal,
     * which the player must tick. The caller keeps `idempotencyKey` until it gets an answer.
     */
    async openPatronCheckout(plan: PatronPlan, idempotencyKey: string) {
      const response = await send(
        "/me/patron/checkout",
        json("POST", { plan, waiverAccepted: true }, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      return redirect(response, "checkout_failed");
    },

    /** Stripe's page to change plan, card, see invoices or cancel. */
    async openPatronPortal(): Promise<PatronRedirectResult> {
      return redirect(await send("/me/patron/portal", json("POST", {})), "portal_failed");
    },

    async claimPatronCosmetic(month: string): Promise<PatronClaimResult> {
      const response = await send(`/me/patron/cosmetics/${segment(month)}/claim`, json("POST", {}));
      if (response.status === 409) {
        return { kind: "refused", reason: (await parse(response, patronClaimRefusalSchema)).error };
      }
      if (!response.ok) throw new ApiError("claim_failed", response.status);
      return { kind: "claimed", ...(await parse(response, patronClaimResponseSchema)) };
    },
  };
}

/** The subscribers in the back office (`/admin/patrons`). */
export function adminPatronRoutes(http: Http) {
  const { send } = http;

  async function failure(response: Response): Promise<ApiError> {
    return new ApiError((await errorCode(response)) ?? `http_${response.status}`, response.status);
  }

  return {
    async fetchPatrons(cursor?: string): Promise<AdminPatronsResponse> {
      const response = await send(withQuery("/admin/patrons", { cursor }));
      if (!response.ok) throw await failure(response);
      return parse(response, adminPatronsResponseSchema);
    },

    /** The caller keeps `idempotencyKey` until it gets an answer: a retry never refunds twice. */
    async refundPatron(userId: string, idempotencyKey: string): Promise<AdminPatronRefundResponse> {
      const response = await send(
        `/admin/patrons/${segment(userId)}/refund`,
        json("POST", {}, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      if (!response.ok) throw await failure(response);
      return parse(response, adminPatronRefundResponseSchema);
    },
  };
}
