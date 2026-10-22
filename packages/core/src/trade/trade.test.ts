import { describe, expect, it } from "vitest";
import {
  checkOffer,
  checkOfferShape,
  type Holding,
  isExpired,
  isTradeable,
  maxCardsBetween,
  maxCardsPerSide,
  type OfferCheck,
  type TradeRules,
  tradeableFrom,
  tradeRulesAt,
} from "./trade";

/** Total XP at the start of level 10 (level curve). */
const LEVEL_10_XP = 1620;

const DAY = 86_400_000;
const NOW = 100 * DAY;
const rules: TradeRules = {
  startsAt: 0,
  offerTtlMs: 3 * DAY,
  cardsPerSide: [
    { fromLevel: 5, maxCards: 1 },
    { fromLevel: 10, maxCards: 3 },
  ],
  offersPerDay: 10,
  minAccountAgeMs: 3 * DAY,
  minLevel: 5,
  heldRarity: "epic",
  heldForMs: 7 * DAY,
};

function holding(cardId: string, quantity: number, overrides: Partial<Holding> = {}): Holding {
  return { cardId, rarity: "common", quantity, lastObtainedAt: 0, ...overrides };
}

function offer(overrides: Partial<OfferCheck> = {}): OfferCheck {
  return {
    rules,
    proposerId: "alice",
    recipientId: "bob",
    give: ["a"],
    want: ["b"],
    proposerCreatedAt: 0,
    recipientCreatedAt: 0,
    // Level 5 exactly (100 + 120 + 140 + 160).
    proposerXp: 520,
    recipientXp: 520,
    offersSentToday: 0,
    proposerHoldings: new Map([["a", holding("a", 2)]]),
    recipientHoldings: new Map([["b", holding("b", 3)]]),
    now: NOW,
    ...overrides,
  };
}

describe("isTradeable", () => {
  it("only lets duplicates go", () => {
    expect(isTradeable(rules, holding("a", 1), NOW)).toBe(false);
    expect(isTradeable(rules, holding("a", 2), NOW)).toBe(true);
  });

  it("holds rare cards for a while after the last copy was obtained", () => {
    const epic = holding("e", 2, { rarity: "epic", lastObtainedAt: NOW - 7 * DAY + 1 });
    expect(isTradeable(rules, epic, NOW)).toBe(false);
    expect(isTradeable(rules, { ...epic, lastObtainedAt: NOW - 7 * DAY }, NOW)).toBe(true);
    const legendary = holding("l", 2, { rarity: "legendary", lastObtainedAt: NOW - DAY });
    expect(isTradeable(rules, legendary, NOW)).toBe(false);
    const precious = holding("p", 2, { rarity: "precious", lastObtainedAt: NOW });
    expect(isTradeable(rules, precious, NOW)).toBe(true);
  });
});

describe("tradeableFrom", () => {
  it("is now for common cards and after the wait for rare ones", () => {
    expect(tradeableFrom(rules, holding("a", 2))).toBeLessThan(NOW);
    expect(tradeableFrom(rules, holding("e", 2, { rarity: "epic", lastObtainedAt: NOW }))).toBe(
      NOW + 7 * DAY,
    );
  });
});

describe("checkOfferShape", () => {
  it("needs one to the allowed number of distinct cards on each side", () => {
    expect(checkOfferShape([], ["b"], 3)).toBe("empty_side");
    expect(checkOfferShape(["a", "b", "c", "d"], ["e"], 3)).toBe("too_many_cards");
    expect(checkOfferShape(["a", "b"], ["c"], 1)).toBe("too_many_cards");
    expect(checkOfferShape(["a", "a"], ["b"], 3)).toBe("duplicate_card");
    expect(checkOfferShape(["a", "b", "c"], ["d", "e", "f"], 3)).toBeNull();
  });
});

describe("cards per side", () => {
  it("allows one card from the trade level and three from level 10", () => {
    expect(maxCardsPerSide(rules, 4)).toBe(0);
    expect(maxCardsPerSide(rules, 5)).toBe(1);
    expect(maxCardsPerSide(rules, 9)).toBe(1);
    expect(maxCardsPerSide(rules, 10)).toBe(3);
    expect(maxCardsPerSide(rules, 40)).toBe(3);
  });

  it("follows the lower level of the two players", () => {
    expect(maxCardsBetween(rules, LEVEL_10_XP, LEVEL_10_XP)).toBe(3);
    expect(maxCardsBetween(rules, LEVEL_10_XP, 520)).toBe(1);
    expect(maxCardsBetween(rules, 520, LEVEL_10_XP)).toBe(1);
  });
});

describe("checkOffer", () => {
  it("accepts a fair offer between established players", () => {
    expect(checkOffer(offer())).toBeNull();
  });

  it("refuses trading with oneself", () => {
    expect(checkOffer(offer({ recipientId: "alice" }))).toBe("self_trade");
  });

  it("refuses recent accounts on either side", () => {
    expect(checkOffer(offer({ proposerCreatedAt: NOW - DAY }))).toBe("account_too_recent");
    expect(checkOffer(offer({ recipientCreatedAt: NOW - DAY }))).toBe("account_too_recent");
  });

  it("refuses players below the minimum level on either side", () => {
    expect(checkOffer(offer({ proposerXp: 519 }))).toBe("level_too_low");
    expect(checkOffer(offer({ recipientXp: 0 }))).toBe("level_too_low");
  });

  it("refuses more cards than the lower level allows", () => {
    const twoEach = {
      give: ["a", "c"],
      want: ["b", "d"],
      proposerHoldings: new Map([
        ["a", holding("a", 2)],
        ["c", holding("c", 2)],
      ]),
      recipientHoldings: new Map([
        ["b", holding("b", 2)],
        ["d", holding("d", 2)],
      ]),
    };
    expect(checkOffer(offer(twoEach))).toBe("too_many_cards");
    expect(checkOffer(offer({ ...twoEach, proposerXp: LEVEL_10_XP }))).toBe("too_many_cards");
    expect(
      checkOffer(offer({ ...twoEach, proposerXp: LEVEL_10_XP, recipientXp: LEVEL_10_XP })),
    ).toBeNull();
  });

  it("caps the offers sent per day", () => {
    expect(checkOffer(offer({ offersSentToday: 9 }))).toBeNull();
    expect(checkOffer(offer({ offersSentToday: 10 }))).toBe("daily_limit_reached");
  });

  it("refuses cards either side cannot give", () => {
    expect(checkOffer(offer({ give: ["z"] }))).toBe("card_not_tradeable");
    const single = new Map([["b", holding("b", 1)]]);
    expect(checkOffer(offer({ recipientHoldings: single }))).toBe("card_not_tradeable");
  });
});

describe("expiry and dated rules", () => {
  it("expires an offer once its delay has passed", () => {
    expect(isExpired(NOW, NOW - 1)).toBe(false);
    expect(isExpired(NOW, NOW)).toBe(true);
  });

  it("applies the rules in force at the time", () => {
    const later = { ...rules, startsAt: 50, offersPerDay: 5 };
    expect(tradeRulesAt([rules, later], 49)).toBe(rules);
    expect(tradeRulesAt([rules, later], 50)).toBe(later);
  });
});
