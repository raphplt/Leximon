import { z } from "zod";
import {
  type AnswerJoustResponse,
  answerJoustResponseSchema,
  type DeckRefusal,
  deckRefusalSchema,
  IDEMPOTENCY_KEY_HEADER,
  type JoustDeckResponse,
  type JoustOpponentsResponse,
  type JoustQuestionResponse,
  type JoustRefusal,
  type JoustsResponse,
  type JoustView,
  joustDeckResponseSchema,
  joustOpponentsResponseSchema,
  joustQuestionResponseSchema,
  joustRefusalSchema,
  joustsResponseSchema,
  joustViewSchema,
  type LaunchJoustRequest,
  type LaunchRefusal,
  launchJoustResponseSchema,
  launchRefusalSchema,
} from "../index";
import { ApiError, type Http, json, parse, refusal, segment } from "./http";

/** `account_locked` comes from a sanction: the player cannot joust for now. */
type Locked = "account_locked";

export type SaveDeckResult =
  | { readonly kind: "saved" }
  | { readonly kind: "refused"; readonly reason: DeckRefusal | Locked };

export type LaunchJoustResult =
  | { readonly kind: "launched"; readonly joustId: string }
  | { readonly kind: "refused"; readonly reason: LaunchRefusal | Locked };

export type JoustQuestionResult =
  | JoustQuestionResponse
  | { readonly kind: "refused"; readonly reason: JoustRefusal | Locked };

export type JoustAnswerResult =
  | ({ readonly kind: "answered" } & AnswerJoustResponse)
  | { readonly kind: "refused"; readonly reason: JoustRefusal | Locked };

async function refused<T extends string>(
  response: Response,
  schema: z.ZodType<T>,
  failure: string,
): Promise<{ readonly kind: "refused"; readonly reason: T | Locked }> {
  if (response.status === 403 || response.status === 409) {
    const reason = await refusal(response, schema.or(z.literal("account_locked")));
    if (reason !== null) return { kind: "refused", reason };
  }
  throw new ApiError(failure, response.status);
}

/** Jousts: the deck, launching, playing a run on the server's clock, and reading the result. */
export function joustRoutes(http: Http) {
  const { sendAsPlayer } = http;
  const joust = (id: string, rest = "") => `/jousts/${segment(id)}${rest}`;

  async function getJson<T>(path: string, schema: z.ZodType<T>, failure: string): Promise<T> {
    const response = await sendAsPlayer(path);
    if (!response.ok) throw new ApiError(failure, response.status);
    return parse(response, schema);
  }

  return {
    fetchJousts: (): Promise<JoustsResponse> =>
      getJson("/jousts", joustsResponseSchema, "jousts_unavailable"),

    fetchJoustDeck: (): Promise<JoustDeckResponse> =>
      getJson("/jousts/deck", joustDeckResponseSchema, "deck_unavailable"),

    async saveJoustDeck(cardIds: readonly string[]): Promise<SaveDeckResult> {
      const response = await sendAsPlayer("/jousts/deck", json("PUT", { cardIds }));
      if (response.ok) return { kind: "saved" };
      return refused(response, deckRefusalSchema, "deck_not_saved");
    },

    fetchJoustOpponents: (): Promise<JoustOpponentsResponse> =>
      getJson("/jousts/opponents", joustOpponentsResponseSchema, "opponents_unavailable"),

    /** The caller keeps `idempotencyKey` until it gets a result: a retry never launches twice. */
    async launchJoust(
      request: LaunchJoustRequest,
      idempotencyKey: string,
    ): Promise<LaunchJoustResult> {
      const response = await sendAsPlayer(
        "/jousts",
        json("POST", request, { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
      );
      if (response.ok) {
        return { kind: "launched", ...(await parse(response, launchJoustResponseSchema)) };
      }
      return refused(response, launchRefusalSchema, "launch_failed");
    },

    /** Idempotent: the first visit stays done. */
    async markJoustGuideDone(): Promise<void> {
      const response = await sendAsPlayer("/jousts/guide", json("POST"));
      if (!response.ok) throw new ApiError("guide_not_saved", response.status);
    },

    /** Idempotent: the result stays opened. */
    async markJoustSeen(id: string): Promise<void> {
      const response = await sendAsPlayer(joust(id, "/seen"), json("POST"));
      if (!response.ok) throw new ApiError("seen_not_saved", response.status);
    },

    fetchJoust: (id: string): Promise<JoustView> =>
      getJson(joust(id), joustViewSchema, "joust_unavailable"),

    /** The next question, its clock started by the server; the same one again while it runs. */
    async nextJoustQuestion(id: string): Promise<JoustQuestionResult> {
      const response = await sendAsPlayer(joust(id, "/next"), json("POST"));
      if (response.ok) return parse(response, joustQuestionResponseSchema);
      return refused(response, joustRefusalSchema, "question_unavailable");
    },

    /** Answering a position twice returns the first answer. */
    async answerJoust(id: string, position: number, cardId: string): Promise<JoustAnswerResult> {
      const response = await sendAsPlayer(joust(id, "/answer"), json("POST", { position, cardId }));
      if (response.ok) {
        return { kind: "answered", ...(await parse(response, answerJoustResponseSchema)) };
      }
      return refused(response, joustRefusalSchema, "answer_failed");
    },
  };
}
