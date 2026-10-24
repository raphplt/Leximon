import { describe, expect, it } from "vitest";
import { FRIEND_SCHEDULE } from "../rules";
import {
  betaPlacesLeft,
  checkFriendRequest,
  crownedPlayers,
  type FriendRequestContext,
  feedLevels,
  friendRulesAt,
  gameMonthOf,
  isRequestPending,
  possibleTrades,
  rankPodium,
  referralRewardFits,
} from "./friend";

const now = Date.UTC(2026, 9, 24, 12);
const rules = friendRulesAt(FRIEND_SCHEDULE, now);
const DAY = 86_400_000;

const open: FriendRequestContext = {
  self: false,
  alreadyFriends: false,
  alreadyRequested: false,
  recipientAcceptsRequests: true,
  declinedAt: null,
  sentLastDay: 0,
  pendingSent: 0,
  senderFriends: 0,
  recipientFriends: 0,
};

describe("checkFriendRequest", () => {
  it("lets a request through when nothing stands in the way", () => {
    expect(checkFriendRequest(rules, open, now)).toBeNull();
  });

  it("refuses to ask oneself, a friend, or twice", () => {
    expect(checkFriendRequest(rules, { ...open, self: true }, now)).toBe("self");
    expect(checkFriendRequest(rules, { ...open, alreadyFriends: true }, now)).toBe(
      "already_friends",
    );
    expect(checkFriendRequest(rules, { ...open, alreadyRequested: true }, now)).toBe(
      "already_requested",
    );
  });

  it("respects a player who takes no request", () => {
    expect(checkFriendRequest(rules, { ...open, recipientAcceptsRequests: false }, now)).toBe(
      "requests_closed",
    );
  });

  it("waits a week before asking again someone who refused", () => {
    const declinedAt = now - 6 * DAY;
    expect(checkFriendRequest(rules, { ...open, declinedAt }, now)).toBe("recently_declined");
    expect(checkFriendRequest(rules, { ...open, declinedAt: now - 7 * DAY }, now)).toBeNull();
  });

  it("caps requests per day and requests waiting", () => {
    expect(checkFriendRequest(rules, { ...open, sentLastDay: rules.requestsPerDay }, now)).toBe(
      "daily_limit_reached",
    );
    expect(checkFriendRequest(rules, { ...open, pendingSent: rules.maxPendingSent }, now)).toBe(
      "too_many_pending",
    );
  });

  it("caps friends on both sides", () => {
    expect(checkFriendRequest(rules, { ...open, senderFriends: rules.maxFriends }, now)).toBe(
      "friend_limit_reached",
    );
    expect(checkFriendRequest(rules, { ...open, recipientFriends: rules.maxFriends }, now)).toBe(
      "their_friend_limit_reached",
    );
  });
});

describe("isRequestPending", () => {
  it("expires after 30 days and ends with a refusal", () => {
    expect(isRequestPending(rules, { createdAt: now - 29 * DAY, declinedAt: null }, now)).toBe(
      true,
    );
    expect(isRequestPending(rules, { createdAt: now - 30 * DAY, declinedAt: null }, now)).toBe(
      false,
    );
    expect(isRequestPending(rules, { createdAt: now, declinedAt: now }, now)).toBe(false);
  });
});

describe("referrals", () => {
  it("opens 3 places of the beta per player", () => {
    expect(betaPlacesLeft(rules, 0)).toBe(3);
    expect(betaPlacesLeft(rules, 3)).toBe(0);
    expect(betaPlacesLeft(rules, 5)).toBe(0);
  });

  it("rewards 5 invited players per month", () => {
    expect(referralRewardFits(rules, 4)).toBe(true);
    expect(referralRewardFits(rules, 5)).toBe(false);
  });

  it("counts months in Paris", () => {
    // 31 October at 23:30 UTC is already 1 November in Paris.
    expect(gameMonthOf(Date.UTC(2026, 9, 31, 23, 30))).toBe("2026-11");
    expect(gameMonthOf(Date.UTC(2026, 9, 31, 22, 30))).toBe("2026-10");
  });
});

describe("possibleTrades", () => {
  it("is limited by the poorer side", () => {
    expect(possibleTrades(4, 3)).toBe(3);
    expect(possibleTrades(0, 9)).toBe(0);
  });
});

describe("feedLevels", () => {
  it("keeps the multiples of 5 crossed", () => {
    expect(feedLevels(rules, 4, 5)).toEqual([5]);
    expect(feedLevels(rules, 5, 9)).toEqual([]);
    expect(feedLevels(rules, 3, 11)).toEqual([5, 10]);
    expect(feedLevels(rules, 1, 1)).toEqual([]);
  });
});

describe("rankPodium", () => {
  it("shares ranks between tied players and skips the next one", () => {
    const ranked = rankPodium([
      { userId: "c", answers: 12 },
      { userId: "a", answers: 30 },
      { userId: "b", answers: 30 },
      { userId: "d", answers: 0 },
    ]);
    expect(ranked.map((entry) => [entry.userId, entry.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
      ["d", 4],
    ]);
  });
});

describe("crownedPlayers", () => {
  it("crowns the first, every tied first, and nobody without an answer", () => {
    expect([
      ...crownedPlayers([
        { userId: "a", answers: 3 },
        { userId: "b", answers: 1 },
      ]),
    ]).toEqual(["a"]);
    expect(
      [
        ...crownedPlayers([
          { userId: "a", answers: 3 },
          { userId: "b", answers: 3 },
        ]),
      ].sort(),
    ).toEqual(["a", "b"]);
    expect(crownedPlayers([{ userId: "a", answers: 0 }]).size).toBe(0);
    expect(crownedPlayers([]).size).toBe(0);
  });
});
