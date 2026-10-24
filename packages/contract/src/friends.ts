import { FRIEND_REACTIONS } from "@leximon/core";
import { z } from "zod";
import { boosterWalletSchema } from "./boosters";
import { slugSchema, timestampSchema } from "./common";
import { playerBadgeSchema, profileClanSchema } from "./profile";
import { playerCodeSchema } from "./trades";

/** Sent on guest sign-in by a player who came by a friend link: the code of the inviter. */
export const REFERRER_HEADER = "X-Leximon-Referrer";

/** Where the viewer stands with another player, on their profile. */
export const friendshipSchema = z.enum(["none", "friends", "requested", "incoming"]);
export type Friendship = z.infer<typeof friendshipSchema>;

export const friendSchema = z.object({
  player: playerBadgeSchema,
  online: z.boolean(),
  /** `null` before their first visit was recorded. */
  lastSeenAt: timestampSchema.nullable(),
  clan: profileClanSchema.nullable(),
  since: timestampSchema,
  /** Trades possible: as many as the poorer side has tradeable cards the other one lacks. */
  trades: z.int().nonnegative(),
  /** First of last week's podium. */
  crowned: z.boolean(),
});
export type Friend = z.infer<typeof friendSchema>;

export const friendRequestSchema = z.object({
  player: playerBadgeSchema,
  createdAt: timestampSchema,
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

/** `GET /me/friends`, 200. */
export const friendsResponseSchema = z.object({
  /** Last seen first. */
  friends: z.array(friendSchema),
  /** Requests waiting for the player's answer, newest first. */
  incoming: z.array(friendRequestSchema),
  /** Requests the player sent, still waiting, newest first. */
  outgoing: z.array(friendRequestSchema),
  maxFriends: z.int().positive(),
  link: z.object({
    /** The player's public code, the end of their friend link. */
    code: z.string(),
    /** Places of the closed beta left on the link; `null` when the beta is open to all. */
    betaPlacesLeft: z.int().nonnegative().nullable(),
  }),
});
export type FriendsResponse = z.infer<typeof friendsResponseSchema>;

/** `POST /me/friend-requests` body: a pseudo typed whole, or a code. */
export const sendFriendRequestSchema = z.union([
  z.object({ pseudo: z.string().trim().min(1).max(40) }),
  z.object({ code: playerCodeSchema }),
]);
export type SendFriendRequest = z.input<typeof sendFriendRequestSchema>;

/** `POST /me/friend-requests`, 200: sent, or accepted at once when that player had asked too. */
export const sendFriendRequestResponseSchema = z.object({
  outcome: z.enum(["sent", "accepted"]),
  player: playerBadgeSchema,
});
export type SendFriendRequestResponse = z.infer<typeof sendFriendRequestResponseSchema>;

/**
 * Refusals, as `{ error }`. 403 for `account_required` and `pseudo_required`, 404 for
 * `player_not_found` and `request_not_found`, 422 for the rest.
 */
export const friendRefusalSchema = z.enum([
  "account_required",
  "pseudo_required",
  "player_not_found",
  "request_not_found",
  "self",
  "already_friends",
  "already_requested",
  "requests_closed",
  "recently_declined",
  "daily_limit_reached",
  "too_many_pending",
  "friend_limit_reached",
  "their_friend_limit_reached",
]);
export type FriendRefusal = z.infer<typeof friendRefusalSchema>;

/** `POST /me/friend-requests/:code/accept`, 200. */
export const acceptFriendResponseSchema = z.object({ player: playerBadgeSchema });
export type AcceptFriendResponse = z.infer<typeof acceptFriendResponseSchema>;

/** `GET /me/friends/:code/cards`, 200: distinct cards a friend owns, to compare albums. */
export const friendCardsResponseSchema = z.object({
  player: playerBadgeSchema,
  cardIds: z.array(slugSchema),
});
export type FriendCardsResponse = z.infer<typeof friendCardsResponseSchema>;

export const podiumEntrySchema = z.object({
  player: playerBadgeSchema,
  answers: z.int().nonnegative(),
  rank: z.int().positive(),
  self: z.boolean(),
});
export type PodiumEntry = z.infer<typeof podiumEntrySchema>;

/** `GET /me/friends/podium`, 200: the player and their friends this week, best first. */
export const podiumResponseSchema = z.object({
  weekEnd: timestampSchema,
  entries: z.array(podiumEntrySchema),
});
export type PodiumResponse = z.infer<typeof podiumResponseSchema>;

export const friendReactionSchema = z.enum(FRIEND_REACTIONS);
export type FriendReactionKind = z.infer<typeof friendReactionSchema>;

const feedEventBase = {
  id: z.int().positive(),
  player: playerBadgeSchema,
  createdAt: timestampSchema,
  /** Each reaction given, with how many friends gave it; missing reactions are 0. */
  reactions: z.array(z.object({ reaction: friendReactionSchema, count: z.int().positive() })),
  /** The viewer's own reaction. */
  mine: friendReactionSchema.nullable(),
};

/** What a friend found. The viewer's own events show too, with the reactions they got. */
export const feedEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["rare_find", "gilded"]), ...feedEventBase, cardId: slugSchema }),
  z.object({ kind: z.literal("level"), ...feedEventBase, level: z.int().positive() }),
  z.object({
    kind: z.literal("collection_complete"),
    ...feedEventBase,
    collectionId: slugSchema,
  }),
]);
export type FeedEvent = z.infer<typeof feedEventSchema>;

/** `GET /me/friends/feed` query: `before` pages back from the oldest event received. */
export const feedQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
});

/** `GET /me/friends/feed`, 200: newest first. */
export const feedResponseSchema = z.object({
  events: z.array(feedEventSchema),
  hasMore: z.boolean(),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;

/** `PUT /me/friend-reactions/:eventId` body. */
export const reactRequestSchema = z.object({ reaction: friendReactionSchema });

/** `GET /referrers/:code`, 200: who invites, on the page of a friend link. */
export const referrerResponseSchema = z.object({
  player: z.object({
    pseudo: z.string(),
    avatar: z.string(),
    frame: z.string(),
  }),
  /** `full` when the closed beta has no place left on this link. */
  status: z.enum(["open", "full"]),
});
export type ReferrerResponse = z.infer<typeof referrerResponseSchema>;

/** A bonus booster earned by a friend link, waiting to be claimed. */
export const referralRewardSchema = z.object({
  /** The other player of the invitation. */
  player: playerBadgeSchema.nullable(),
  /** `referrer` when the player invited, `referee` when they were invited. */
  role: z.enum(["referrer", "referee"]),
  /** The invited player's code, which names the reward in the claim route. */
  refereeCode: z.string(),
  boosters: z.int().positive(),
});
export type ReferralReward = z.infer<typeof referralRewardSchema>;

/** `POST /me/referrals/:code/claim`, 200 (also when a retry replays it). */
export const claimReferralResponseSchema = z.object({ wallet: boosterWalletSchema });
export type ClaimReferralResponse = z.infer<typeof claimReferralResponseSchema>;

/** `POST /me/referrals/:code/claim` refusals: 404, or 409 when the reserve is full. */
export const claimReferralRefusalSchema = z.enum(["reward_not_found", "reserve_full"]);
export type ClaimReferralRefusal = z.infer<typeof claimReferralRefusalSchema>;
