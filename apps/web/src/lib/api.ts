import {
  type AccountResponse,
  accountResponseSchema,
  authErrorResponseSchema,
  type BoosterSource,
  type BoosterWalletResponse,
  boosterStockEmptySchema,
  boosterWalletSchema,
  type ChallengeAnswerRequest,
  type ChallengeAnswerResponse,
  type ChallengesResponse,
  type CreateTradeRequest,
  challengeAnswerResponseSchema,
  challengesResponseSchema,
  type EmailSignInRequest,
  errorResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type JoinWaitlistRequest,
  type LinkPreviewError,
  type LinkPreviewResponse,
  linkPreviewErrorSchema,
  linkPreviewResponseSchema,
  type MasteryResponse,
  masteryResponseSchema,
  type OpenBoosterResponse,
  type OwnedCardsResponse,
  openBoosterResponseSchema,
  ownedCardsResponseSchema,
  type ProfileResponse,
  type ProgressResponse,
  profileResponseSchema,
  progressResponseSchema,
  signupRequiredSchema,
  type Trade,
  type TradeableCardsResponse,
  type TradeRefusalCode,
  type TradesResponse,
  tradeableCardsResponseSchema,
  tradeRefusalSchema,
  tradeSchema,
  tradesResponseSchema,
} from "@leximon/contract";
import type { z } from "zod";

/**
 * Browser client of the game API. The session lives in Better Auth's cookie, sent with
 * `credentials: "include"`; every response is validated against the shared contract.
 */

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Something went wrong that the player can only retry. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A request with the session cookie, never signing in: the back office uses it as is. */
export async function send(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiError("network_error", null);
  }
}

export async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError("unexpected_response", response.status);
  return result.data;
}

/**
 * One guest sign-in at a time: screens load several resources in parallel, and each would
 * otherwise create its own guest account on a first visit.
 */
let guestSignIn: Promise<void> | null = null;

function signInAsGuest(): Promise<void> {
  guestSignIn ??= send("/api/auth/sign-in/anonymous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
    .then((response) => {
      if (!response.ok) throw new ApiError("guest_sign_in_failed", response.status);
    })
    .catch((error: unknown) => {
      // Kept after a success, so that a request answered late reuses the new session.
      guestSignIn = null;
      throw error;
    });
  return guestSignIn;
}

/** Sends a request, signing in as a guest first if there is no session yet (D-006). */
async function sendAsPlayer(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await send(path, init);
  if (response.status !== 401) return response;
  await signInAsGuest();
  return send(path, init);
}

export async function fetchWallet(): Promise<BoosterWalletResponse> {
  const response = await sendAsPlayer("/me/wallet");
  if (!response.ok) throw new ApiError("wallet_unavailable", response.status);
  return parse(response, boosterWalletSchema);
}

/** Every card the player owns, all pages included. */
export async function fetchOwnedCards(): Promise<OwnedCardsResponse["cards"]> {
  const owned: OwnedCardsResponse["cards"] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "500" });
    if (cursor !== null) query.set("cursor", cursor);
    const response = await sendAsPlayer(`/me/cards?${query}`);
    if (!response.ok) throw new ApiError("cards_unavailable", response.status);
    const page = await parse(response, ownedCardsResponseSchema);
    owned.push(...page.cards);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return owned;
}

export type OpenBoosterResult =
  | ({ readonly kind: "opened" } & OpenBoosterResponse)
  | { readonly kind: "stock_empty"; readonly nextRefillAt: string }
  /** The guest opened all its boosters: an account is required to go on (P37). */
  | { readonly kind: "signup_required" };

/**
 * Opens a booster. The caller keeps `idempotencyKey` until it gets a result, so that a retry
 * after a network error never opens a second booster.
 */
export async function openBooster(
  source: BoosterSource,
  idempotencyKey: string,
): Promise<OpenBoosterResult> {
  const response = await sendAsPlayer("/boosters/open", {
    method: "POST",
    headers: { "Content-Type": "application/json", [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    body: JSON.stringify(source),
  });
  if (response.status === 409) {
    // The guest's game just went to an account (sign-in in another tab): retrying uses it.
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (errorResponseSchema.safeParse(body).data?.error === "guest_archived") {
      throw new ApiError("session_changed", 409);
    }
    const empty = await parse(response, boosterStockEmptySchema);
    return { kind: "stock_empty", nextRefillAt: empty.nextRefillAt };
  }
  if (response.status === 403) {
    await parse(response, signupRequiredSchema);
    return { kind: "signup_required" };
  }
  if (!response.ok) throw new ApiError("open_failed", response.status);
  return { kind: "opened", ...(await parse(response, openBoosterResponseSchema)) };
}

export async function fetchChallenges(limit = 5): Promise<ChallengesResponse> {
  const response = await sendAsPlayer(`/challenges?limit=${limit}`);
  if (!response.ok) throw new ApiError("challenges_unavailable", response.status);
  return parse(response, challengesResponseSchema);
}

export type AnswerResult =
  | ({ readonly kind: "answered" } & ChallengeAnswerResponse)
  /** Already answered elsewhere (another tab): the question is simply skipped. */
  | { readonly kind: "not_due" };

/** Sends an answer. Like boosters, the caller keeps `idempotencyKey` until it gets a result. */
export async function answerChallenge(
  answer: ChallengeAnswerRequest,
  idempotencyKey: string,
): Promise<AnswerResult> {
  const response = await sendAsPlayer("/challenges/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json", [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    body: JSON.stringify(answer),
  });
  if (response.status === 409 || response.status === 404) return { kind: "not_due" };
  if (!response.ok) throw new ApiError("answer_failed", response.status);
  return { kind: "answered", ...(await parse(response, challengeAnswerResponseSchema)) };
}

export async function fetchMastery(): Promise<MasteryResponse["words"]> {
  const response = await sendAsPlayer("/me/mastery");
  if (!response.ok) throw new ApiError("mastery_unavailable", response.status);
  return (await parse(response, masteryResponseSchema)).words;
}

/** The player's account level (P48). */
export async function fetchProgress(): Promise<ProgressResponse> {
  const response = await sendAsPlayer("/me/progress");
  if (!response.ok) throw new ApiError("progress_unavailable", response.status);
  return parse(response, progressResponseSchema);
}

export async function fetchProfile(): Promise<ProfileResponse> {
  const response = await sendAsPlayer("/me/profile");
  if (!response.ok) throw new ApiError("profile_unavailable", response.status);
  return parse(response, profileResponseSchema);
}

/** Cards a player can give now: mine without `playerCode`. `null` when the code is unknown. */
export async function fetchTradeable(playerCode?: string): Promise<TradeableCardsResponse | null> {
  const path =
    playerCode === undefined
      ? "/me/tradeable"
      : `/players/${encodeURIComponent(playerCode)}/tradeable`;
  const response = await sendAsPlayer(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError("tradeable_unavailable", response.status);
  return parse(response, tradeableCardsResponseSchema);
}

export async function fetchTrades(
  box: "incoming" | "outgoing",
  cursor: string | null = null,
): Promise<TradesResponse> {
  const query = new URLSearchParams({ box });
  if (cursor !== null) query.set("cursor", cursor);
  const response = await sendAsPlayer(`/trades?${query}`);
  if (!response.ok) throw new ApiError("trades_unavailable", response.status);
  return parse(response, tradesResponseSchema);
}

export type TradeResult =
  | { readonly kind: "ok"; readonly trade: Trade }
  | { readonly kind: "refused"; readonly reason: TradeRefusalCode };

/** Reads a refusal (`{ error }` with a known code) or the trade itself. */
async function tradeResult(response: Response, failure: string): Promise<TradeResult> {
  if (response.ok) return { kind: "ok", trade: await parse(response, tradeSchema) };
  if ([404, 409, 422].includes(response.status)) {
    const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
    const reason = tradeRefusalSchema.safeParse(body.success ? body.data.error : null);
    if (reason.success) return { kind: "refused", reason: reason.data };
  }
  throw new ApiError(failure, response.status);
}

/** Sends an offer. The caller keeps `idempotencyKey` until it gets a result. */
export async function createTrade(
  offer: CreateTradeRequest,
  idempotencyKey: string,
): Promise<TradeResult> {
  const response = await sendAsPlayer("/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json", [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    body: JSON.stringify(offer),
  });
  return tradeResult(response, "trade_failed");
}

/** Accepts, declines or cancels an offer; each is idempotent on the server. */
export async function resolveTrade(
  tradeId: string,
  action: "accept" | "decline" | "cancel",
): Promise<TradeResult> {
  const response = await sendAsPlayer(`/trades/${encodeURIComponent(tradeId)}/${action}`, {
    method: "POST",
    headers: { [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID() },
  });
  return tradeResult(response, "trade_failed");
}

// --- Account (D-030) ----------------------------------------------------------------------------

/** Who is playing: a guest (created on the first visit) or a member. */
export async function fetchAccount(): Promise<AccountResponse> {
  const response = await sendAsPlayer("/me/account");
  if (!response.ok) throw new ApiError("account_unavailable", response.status);
  return parse(response, accountResponseSchema);
}

function postJson(path: string, body: unknown): Promise<Response> {
  return send(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Error code of a Better Auth route (ours included), `null` when there is none. */
async function authErrorCode(response: Response): Promise<string | null> {
  const body = authErrorResponseSchema.safeParse(await response.json().catch(() => null));
  return body.success ? body.data.code : null;
}

export type SendCodeResult =
  | { readonly kind: "sent" }
  | { readonly kind: "refused"; readonly reason: "invalid_email" | "rate_limited" | "unavailable" };

/** Sends a 6-digit sign-in code to the address. */
export async function sendSignInCode(email: string): Promise<SendCodeResult> {
  const response = await postJson("/api/auth/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
  if (response.ok) return { kind: "sent" };
  if (response.status === 400) return { kind: "refused", reason: "invalid_email" };
  if (response.status === 429) return { kind: "refused", reason: "rate_limited" };
  if (response.status === 503) return { kind: "refused", reason: "unavailable" };
  throw new ApiError("code_not_sent", response.status);
}

export type PreviewResult =
  | ({ readonly kind: "ok" } & LinkPreviewResponse)
  | { readonly kind: "refused"; readonly reason: LinkPreviewError };

/** Checks the code, without using it up, and tells what signing in does to the guest's game. */
export async function previewSignIn(email: string, code: string): Promise<PreviewResult> {
  const response = await postJson("/account/link-preview", { email, code });
  if (response.ok) return { kind: "ok", ...(await parse(response, linkPreviewResponseSchema)) };
  if (response.status === 429) return { kind: "refused", reason: "rate_limited" };
  const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
  const reason = linkPreviewErrorSchema.safeParse(body.success ? body.data.error : null);
  if (reason.success) return { kind: "refused", reason: reason.data };
  throw new ApiError("preview_failed", response.status);
}

export type SignInResult =
  | { readonly kind: "signed_in" }
  /** Better Auth's code (`INVALID_OTP`…) or ours (`ACCOUNT_ERROR_CODES`); "rate_limited" on 429. */
  | { readonly kind: "refused"; readonly code: string };

/** Signs in with the code. The server moves or leaves the guest's game in the same request. */
export async function signInWithCode(request: EmailSignInRequest): Promise<SignInResult> {
  const response = await postJson("/api/auth/sign-in/email-otp", request);
  if (response.ok) return { kind: "signed_in" };
  if (response.status === 429) return { kind: "refused", code: "rate_limited" };
  const code = await authErrorCode(response);
  if (code !== null) return { kind: "refused", code };
  throw new ApiError("sign_in_failed", response.status);
}

export async function signOut(): Promise<void> {
  const response = await postJson("/api/auth/sign-out", {});
  if (!response.ok) throw new ApiError("sign_out_failed", response.status);
}

// --- Waiting list -------------------------------------------------------------------------------

export type JoinWaitlistResult =
  | { readonly kind: "joined" }
  | { readonly kind: "refused"; readonly reason: "invalid_email" | "rate_limited" };

/** Puts the address on the list warned when the game opens. No session: it creates no player. */
export async function joinWaitlist(email: string): Promise<JoinWaitlistResult> {
  const response = await postJson("/waitlist", { email } satisfies JoinWaitlistRequest);
  if (response.ok) return { kind: "joined" };
  if (response.status === 400) return { kind: "refused", reason: "invalid_email" };
  if (response.status === 429) return { kind: "refused", reason: "rate_limited" };
  throw new ApiError("waitlist_unavailable", response.status);
}
