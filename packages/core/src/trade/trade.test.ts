import { describe, expect, it } from "vitest";
import {
  checkOffer,
  checkOfferShape,
  type Holding,
  isExpired,
  isTradeable,
  type OfferCheck,
  type TradeRules,
  tradeRulesAt,
} from "./trade";

const DAY = 86_400_000;
const NOW = 100 * DAY;
const rules: TradeRules = {
  startsAt: 0,
  offerTtlMs: 3 * DAY,
  maxCardsPerSide: 3,
  offersPerDay: 10,
  minAccountAgeMs: 3 * DAY,
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

describe("checkOfferShape", () => {
  it("needs one to three distinct cards on each side", () => {
    expect(checkOfferShape(rules, [], ["b"])).toBe("empty_side");
    expect(checkOfferShape(rules, ["a", "b", "c", "d"], ["e"])).toBe("too_many_cards");
    expect(checkOfferShape(rules, ["a", "a"], ["b"])).toBe("duplicate_card");
    expect(checkOfferShape(rules, ["a", "b", "c"], ["d", "e", "f"])).toBeNull();
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
