import {
  type AnalyticsBatch,
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
  type ExperimentsResponse,
  errorResponseSchema,
  experimentsResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type MasteryResponse,
  masteryResponseSchema,
  type OpenBoosterResponse,
  type OwnedCardsResponse,
  openBoosterResponseSchema,
  ownedCardsResponseSchema,
  type ProfileResponse,
  profileResponseSchema,
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

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiError("network_error", null);
  }
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
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

/** The player's variant in each running A/B test (D-030). */
export async function fetchExperiments(): Promise<ExperimentsResponse["variants"]> {
  const response = await sendAsPlayer("/me/experiments");
  if (!response.ok) throw new ApiError("experiments_unavailable", response.status);
  return (await parse(response, experimentsResponseSchema)).variants;
}

/**
 * Sends a batch of events to the A/B log. `keepalive` lets the request finish while the page
 * closes. Never signs in a guest: a visitor without a session has nothing to measure yet.
 */
export async function sendEvents(batch: AnalyticsBatch, keepalive = false): Promise<void> {
  const response = await send("/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
    keepalive,
  });
  if (!response.ok) throw new ApiError("events_refused", response.status);
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
  | { readonly kind: "stock_empty"; readonly nextRefillAt: string };

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
    const empty = await parse(response, boosterStockEmptySchema);
    return { kind: "stock_empty", nextRefillAt: empty.nextRefillAt };
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
