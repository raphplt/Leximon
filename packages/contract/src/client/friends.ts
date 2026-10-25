import { z } from "zod";
import {
  type AcceptFriendResponse,
  acceptFriendResponseSchema,
  type BoosterWalletResponse,
  type ClaimReferralRefusal,
  claimReferralRefusalSchema,
  claimReferralResponseSchema,
  type FeedResponse,
  type FriendCardsResponse,
  type FriendReactionKind,
  type FriendRefusal,
  type FriendsResponse,
  feedResponseSchema,
  friendCardsResponseSchema,
  friendRefusalSchema,
  friendsResponseSchema,
  type PodiumResponse,
  podiumResponseSchema,
  type ReferrerResponse,
  referrerResponseSchema,
  type SendFriendRequest,
  type SendFriendRequestResponse,
  sendFriendRequestResponseSchema,
} from "../index";
import { ApiError, type Http, json, parse, refusal, segment, withQuery } from "./http";

/** A refusal the screen explains, or the value. `account_locked` comes from a sanction. */
export type FriendResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "refused"; readonly reason: FriendRefusal | "account_locked" };

export type ClaimReferralResult =
  | { readonly kind: "claimed"; readonly wallet: BoosterWalletResponse }
  | { readonly kind: "refused"; readonly reason: ClaimReferralRefusal };

const friendOrLockSchema = friendRefusalSchema.or(z.literal("account_locked"));

async function result<T>(
  response: Response,
  schema: z.ZodType<T> | null,
): Promise<FriendResult<T>> {
  if (response.ok) {
    const value = schema === null ? (undefined as T) : await parse(response, schema);
    return { kind: "ok", value };
  }
  if ([403, 404, 422].includes(response.status)) {
    const reason = await refusal(response, friendOrLockSchema);
    if (reason !== null) return { kind: "refused", reason };
  }
  throw new ApiError("failed", response.status);
}

/** The friends' routes, and the friend link's public page. */
export function friendRoutes(http: Http) {
  const { send, sendAsPlayer } = http;

  return {
    async fetchFriends(): Promise<FriendsResponse> {
      const response = await sendAsPlayer("/me/friends");
      if (!response.ok) throw new ApiError("friends_unavailable", response.status);
      return parse(response, friendsResponseSchema);
    },

    async askFriend(body: SendFriendRequest): Promise<FriendResult<SendFriendRequestResponse>> {
      const response = await sendAsPlayer("/me/friend-requests", json("POST", body));
      return result(response, sendFriendRequestResponseSchema);
    },

    async acceptFriend(player: string): Promise<FriendResult<AcceptFriendResponse>> {
      const path = `/me/friend-requests/${segment(player)}/accept`;
      return result(await sendAsPlayer(path, json("POST")), acceptFriendResponseSchema);
    },

    async declineFriend(player: string): Promise<FriendResult<void>> {
      const path = `/me/friend-requests/${segment(player)}/decline`;
      return result(await sendAsPlayer(path, json("POST")), null);
    },

    async cancelFriendRequest(player: string): Promise<FriendResult<void>> {
      const path = `/me/friend-requests/${segment(player)}`;
      return result(await sendAsPlayer(path, json("DELETE")), null);
    },

    async removeFriend(player: string): Promise<FriendResult<void>> {
      return result(await sendAsPlayer(`/me/friends/${segment(player)}`, json("DELETE")), null);
    },

    /** `null` when that player is not, or no longer, a friend. */
    async fetchFriendCards(player: string): Promise<FriendCardsResponse | null> {
      const response = await sendAsPlayer(`/me/friends/${segment(player)}/cards`);
      if (response.status === 404) return null;
      if (!response.ok) throw new ApiError("cards_unavailable", response.status);
      return parse(response, friendCardsResponseSchema);
    },

    async fetchPodium(): Promise<PodiumResponse> {
      const response = await sendAsPlayer("/me/friends/podium");
      if (!response.ok) throw new ApiError("podium_unavailable", response.status);
      return parse(response, podiumResponseSchema);
    },

    /** Newest first; `before` pages back from the oldest event shown. */
    async fetchFeed(before?: number): Promise<FeedResponse> {
      const response = await sendAsPlayer(withQuery("/me/friends/feed", { before }));
      if (!response.ok) throw new ApiError("feed_unavailable", response.status);
      return parse(response, feedResponseSchema);
    },

    /** `null` takes the player's reaction back. */
    async react(eventId: number, reaction: FriendReactionKind | null): Promise<FriendResult<void>> {
      const path = `/me/friend-reactions/${eventId}`;
      const init = reaction === null ? json("DELETE") : json("PUT", { reaction });
      return result(await sendAsPlayer(path, init), null);
    },

    async claimReferral(refereeCode: string): Promise<ClaimReferralResult> {
      const path = `/me/referrals/${segment(refereeCode)}/claim`;
      const response = await sendAsPlayer(path, json("POST"));
      if (response.ok) {
        const claimed = await parse(response, claimReferralResponseSchema);
        return { kind: "claimed", wallet: claimed.wallet };
      }
      const reason = await refusal(response, claimReferralRefusalSchema);
      if (reason !== null) return { kind: "refused", reason };
      throw new ApiError("failed", response.status);
    },

    /** Who invites by a friend link; `null` when the link leads to nobody. Needs no session. */
    async fetchReferrer(player: string): Promise<ReferrerResponse | null> {
      const response = await send(`/referrers/${segment(player)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new ApiError("referrer_unavailable", response.status);
      return parse(response, referrerResponseSchema);
    },
  };
}
