/**
 * Friends: a request the other player accepts, valid both ways. Friends see each other's whole
 * profile, trades they could make, a weekly podium and a feed of what they find. A personal link
 * brings new players, who become friends of the player who invited them once they have an
 * account.
 */

import { gameDayOf } from "../bonus/bonus";
import type { EpochMs } from "../booster/refill";

export interface FriendRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  readonly maxFriends: number;
  /** Requests a player may send over a rolling 24 hours. */
  readonly requestsPerDay: number;
  /** Requests a player may have waiting for an answer at once. */
  readonly maxPendingSent: number;
  /** A request left unanswered this long expires. */
  readonly requestTtlMs: number;
  /** After a refusal, the same player cannot be asked again before this delay. */
  readonly declinedCooldownMs: number;
  /** New players a friend link lets into the closed beta, per player. */
  readonly betaPlacesPerPlayer: number;
  /** Level the invited player reaches for both players to claim a bonus booster. */
  readonly referralLevel: number;
  /** Invited players rewarded per calendar month in Paris, for one player who invites. */
  readonly referralRewardsPerMonth: number;
  /** Bonus boosters each player claims for a rewarded invitation. */
  readonly referralBoosters: number;
  /** An account level enters the feed when it is a multiple of this. */
  readonly feedLevelStep: number;
  /** Feed events are erased after this delay. */
  readonly feedTtlMs: number;
}

export type FriendSchedule = readonly [FriendRules, ...FriendRules[]];

export function friendRulesAt(schedule: FriendSchedule, time: EpochMs): FriendRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export type FriendRequestRefusal =
  | "self"
  | "already_friends"
  | "already_requested"
  | "requests_closed"
  | "recently_declined"
  | "daily_limit_reached"
  | "too_many_pending"
  | "friend_limit_reached"
  | "their_friend_limit_reached";

/** What the server knows when a player asks another one to be friends. */
export interface FriendRequestContext {
  readonly self: boolean;
  readonly alreadyFriends: boolean;
  /** A request from the sender to the recipient, still waiting. */
  readonly alreadyRequested: boolean;
  /** The recipient's setting: anyone may ask, or nobody. */
  readonly recipientAcceptsRequests: boolean;
  /** When the recipient last refused a request from the sender, if they did. */
  readonly declinedAt: EpochMs | null;
  readonly sentLastDay: number;
  readonly pendingSent: number;
  readonly senderFriends: number;
  readonly recipientFriends: number;
}

/** Why a request cannot be sent, or `null` when it can. */
export function checkFriendRequest(
  rules: FriendRules,
  context: FriendRequestContext,
  now: EpochMs,
): FriendRequestRefusal | null {
  if (context.self) return "self";
  if (context.alreadyFriends) return "already_friends";
  if (context.alreadyRequested) return "already_requested";
  if (!context.recipientAcceptsRequests) return "requests_closed";
  if (context.declinedAt !== null && now < context.declinedAt + rules.declinedCooldownMs) {
    return "recently_declined";
  }
  if (context.sentLastDay >= rules.requestsPerDay) return "daily_limit_reached";
  if (context.pendingSent >= rules.maxPendingSent) return "too_many_pending";
  return checkFriendship(rules, context.senderFriends, context.recipientFriends);
}

/** Whether two players with these many friends can become friends now. */
export function checkFriendship(
  rules: FriendRules,
  ownFriends: number,
  otherFriends: number,
): "friend_limit_reached" | "their_friend_limit_reached" | null {
  if (ownFriends >= rules.maxFriends) return "friend_limit_reached";
  if (otherFriends >= rules.maxFriends) return "their_friend_limit_reached";
  return null;
}

/** A request is waiting while it is neither refused nor expired. */
export function isRequestPending(
  rules: FriendRules,
  request: { readonly createdAt: EpochMs; readonly declinedAt: EpochMs | null },
  now: EpochMs,
): boolean {
  return request.declinedAt === null && now < request.createdAt + rules.requestTtlMs;
}

/** Places of the closed beta still open on a player's friend link. */
export function betaPlacesLeft(rules: FriendRules, used: number): number {
  return Math.max(0, rules.betaPlacesPerPlayer - used);
}

/** The calendar month in Paris that contains `time`, as `YYYY-MM`. */
export function gameMonthOf(time: EpochMs): string {
  return gameDayOf(time).key.slice(0, 7);
}

/** Whether a new rewarded invitation fits in the month of the player who invited. */
export function referralRewardFits(rules: FriendRules, rewardedThisMonth: number): boolean {
  return rewardedThisMonth < rules.referralRewardsPerMonth;
}

/** Trades possible with a friend: as many as one side has cards the other one lacks. */
export function possibleTrades(give: number, get: number): number {
  return Math.min(give, get);
}

/** Levels that enter the feed when an account goes from one level to another. */
export function feedLevels(rules: FriendRules, from: number, to: number): readonly number[] {
  const levels: number[] = [];
  const first = Math.floor(from / rules.feedLevelStep + 1) * rules.feedLevelStep;
  for (let level = first; level <= to; level += rules.feedLevelStep) levels.push(level);
  return levels;
}

export const FRIEND_REACTIONS = ["hats_off", "jealous", "lucky", "well_played"] as const;
export type FriendReaction = (typeof FRIEND_REACTIONS)[number];

export interface PodiumEntry {
  readonly userId: string;
  readonly answers: number;
}

export interface RankedEntry extends PodiumEntry {
  /** 1 for the first; players tied share a rank, and the next rank skips them (1, 1, 3). */
  readonly rank: number;
}

/**
 * The weekly podium: most correct answers first, ties sharing their rank. Among tied players,
 * the order is stable on the user id so that the list does not shuffle between two reads.
 */
export function rankPodium(entries: readonly PodiumEntry[]): readonly RankedEntry[] {
  const sorted = [...entries].sort(
    (a, b) => b.answers - a.answers || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
  const ranked: RankedEntry[] = [];
  for (const [index, entry] of sorted.entries()) {
    const previous = ranked[index - 1];
    const rank =
      previous !== undefined && previous.answers === entry.answers ? previous.rank : index + 1;
    ranked.push({ ...entry, rank });
  }
  return ranked;
}

/** Who wears the crown for a finished week: the first, all of them if tied, nobody at zero. */
export function crownedPlayers(entries: readonly PodiumEntry[]): ReadonlySet<string> {
  const best = Math.max(0, ...entries.map((entry) => entry.answers));
  if (best === 0) return new Set();
  return new Set(entries.filter((entry) => entry.answers === best).map((entry) => entry.userId));
}
