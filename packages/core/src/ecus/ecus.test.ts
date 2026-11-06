import { describe, expect, it } from "vitest";
import { RARITIES } from "../booster/rarity";
import { createSeededRandom } from "../random";
import { ECU_SCHEDULE } from "../rules";
import {
  drawMissingWord,
  ecuRulesAt,
  perfectStartEcus,
  recycleChoice,
  recycleOne,
  recyclePlan,
} from "./ecus";

const rules = ecuRulesAt(ECU_SCHEDULE, Date.UTC(2026, 10, 10));

describe("recyclePlan", () => {
  it("keeps the card and one double, and recycles the copies beyond", () => {
    const plan = recyclePlan(rules, [
      { cardId: "b-rare", rarity: "rare", quantity: 5 },
      { cardId: "a-common", rarity: "common", quantity: 4 },
      { cardId: "c-common", rarity: "common", quantity: 2 },
      { cardId: "d-precious", rarity: "precious", quantity: 3 },
    ]);
    expect(plan.cards).toEqual([
      { cardId: "a-common", copies: 2, ecus: 2 },
      { cardId: "b-rare", copies: 3, ecus: 15 },
      { cardId: "d-precious", copies: 1, ecus: 15 },
    ]);
    expect(plan).toMatchObject({ copies: 6, ecus: 32 });
  });

  it("never touches an Épique or a Légendaire", () => {
    const plan = recyclePlan(rules, [
      { cardId: "epic", rarity: "epic", quantity: 6 },
      { cardId: "legendary", rarity: "legendary", quantity: 3 },
    ]);
    expect(plan).toEqual({ cards: [], copies: 0, ecus: 0 });
  });
});

describe("recycleOne", () => {
  it("recycles one copy of any rarity, the last double included, never the last copy", () => {
    expect(recycleOne(rules, { cardId: "epic", rarity: "epic", quantity: 2 })).toEqual({
      cardId: "epic",
      copies: 1,
      ecus: 50,
    });
    expect(recycleOne(rules, { cardId: "legendary", rarity: "legendary", quantity: 1 })).toBeNull();
  });
});

describe("recycleChoice", () => {
  const holdings = [
    { cardId: "b-epic", rarity: "epic", quantity: 2 },
    { cardId: "a-common", rarity: "common", quantity: 4 },
    { cardId: "c-rare", rarity: "rare", quantity: 1 },
  ] as const;

  it("recycles the copies picked, any rarity, by card id", () => {
    expect(
      recycleChoice(rules, holdings, [
        { cardId: "b-epic", copies: 1 },
        { cardId: "a-common", copies: 3 },
      ]),
    ).toEqual({
      cards: [
        { cardId: "a-common", copies: 3, ecus: 3 },
        { cardId: "b-epic", copies: 1, ecus: 50 },
      ],
      copies: 4,
      ecus: 53,
    });
  });

  it("never takes a card's last copy, nor a card the player no longer holds", () => {
    expect(
      recycleChoice(rules, holdings, [
        { cardId: "a-common", copies: 9 },
        { cardId: "c-rare", copies: 1 },
        { cardId: "gone", copies: 2 },
      ]),
    ).toEqual({ cards: [{ cardId: "a-common", copies: 3, ecus: 3 }], copies: 3, ecus: 3 });
  });
});

describe("the prices in force", () => {
  it("sell a missing word eight times what recycling its rarity gives", () => {
    for (const rarity of RARITIES) {
      expect(rules.missingWordPrice[rarity]).toBe(8 * rules.recycleValue[rarity]);
    }
  });
});

describe("drawMissingWord", () => {
  it("draws among the candidates only, each about as often", () => {
    const random = createSeededRandom("0123456789abcdef0123456789abcdef");
    const counts = new Map<string, number>();
    for (let i = 0; i < 3_000; i++) {
      const word = drawMissingWord(["a", "b", "c"], random) ?? "none";
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(["a", "b", "c"]);
    for (const count of counts.values()) expect(Math.abs(count - 1_000)).toBeLessThan(100);
  });

  it("draws nothing when no word is missing", () => {
    const random = createSeededRandom("0123456789abcdef0123456789abcdef");
    expect(drawMissingWord([], random)).toBeNull();
  });
});

describe("perfectStartEcus", () => {
  it("gives écus to the answer that makes the day's first five all right", () => {
    expect(perfectStartEcus(rules, { answers: 5, correct: 5 })).toBe(5);
  });

  it("gives nothing before, after, or with a mistake among them", () => {
    expect(perfectStartEcus(rules, { answers: 4, correct: 4 })).toBe(0);
    expect(perfectStartEcus(rules, { answers: 6, correct: 6 })).toBe(0);
    expect(perfectStartEcus(rules, { answers: 5, correct: 4 })).toBe(0);
  });
});
