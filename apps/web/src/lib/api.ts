import {
  type AccountResponse,
  accountResponseSchema,
  authErrorResponseSchema,
  type BlockRefusal,
  type BlocksResponse,
  type BoosterSource,
  type BoosterWalletResponse,
  blockRefusalSchema,
  blocksResponseSchema,
  boosterStockEmptySchema,
  boosterWalletSchema,
  type CardChoiceRefusal,
  type CardChoiceResponse,
  type ChallengeAnswerRequest,
  type ChallengeAnswerResponse,
  type ChallengesResponse,
  type ClaimLevelRewardResponse,
  type ClaimRefusal,
  type CreateTradeRequest,
  cardChoiceRefusalSchema,
  cardChoiceResponseSchema,
  challengeAnswerResponseSchema,
  challengesResponseSchema,
  claimLevelRewardResponseSchema,
  claimRefusalSchema,
  type DailyChallengeResponse,
  type DeleteAccountRefusal,
  dailyChallengeResponseSchema,
  deleteAccountRefusalSchema,
  type EmailPreferences,
  type EmailSignInRequest,
  emailPreferencesSchema,
  errorResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type JoinWaitlistRequest,
  type LevelRewardsResponse,
  type LinkPreviewError,
  type LinkPreviewResponse,
  levelRequiredSchema,
  levelRewardsResponseSchema,
  linkPreviewErrorSchema,
  linkPreviewResponseSchema,
  type MasteryResponse,
  masteryResponseSchema,
  type OpenBoosterResponse,
  type OwnedCardsResponse,
  openBoosterResponseSchema,
  ownedCardsResponseSchema,
  type Preferences,
  type ProfileRefusal,
  type ProfileResponse,
  type ProgressResponse,
  type PublicProfile,
  preferencesSchema,
  profileRefusalSchema,
  profileResponseSchema,
  progressResponseSchema,
  publicProfileSchema,
  signupRequiredSchema,
  type Trade,
  type TradeableCardsResponse,
  type TradeRefusalCode,
  type TradesResponse,
  tradeableCardsResponseSchema,
  tradeRefusalSchema,
  tradeSchema,
  tradesResponseSchema,
  type UpdateEmailPreferencesRequest,
  type UpdateProfileRequest,
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
export async function sendAsPlayer(path: string, init: RequestInit = {}): Promise<Response> {
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
  | { readonly kind: "signup_required" }
  /** Choosing the collection opens at a level (P59): the screen was out of date. */
  | { readonly kind: "level_required"; readonly level: number };

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
    const body: unknown = await response.json().catch(() => null);
    const level = levelRequiredSchema.safeParse(body);
    if (level.success) return { kind: "level_required", level: level.data.level };
    if (signupRequiredSchema.safeParse(body).success) return { kind: "signup_required" };
    throw new ApiError("unexpected_response", 403);
  }
  if (!response.ok) throw new ApiError("open_failed", response.status);
  return { kind: "opened", ...(await parse(response, openBoosterResponseSchema)) };
}

// --- Level rewards (P58) -------------------------------------------------------------------------

export async function fetchLevelRewards(): Promise<LevelRewardsResponse> {
  const response = await sendAsPlayer("/me/level-rewards");
  if (!response.ok) throw new ApiError("level_rewards_unavailable", response.status);
  return parse(response, levelRewardsResponseSchema);
}

export type ClaimResult =
  | ({ readonly kind: "claimed" } & ClaimLevelRewardResponse)
  | { readonly kind: "refused"; readonly reason: ClaimRefusal };

/** Opens the coffret of a level. Idempotent on the server: the level is the key. */
export async function claimLevelReward(level: number): Promise<ClaimResult> {
  const response = await sendAsPlayer(`/me/level-rewards/${level}`, { method: "POST" });
  if (response.status === 409) {
    return { kind: "refused", reason: (await parse(response, claimRefusalSchema)).error };
  }
  if (!response.ok) throw new ApiError("claim_failed", response.status);
  return { kind: "claimed", ...(await parse(response, claimLevelRewardResponseSchema)) };
}

export type CardChoiceResult =
  | ({ readonly kind: "chosen" } & CardChoiceResponse)
  | { readonly kind: "refused"; readonly reason: CardChoiceRefusal };

/** Takes the card of the player's choice won at `level`. Idempotent for the same card. */
export async function chooseCard(level: number, cardId: string): Promise<CardChoiceResult> {
  const response = await sendAsPlayer("/me/card-choices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level, cardId }),
  });
  if (response.status === 409 || response.status === 422) {
    return { kind: "refused", reason: (await parse(response, cardChoiceRefusalSchema)).error };
  }
  if (!response.ok) throw new ApiError("choice_failed", response.status);
  return { kind: "chosen", ...(await parse(response, cardChoiceResponseSchema)) };
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

/** Today's answers towards the daily goal (D-01). */
export async function fetchDaily(): Promise<DailyChallengeResponse> {
  const response = await sendAsPlayer("/challenges/daily");
  if (!response.ok) throw new ApiError("daily_unavailable", response.status);
  return parse(response, dailyChallengeResponseSchema);
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

/** The player's own profile when a session exists, `null` otherwise: a visitor stays a visitor. */
export async function fetchProfileIfSignedIn(): Promise<ProfileResponse | null> {
  const response = await send("/me/profile");
  if (response.status === 401) return null;
  if (!response.ok) throw new ApiError("profile_unavailable", response.status);
  return parse(response, profileResponseSchema);
}

/** Reads `{ error }` when it is one of the refusals `schema` knows, else `null`. */
export async function refusal<T>(response: Response, schema: z.ZodType<T>): Promise<T | null> {
  const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
  const reason = schema.safeParse(body.success ? body.data.error : null);
  return reason.success ? reason.data : null;
}

export type ProfileResult =
  | { readonly kind: "ok"; readonly profile: ProfileResponse }
  | { readonly kind: "refused"; readonly reason: ProfileRefusal };

async function profileResult(response: Response, failure: string): Promise<ProfileResult> {
  if (response.ok) return { kind: "ok", profile: await parse(response, profileResponseSchema) };
  if ([403, 409, 422].includes(response.status)) {
    const reason = await refusal(response, profileRefusalSchema);
    if (reason !== null) return { kind: "refused", reason };
  }
  throw new ApiError(failure, response.status);
}

/** Pseudo, avatar, frame, title, visibility (P-04, P-07, R-05): only the fields sent change. */
export async function updateProfile(changes: UpdateProfileRequest): Promise<ProfileResult> {
  const response = await sendAsPlayer("/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  return profileResult(response, "profile_not_saved");
}

/** The pinned cards, all of them, in their order (A-08). */
export async function setPinnedCards(cardIds: readonly string[]): Promise<ProfileResult> {
  const response = await sendAsPlayer("/me/pinned-cards", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardIds }),
  });
  return profileResult(response, "pins_not_saved");
}

/** A public profile by pseudo (P-05); `null` when there is none to show. */
export async function fetchPublicProfile(pseudo: string): Promise<PublicProfile | null> {
  const response = await send(`/players/${encodeURIComponent(pseudo)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError("profile_unavailable", response.status);
  return parse(response, publicProfileSchema);
}

export type BlockResult =
  | { readonly kind: "ok" }
  | { readonly kind: "refused"; readonly reason: BlockRefusal };

async function blockResult(response: Response, failure: string): Promise<BlockResult> {
  if (response.ok) return { kind: "ok" };
  if ([403, 404, 422].includes(response.status)) {
    const reason = await refusal(response, blockRefusalSchema);
    if (reason !== null) return { kind: "refused", reason };
  }
  throw new ApiError(failure, response.status);
}

export async function fetchBlocks(): Promise<BlocksResponse["players"]> {
  const response = await sendAsPlayer("/me/blocks");
  if (!response.ok) throw new ApiError("blocks_unavailable", response.status);
  return (await parse(response, blocksResponseSchema)).players;
}

/** Blocks or unblocks a player by code (P-06); both are idempotent on the server. */
export async function setBlocked(playerCode: string, blocked: boolean): Promise<BlockResult> {
  const response = await sendAsPlayer(`/me/blocks/${encodeURIComponent(playerCode)}`, {
    method: blocked ? "PUT" : "DELETE",
  });
  return blockResult(response, "block_failed");
}

/** Reports a pseudo to the moderation (P-08). */
export async function reportPlayer(pseudo: string): Promise<BlockResult> {
  const response = await sendAsPlayer(`/players/${encodeURIComponent(pseudo)}/report`, {
    method: "POST",
  });
  return blockResult(response, "report_failed");
}

export async function fetchPreferences(): Promise<Preferences> {
  const response = await sendAsPlayer("/me/preferences");
  if (!response.ok) throw new ApiError("preferences_unavailable", response.status);
  return parse(response, preferencesSchema);
}

export async function updatePreferences(changes: Partial<Preferences>): Promise<Preferences> {
  const response = await sendAsPlayer("/me/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw new ApiError("preferences_not_saved", response.status);
  return parse(response, preferencesSchema);
}

export type DeleteAccountResult =
  | { readonly kind: "deleted" }
  | { readonly kind: "refused"; readonly reason: DeleteAccountRefusal };

/** Erases the account for good (R-07). The server signs the player out in the same answer. */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const response = await send("/me/account", { method: "DELETE" });
  if (response.ok) return { kind: "deleted" };
  if (response.status === 409) {
    const reason = await refusal(response, deleteAccountRefusalSchema);
    if (reason !== null) return { kind: "refused", reason };
  }
  throw new ApiError("account_not_deleted", response.status);
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
    const reason = await refusal(response, tradeRefusalSchema);
    if (reason !== null) return { kind: "refused", reason };
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

// --- Campaign e-mails (P61) ---------------------------------------------------------------------

/** Whether the member asked for news by e-mail. */
export async function fetchEmailPreferences(): Promise<EmailPreferences> {
  const response = await send("/me/email-preferences");
  if (!response.ok) throw new ApiError("preferences_unavailable", response.status);
  return parse(response, emailPreferencesSchema);
}

/** Gives or withdraws consent; `source` is kept as proof of where it was given. */
export async function setEmailPreferences(
  request: UpdateEmailPreferencesRequest,
): Promise<EmailPreferences> {
  const response = await postJson("/me/email-preferences", request);
  if (!response.ok) throw new ApiError("preferences_unavailable", response.status);
  return parse(response, emailPreferencesSchema);
}

/** Unsubscribes the recipient of a campaign e-mail, from the token of its link. No session. */
export async function unsubscribeFromLink(token: string): Promise<"done" | "invalid"> {
  const response = await send(`/email/unsubscribe/${encodeURIComponent(token)}`, {
    method: "POST",
  });
  if (response.ok) return "done";
  if (response.status === 400) return "invalid";
  throw new ApiError("unsubscribe_unavailable", response.status);
}

// --- Waiting list -------------------------------------------------------------------------------

export type JoinWaitlistResult =
  | { readonly kind: "joined" }
  | { readonly kind: "refused"; readonly reason: "invalid_email" | "rate_limited" }
  /** The game is open: the list took its last address (P55). */
  | { readonly kind: "closed" };

/** Puts the address on the list warned when the game opens. No session: it creates no player. */
export async function joinWaitlist(email: string): Promise<JoinWaitlistResult> {
  const response = await postJson("/waitlist", { email } satisfies JoinWaitlistRequest);
  if (response.ok) return { kind: "joined" };
  if (response.status === 400) return { kind: "refused", reason: "invalid_email" };
  if (response.status === 429) return { kind: "refused", reason: "rate_limited" };
  if (response.status === 410) return { kind: "closed" };
  throw new ApiError("waitlist_unavailable", response.status);
}
