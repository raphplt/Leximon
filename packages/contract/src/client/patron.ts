import {
  type AdminPatronRefundResponse,
  type AdminPatronsResponse,
  type AdminPollCreate,
  type AdminPollRefusal,
  type AdminPollsResponse,
  adminPatronRefundResponseSchema,
  adminPatronsResponseSchema,
  adminPollRefusalSchema,
  adminPollsResponseSchema,
  type EditionChoice,
  type EditionRefusal,
  type EditionsResponse,
  editionRefusalSchema,
  editionsResponseSchema,
  type FindRefusal,
  findRefusalSchema,
  findResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type PatronClaimRefusal,
  type PatronCosmeticView,
  type PatronPlan,
  type PatronRefusal,
  type PatronResponse,
  type PatronThanksResponse,
  type PatronVoteRefusal,
  patronClaimRefusalSchema,
  patronClaimResponseSchema,
  patronRedirectResponseSchema,
  patronRefusalSchema,
  patronResponseSchema,
  patronThanksResponseSchema,
  patronVoteRefusalSchema,
  type ReserveResponse,
  reserveResponseSchema,
  type WordFindView,
} from "../index";
import { ApiError, errorCode, type Http, json, parse, segment, withQuery } from "./http";

export type PatronRedirectResult =
  | { readonly kind: "redirect"; readonly url: string }
  | { readonly kind: "refused"; readonly reason: PatronRefusal };

export type FindResult =
  | { readonly kind: "found"; readonly find: WordFindView }
  | { readonly kind: "refused"; readonly reason: FindRefusal };

export type EditionResult =
  | { readonly kind: "ok" }
  | { readonly kind: "refused"; readonly reason: EditionRefusal };

export type PatronVoteResult =
  | { readonly kind: "voted" }
  | { readonly kind: "refused"; readonly reason: PatronVoteRefusal };

export type AdminPollResult =
  | { readonly kind: "opened" }
  | { readonly kind: "refused"; readonly reason: AdminPollRefusal };

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

    /** The reserve, by beginning of word or by theme, a page at a time. */
    async searchReserve(query: {
      readonly q?: string;
      readonly theme?: string;
      readonly cursor?: string;
    }): Promise<ReserveResponse> {
      const response = await send(withQuery("/me/patron/reserve", query));
      if (!response.ok) throw new ApiError("reserve_unavailable", response.status);
      return parse(response, reserveResponseSchema);
    },

    /** Finds a word of the reserve; finding the same word again answers the same. */
    async findWord(wordId: string): Promise<FindResult> {
      const response = await send(`/me/patron/reserve/${segment(wordId)}/find`, json("POST", {}));
      if (response.status === 409) {
        return { kind: "refused", reason: (await parse(response, findRefusalSchema)).error };
      }
      if (!response.ok) throw new ApiError("find_failed", response.status);
      return { kind: "found", find: (await parse(response, findResponseSchema)).find };
    },

    async fetchEditions(): Promise<EditionsResponse> {
      const response = await send("/me/editions");
      if (!response.ok) throw new ApiError("editions_unavailable", response.status);
      return parse(response, editionsResponseSchema);
    },

    /** Prints the whole album in an edition, or ordinary with `null`, cards' own choices dropped. */
    async setAlbumEdition(edition: EditionChoice["edition"]): Promise<EditionResult> {
      return editionResult(await send("/me/editions/album", json("PUT", { edition })));
    },

    /** A patron's voice in the vote open; a new one replaces the last until it closes. */
    async votePatronPoll(pollId: string, theme: number): Promise<PatronVoteResult> {
      const response = await send(
        `/me/patron/polls/${segment(pollId)}/vote`,
        json("PUT", { theme }),
      );
      if (response.status === 409) {
        return { kind: "refused", reason: (await parse(response, patronVoteRefusalSchema)).error };
      }
      if (!response.ok) throw new ApiError("patron_vote_failed", response.status);
      return { kind: "voted" };
    },

    /** Whether the patron's pseudo shows on the page of thanks. */
    async setPatronThanks(listed: boolean): Promise<void> {
      const response = await send("/me/patron/thanks", json("PUT", { listed }));
      if (!response.ok) throw new ApiError("patron_thanks_failed", response.status);
    },

    /** The page of thanks, readable without an account. */
    async fetchPatronThanks(): Promise<PatronThanksResponse> {
      const response = await send("/patrons");
      if (!response.ok) throw new ApiError("patron_thanks_unavailable", response.status);
      return parse(response, patronThanksResponseSchema);
    },

    /** Prints one card in an edition, or ordinary with `null`, whatever the album's. */
    async setCardEdition(
      cardId: string,
      edition: EditionChoice["edition"],
    ): Promise<EditionResult> {
      return editionResult(
        await send(`/me/editions/cards/${segment(cardId)}`, json("PUT", { edition })),
      );
    },
  };
}

async function editionResult(response: Response): Promise<EditionResult> {
  if (response.status === 403) {
    return { kind: "refused", reason: (await parse(response, editionRefusalSchema)).error };
  }
  if (!response.ok) throw new ApiError("edition_failed", response.status);
  return { kind: "ok" };
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

    async fetchPolls(): Promise<AdminPollsResponse> {
      const response = await send("/admin/patrons/polls");
      if (!response.ok) throw await failure(response);
      return parse(response, adminPollsResponseSchema);
    },

    /** Opens a vote at once; refused while another is open. */
    async openPoll(themes: AdminPollCreate["themes"]): Promise<AdminPollResult> {
      const response = await send("/admin/patrons/polls", json("POST", { themes }));
      if (response.status === 409) {
        return { kind: "refused", reason: (await parse(response, adminPollRefusalSchema)).error };
      }
      if (!response.ok) throw await failure(response);
      return { kind: "opened" };
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
