import type { z } from "zod";
import {
  type BlockRefusal,
  type BlocksResponse,
  type BoosterSource,
  type BoosterWalletResponse,
  blockRefusalSchema,
  blocksResponseSchema,
  boosterStockEmptySchema,
  boosterWalletSchema,
  type ChallengeAnswerRequest,
  type ChallengeAnswerResponse,
  type ChallengesResponse,
  type ClaimLevelRewardResponse,
  type ClaimRefusal,
  type CreateTradeRequest,
  challengeAnswerResponseSchema,
  challengesResponseSchema,
  claimLevelRewardResponseSchema,
  claimRefusalSchema,
  type DailyChallengeResponse,
  type DeleteAccountRefusal,
  dailyChallengeResponseSchema,
  deleteAccountRefusalSchema,
  errorResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type InterestKind,
  type LevelRewardsResponse,
  levelRequiredSchema,
  levelRewardsResponseSchema,
  type MailResponse,
  type MasteryResponse,
  mailResponseSchema,
  markMailReadResponseSchema,
  masteryResponseSchema,
  type OpenBoosterResponse,
  type OwnedCardsResponse,
  openBoosterResponseSchema,
  ownedCardsResponseSchema,
  type PlayersResponse,
  type PracticeAnswerRequest,
  type PracticeAnswerResponse,
  type PracticeQuestion,
  type PracticeScope,
  type PracticeSummaryResponse,
  type Preferences,
  type ProfileRefusal,
  type ProfileResponse,
  type ProgressResponse,
  type PublicProfile,
  type PublicRiddle,
  playersResponseSchema,
  practiceAnswerResponseSchema,
  practiceResponseSchema,
  practiceSummaryResponseSchema,
  preferencesSchema,
  profileRefusalSchema,
  profileResponseSchema,
  progressResponseSchema,
  publicProfileSchema,
  publicRiddleSchema,
  type RiddleAnswerRequest,
  type RiddleAnswerResponse,
  type RiddleResponse,
  riddleAnswerResponseSchema,
  riddleResponseSchema,
  type SendFeedbackRequest,
  signupRequiredSchema,
  type Trade,
  type TradeableCardsResponse,
  type TradeRefusalCode,
  type TradesResponse,
  tradeableCardsResponseSchema,
  tradeRefusalSchema,
  tradeSchema,
  tradesResponseSchema,
  type UpdateProfileRequest,
} from "../index";
import { ApiError, type Http, json, parse, refusal, segment, withQuery } from "./http";

export type OpenBoosterResult =
  | ({ readonly kind: "opened" } & OpenBoosterResponse)
  | { readonly kind: "stock_empty"; readonly nextRefillAt: string }
  /** The guest opened all its boosters: an account is required to go on. */
  | { readonly kind: "signup_required" }
  /** Choosing the collection opens at a level: the screen was out of date. */
  | { readonly kind: "level_required"; readonly level: number };

export type ClaimResult =
  | ({ readonly kind: "claimed" } & ClaimLevelRewardResponse)
  | { readonly kind: "refused"; readonly reason: ClaimRefusal };

export type AnswerResult =
  | ({ readonly kind: "answered" } & ChallengeAnswerResponse)
  /** Already answered elsewhere (another tab, another device): the question is simply skipped. */
  | { readonly kind: "not_due" };

export type PracticeStart =
  | { readonly kind: "ready"; readonly questions: readonly PracticeQuestion[] }
  /** The scope shrank or stays closed: its list is out of date. */
  | { readonly kind: "refused" };

export type PracticeAnswerResult =
  | ({ readonly kind: "answered" } & PracticeAnswerResponse)
  /** The card left in a trade since the question was served: the question is simply skipped. */
  | { readonly kind: "not_owned" };

export type RiddleAnswerResult =
  | ({ readonly kind: "answered" } & RiddleAnswerResponse)
  /** The day changed while the player was on it: there is a new riddle to read. */
  | { readonly kind: "over" };

export type ProfileResult =
  | { readonly kind: "ok"; readonly profile: ProfileResponse }
  | { readonly kind: "refused"; readonly reason: ProfileRefusal };

export type BlockResult =
  | { readonly kind: "ok" }
  | { readonly kind: "refused"; readonly reason: BlockRefusal };

export type DeleteAccountResult =
  | { readonly kind: "deleted" }
  | { readonly kind: "refused"; readonly reason: DeleteAccountRefusal };

export type TradeResult =
  | { readonly kind: "ok"; readonly trade: Trade }
  | { readonly kind: "refused"; readonly reason: TradeRefusalCode };

/** A known refusal among `statuses`, else a failure the player can only retry. */
async function refusedOr<T>(
  response: Response,
  statuses: readonly number[],
  schema: z.ZodType<T>,
  failure: string,
): Promise<T> {
  if (statuses.includes(response.status)) {
    const reason = await refusal(response, schema);
    if (reason !== null) return reason;
  }
  throw new ApiError(failure, response.status);
}

/** The game routes of the signed-in player (a guest is created on the first request). */
export function gameRoutes(http: Http) {
  const { send, sendAsPlayer } = http;

  async function getJson<T>(path: string, schema: z.ZodType<T>, failure: string): Promise<T> {
    const response = await sendAsPlayer(path);
    if (!response.ok) throw new ApiError(failure, response.status);
    return parse(response, schema);
  }

  async function profileResult(response: Response, failure: string): Promise<ProfileResult> {
    if (response.ok) return { kind: "ok", profile: await parse(response, profileResponseSchema) };
    const reason = await refusedOr(response, [403, 409, 422], profileRefusalSchema, failure);
    return { kind: "refused", reason };
  }

  async function blockResult(response: Response, failure: string): Promise<BlockResult> {
    if (response.ok) return { kind: "ok" };
    const reason = await refusedOr(response, [403, 404, 422], blockRefusalSchema, failure);
    return { kind: "refused", reason };
  }

  async function tradeResult(response: Response, failure: string): Promise<TradeResult> {
    if (response.ok) return { kind: "ok", trade: await parse(response, tradeSchema) };
    const reason = await refusedOr(response, [404, 409, 422], tradeRefusalSchema, failure);
    return { kind: "refused", reason };
  }

  return {
    fetchWallet: (): Promise<BoosterWalletResponse> =>
      getJson("/me/wallet", boosterWalletSchema, "wallet_unavailable"),

    /** Every card the player owns, all pages included. */
    async fetchOwnedCards(): Promise<OwnedCardsResponse["cards"]> {
      const owned: OwnedCardsResponse["cards"] = [];
      let cursor: string | null = null;
      do {
        const path = withQuery("/me/cards", { limit: 500, cursor });
        const page: OwnedCardsResponse = await getJson(
          path,
          ownedCardsResponseSchema,
          "cards_unavailable",
        );
        owned.push(...page.cards);
        cursor = page.nextCursor;
      } while (cursor !== null);
      return owned;
    },

    /**
     * Opens a booster. The caller keeps `idempotencyKey` until it gets a result, so that a retry
     * after a network error never opens a second booster.
     */
    async openBooster(source: BoosterSource, idempotencyKey: string): Promise<OpenBoosterResult> {
      const response = await sendAsPlayer(
        "/boosters/open",
        json("POST", source, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      if (response.status === 409) {
        // The guest's game just went to an account (sign-in elsewhere): retrying uses it.
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
    },

    fetchLevelRewards: (): Promise<LevelRewardsResponse> =>
      getJson("/me/level-rewards", levelRewardsResponseSchema, "level_rewards_unavailable"),

    /** Opens the coffret of a level. Idempotent on the server: the level is the key. */
    async claimLevelReward(level: number): Promise<ClaimResult> {
      const response = await sendAsPlayer(`/me/level-rewards/${level}`, { method: "POST" });
      if (response.status === 409) {
        return { kind: "refused", reason: (await parse(response, claimRefusalSchema)).error };
      }
      if (!response.ok) throw new ApiError("claim_failed", response.status);
      return { kind: "claimed", ...(await parse(response, claimLevelRewardResponseSchema)) };
    },

    fetchChallenges: (limit = 5): Promise<ChallengesResponse> =>
      getJson(
        withQuery("/challenges", { limit }),
        challengesResponseSchema,
        "challenges_unavailable",
      ),

    /** Sends an answer. Like boosters, the caller keeps `idempotencyKey` until it gets a result. */
    async answerChallenge(
      answer: ChallengeAnswerRequest,
      idempotencyKey: string,
    ): Promise<AnswerResult> {
      const response = await sendAsPlayer(
        "/challenges/answer",
        json("POST", answer, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      if (response.status === 409 || response.status === 404) return { kind: "not_due" };
      if (!response.ok) throw new ApiError("answer_failed", response.status);
      return { kind: "answered", ...(await parse(response, challengeAnswerResponseSchema)) };
    },

    fetchPracticeSummary: (): Promise<PracticeSummaryResponse> =>
      getJson("/challenges/practice", practiceSummaryResponseSchema, "practice_unavailable"),

    async startPractice(scope: PracticeScope): Promise<PracticeStart> {
      const response = await sendAsPlayer("/challenges/practice", json("POST", { scope }));
      if (response.status === 403 || response.status === 422) return { kind: "refused" };
      if (!response.ok) throw new ApiError("practice_failed", response.status);
      const { questions } = await parse(response, practiceResponseSchema);
      return { kind: "ready", questions };
    },

    /** Sends a free practice answer; the caller keeps `idempotencyKey` until it gets a result. */
    async answerPractice(
      answer: PracticeAnswerRequest,
      idempotencyKey: string,
    ): Promise<PracticeAnswerResult> {
      const response = await sendAsPlayer(
        "/challenges/practice/answer",
        json("POST", answer, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      if (response.status === 404) return { kind: "not_owned" };
      if (!response.ok) throw new ApiError("answer_failed", response.status);
      return { kind: "answered", ...(await parse(response, practiceAnswerResponseSchema)) };
    },

    /** Today's riddle as this player stands; `null` when there is none. */
    async fetchRiddle(): Promise<RiddleResponse | null> {
      const response = await sendAsPlayer("/riddles/today");
      if (response.status === 404) return null;
      if (!response.ok) throw new ApiError("riddle_unavailable", response.status);
      return parse(response, riddleResponseSchema);
    },

    /** Sends a word, or asks for a clue; the caller keeps `idempotencyKey` until it gets a result. */
    async answerRiddle(
      answer: RiddleAnswerRequest,
      idempotencyKey: string,
    ): Promise<RiddleAnswerResult> {
      const response = await sendAsPlayer(
        "/riddles/today/answer",
        json("POST", answer, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      if (response.status === 409) return { kind: "over" };
      if (!response.ok) throw new ApiError("answer_failed", response.status);
      return { kind: "answered", ...(await parse(response, riddleAnswerResponseSchema)) };
    },

    /** Today's answers towards the daily goal. */
    fetchDaily: (): Promise<DailyChallengeResponse> =>
      getJson("/challenges/daily", dailyChallengeResponseSchema, "daily_unavailable"),

    async fetchMastery(): Promise<MasteryResponse["words"]> {
      return (await getJson("/me/mastery", masteryResponseSchema, "mastery_unavailable")).words;
    },

    /** The mail's letters, newest first; `before` pages back. */
    fetchMail: (before?: number): Promise<MailResponse> =>
      getJson(withQuery("/me/mail", { before }), mailResponseSchema, "mail_unavailable"),

    /** The player opened the card's sheet: it is no longer new. */
    async markCardRead(cardId: string): Promise<void> {
      const response = await sendAsPlayer(`/me/cards/${segment(cardId)}/read`, { method: "POST" });
      if (!response.ok) throw new ApiError("card_not_marked", response.status);
    },

    /** Marks every letter up to `upTo` read; returns how many stay unread. */
    async markMailRead(upTo: number): Promise<number> {
      const response = await sendAsPlayer("/me/mail/read", json("POST", { upTo }));
      if (!response.ok) throw new ApiError("mail_not_marked", response.status);
      return (await parse(response, markMailReadResponseSchema)).unread;
    },

    /** The player's account level. */
    fetchProgress: (): Promise<ProgressResponse> =>
      getJson("/me/progress", progressResponseSchema, "progress_unavailable"),

    fetchProfile: (): Promise<ProfileResponse> =>
      getJson("/me/profile", profileResponseSchema, "profile_unavailable"),

    /** The player's own profile when a session exists, `null` otherwise: a visitor stays one. */
    async fetchProfileIfSignedIn(): Promise<ProfileResponse | null> {
      const response = await send("/me/profile");
      if (response.status === 401) return null;
      if (!response.ok) throw new ApiError("profile_unavailable", response.status);
      return parse(response, profileResponseSchema);
    },

    /** Whether a session exists, without creating a guest. */
    async hasSession(): Promise<boolean> {
      return (await send("/me/account")).ok;
    },

    /** Pseudo, avatar, frame, title, visibility: only the fields sent change. */
    async updateProfile(changes: UpdateProfileRequest): Promise<ProfileResult> {
      return profileResult(
        await sendAsPlayer("/me/profile", json("PATCH", changes)),
        "profile_not_saved",
      );
    },

    /** The pinned cards, all of them, in their order. */
    async setPinnedCards(cardIds: readonly string[]): Promise<ProfileResult> {
      return profileResult(
        await sendAsPlayer("/me/pinned-cards", json("PUT", { cardIds })),
        "pins_not_saved",
      );
    },

    /** A public profile by pseudo; `null` when there is none to show. */
    async fetchPublicRiddle(number: number): Promise<PublicRiddle | null> {
      const response = await send(`/riddles/${number}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new ApiError("riddle_unavailable", response.status);
      return parse(response, publicRiddleSchema);
    },

    async fetchPublicProfile(pseudo: string): Promise<PublicProfile | null> {
      const response = await send(`/players/${segment(pseudo)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new ApiError("profile_unavailable", response.status);
      return parse(response, publicProfileSchema);
    },

    async fetchPublicPlayers(query: {
      readonly q?: string;
      readonly cursor?: string | null;
    }): Promise<PlayersResponse> {
      return getJson(withQuery("/players", query), playersResponseSchema, "players_unavailable");
    },

    async fetchBlocks(): Promise<BlocksResponse["players"]> {
      return (await getJson("/me/blocks", blocksResponseSchema, "blocks_unavailable")).players;
    },

    /** Blocks or unblocks a player by code; both are idempotent on the server. */
    async setBlocked(playerCode: string, blocked: boolean): Promise<BlockResult> {
      const response = await sendAsPlayer(`/me/blocks/${segment(playerCode)}`, {
        method: blocked ? "PUT" : "DELETE",
      });
      return blockResult(response, "block_failed");
    },

    /** Reports a pseudo to the moderation. */
    async reportPlayer(pseudo: string): Promise<BlockResult> {
      const response = await sendAsPlayer(`/players/${segment(pseudo)}/report`, {
        method: "POST",
      });
      return blockResult(response, "report_failed");
    },

    fetchPreferences: (): Promise<Preferences> =>
      getJson("/me/preferences", preferencesSchema, "preferences_unavailable"),

    async updatePreferences(changes: Partial<Preferences>): Promise<Preferences> {
      const response = await sendAsPlayer("/me/preferences", json("PATCH", changes));
      if (!response.ok) throw new ApiError("preferences_not_saved", response.status);
      return parse(response, preferencesSchema);
    },

    /** Erases the account for good. The server signs the player out in the same answer. */
    async deleteAccount(): Promise<DeleteAccountResult> {
      const response = await send("/me/account", { method: "DELETE" });
      if (response.ok) return { kind: "deleted" };
      const reason = await refusedOr(
        response,
        [409],
        deleteAccountRefusalSchema,
        "account_not_deleted",
      );
      return { kind: "refused", reason };
    },

    /** Cards a player can give now: mine without `playerCode`. `null` when the code is unknown. */
    async fetchTradeable(playerCode?: string): Promise<TradeableCardsResponse | null> {
      const path =
        playerCode === undefined ? "/me/tradeable" : `/players/${segment(playerCode)}/tradeable`;
      const response = await sendAsPlayer(path);
      if (response.status === 404) return null;
      if (!response.ok) throw new ApiError("tradeable_unavailable", response.status);
      return parse(response, tradeableCardsResponseSchema);
    },

    fetchTrades: (
      box: "incoming" | "outgoing",
      cursor: string | null = null,
    ): Promise<TradesResponse> =>
      getJson(withQuery("/trades", { box, cursor }), tradesResponseSchema, "trades_unavailable"),

    /** Sends an offer. The caller keeps `idempotencyKey` until it gets a result. */
    async createTrade(offer: CreateTradeRequest, idempotencyKey: string): Promise<TradeResult> {
      const response = await sendAsPlayer(
        "/trades",
        json("POST", offer, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      return tradeResult(response, "trade_failed");
    },

    /** Accepts, declines or cancels an offer; each is idempotent on the server. */
    async resolveTrade(
      tradeId: string,
      action: "accept" | "decline" | "cancel",
      idempotencyKey: string,
    ): Promise<TradeResult> {
      const response = await sendAsPlayer(`/trades/${segment(tradeId)}/${action}`, {
        method: "POST",
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      });
      return tradeResult(response, "trade_failed");
    },

    /** A tester's note, read by the team only. */
    async sendFeedback(request: SendFeedbackRequest): Promise<void> {
      const response = await sendAsPlayer("/me/feedback", json("POST", request));
      if (!response.ok) throw new ApiError("feedback_failed", response.status);
    },

    /** Interest in the patron offer, before it is sold. */
    async recordInterest(kind: InterestKind): Promise<void> {
      const response = await sendAsPlayer("/me/interest", json("POST", { kind }));
      if (!response.ok) throw new ApiError("interest_failed", response.status);
    },
  };
}
