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
} from "@leximon/contract";
import { z } from "zod";
import { ApiError, parse, refusal, send, sendAsPlayer } from "../lib/api";

/** Browser client of the friends' routes, and of the friend link's public page. */

/** A refusal the screen explains, or the value. `account_locked` comes from a sanction. */
export type FriendResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "refused"; readonly reason: FriendRefusal | "account_locked" };

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

function json(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

const code = (value: string) => encodeURIComponent(value);

export async function fetchFriends(): Promise<FriendsResponse> {
  const response = await sendAsPlayer("/me/friends");
  if (!response.ok) throw new ApiError("friends_unavailable", response.status);
  return parse(response, friendsResponseSchema);
}

export async function askFriend(
  body: SendFriendRequest,
): Promise<FriendResult<SendFriendRequestResponse>> {
  const response = await sendAsPlayer("/me/friend-requests", json("POST", body));
  return result(response, sendFriendRequestResponseSchema);
}

export async function acceptFriend(player: string): Promise<FriendResult<AcceptFriendResponse>> {
  const response = await sendAsPlayer(`/me/friend-requests/${code(player)}/accept`, json("POST"));
  return result(response, acceptFriendResponseSchema);
}

export async function declineFriend(player: string): Promise<FriendResult<void>> {
  const response = await sendAsPlayer(`/me/friend-requests/${code(player)}/decline`, json("POST"));
  return result(response, null);
}

export async function cancelFriendRequest(player: string): Promise<FriendResult<void>> {
  const response = await sendAsPlayer(`/me/friend-requests/${code(player)}`, json("DELETE"));
  return result(response, null);
}

export async function removeFriend(player: string): Promise<FriendResult<void>> {
  return result(await sendAsPlayer(`/me/friends/${code(player)}`, json("DELETE")), null);
}

/** `null` when that player is not, or no longer, a friend. */
export async function fetchFriendCards(player: string): Promise<FriendCardsResponse | null> {
  const response = await sendAsPlayer(`/me/friends/${code(player)}/cards`);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError("cards_unavailable", response.status);
  return parse(response, friendCardsResponseSchema);
}

export async function fetchPodium(): Promise<PodiumResponse> {
  const response = await sendAsPlayer("/me/friends/podium");
  if (!response.ok) throw new ApiError("podium_unavailable", response.status);
  return parse(response, podiumResponseSchema);
}

/** Newest first; `before` pages back from the oldest event shown. */
export async function fetchFeed(before?: number): Promise<FeedResponse> {
  const query = before === undefined ? "" : `?before=${before}`;
  const response = await sendAsPlayer(`/me/friends/feed${query}`);
  if (!response.ok) throw new ApiError("feed_unavailable", response.status);
  return parse(response, feedResponseSchema);
}

/** `null` takes the player's reaction back. */
export async function react(
  eventId: number,
  reaction: FriendReactionKind | null,
): Promise<FriendResult<void>> {
  const path = `/me/friend-reactions/${eventId}`;
  const init = reaction === null ? json("DELETE") : json("PUT", { reaction });
  return result(await sendAsPlayer(path, init), null);
}

export type ClaimReferralResult =
  | { readonly kind: "claimed"; readonly wallet: BoosterWalletResponse }
  | { readonly kind: "refused"; readonly reason: ClaimReferralRefusal };

export async function claimReferral(refereeCode: string): Promise<ClaimReferralResult> {
  const response = await sendAsPlayer(`/me/referrals/${code(refereeCode)}/claim`, json("POST"));
  if (response.ok) {
    return { kind: "claimed", wallet: (await parse(response, claimReferralResponseSchema)).wallet };
  }
  const reason = await refusal(response, claimReferralRefusalSchema);
  if (reason !== null) return { kind: "refused", reason };
  throw new ApiError("failed", response.status);
}

/** Who invites by a friend link; `null` when the link leads to nobody. Needs no session. */
export async function fetchReferrer(player: string): Promise<ReferrerResponse | null> {
  const response = await send(`/referrers/${code(player)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError("referrer_unavailable", response.status);
  return parse(response, referrerResponseSchema);
}
