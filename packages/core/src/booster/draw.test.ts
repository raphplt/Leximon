import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import { DRAW_SCHEDULE } from "../rules";
import {
  type CardPool,
  canonicalizePool,
  type DrawRules,
  type DrawSchedule,
  describePool,
  drawBooster,
  drawRulesAt,
} from "./draw";
import { byRarity, isAtLeast, RARITIES, type Rarity } from "./rarity";

const SEED = "00000000000000000000000000002026";

const rules: DrawRules = {
  startsAt: Number.MIN_SAFE_INTEGER,
  cardsPerBooster: 5,
  weights: { common: 6000, uncommon: 2500, rare: 1000, precious: 400, epic: 90, legendary: 10 },
  guaranteedMinRarity: "uncommon",
  pity: [
    { minRarity: "epic", afterBoosters: 40 },
    { minRarity: "legendary", afterBoosters: 150 },
  ],
};

/** Three cards per rarity, named after their rarity. */
const fullPool = byRarity((rarity) => [1, 2, 3].map((n) => `${rarity}-${n}`));

const poolWith = (overrides: Partial<Record<Rarity, string[]>>): CardPool => ({
  ...fullPool,
  ...overrides,
});

describe("drawBooster", () => {
  it("draws the configured number of cards from the pool", () => {
    const { cards } = drawBooster(rules, fullPool, {}, createSeededRandom(SEED));
    expect(cards).toHaveLength(5);
    for (const card of cards) {
      expect(fullPool[card.rarity]).toContain(card.cardId);
    }
  });

  it("gives the same booster for the same seed", () => {
    const first = drawBooster(rules, fullPool, { epic: 3 }, createSeededRandom(SEED));
    const second = drawBooster(rules, fullPool, { epic: 3 }, createSeededRandom(SEED));
    expect(second).toEqual(first);
  });

  it("always includes a card of the guaranteed rarity or better", () => {
    const random = createSeededRandom(SEED);
    for (let i = 0; i < 5_000; i++) {
      const { cards } = drawBooster(rules, fullPool, {}, random);
      expect(cards.some((card) => isAtLeast(card.rarity, "uncommon"))).toBe(true);
    }
  });

  it("forces the guaranteed rarity when its guarantee is due, then resets its counter", () => {
    const random = createSeededRandom(SEED);
    for (let i = 0; i < 2_000; i++) {
      const draw = drawBooster(rules, fullPool, { epic: 39, legendary: 10 }, random);
      expect(draw.cards.some((card) => isAtLeast(card.rarity, "epic"))).toBe(true);
      expect(draw.pityCounters.epic).toBe(0);
    }
  });

  it("forces the rarest guarantee when several are due, which meets them all", () => {
    const random = createSeededRandom(SEED);
    for (let i = 0; i < 500; i++) {
      const draw = drawBooster(rules, fullPool, { epic: 39, legendary: 149 }, random);
      expect(draw.cards.some((card) => card.rarity === "legendary")).toBe(true);
      expect(draw.pityCounters).toEqual({ epic: 0, legendary: 0 });
    }
  });

  it("increments each counter when its rarity is not drawn", () => {
    const noTopCards = poolWith({ epic: [], legendary: [] });
    const draw = drawBooster(
      rules,
      noTopCards,
      { epic: 4, legendary: 7 },
      createSeededRandom(SEED),
    );
    expect(draw.pityCounters).toEqual({ epic: 5, legendary: 8 });
  });

  it("drops counters of guarantees that are no longer in the rules", () => {
    const draw = drawBooster(rules, fullPool, { precious: 6 }, createSeededRandom(SEED));
    expect(Object.keys(draw.pityCounters).sort()).toEqual(["epic", "legendary"]);
  });

  it("falls back to the nearest more common rarity when one has no cards", () => {
    const allPrecious: DrawRules = {
      ...rules,
      weights: { common: 0, uncommon: 0, rare: 0, precious: 1, epic: 0, legendary: 0 },
    };
    const { cards } = drawBooster(
      allPrecious,
      poolWith({ precious: [], rare: ["rare-1", "rare-2", "rare-3", "rare-4", "rare-5"] }),
      {},
      createSeededRandom(SEED),
    );
    expect(cards.every((card) => card.rarity === "rare")).toBe(true);
  });

  it("falls back to a rarer rarity when no more common one has cards", () => {
    const onlyCommon: DrawRules = {
      ...rules,
      weights: { common: 1, uncommon: 0, rare: 0, precious: 0, epic: 0, legendary: 0 },
      guaranteedMinRarity: "common",
    };
    const { cards } = drawBooster(
      onlyCommon,
      poolWith({
        common: [],
        uncommon: [],
        rare: ["rare-1", "rare-2", "rare-3", "rare-4", "rare-5"],
      }),
      {},
      createSeededRandom(SEED),
    );
    expect(cards.every((card) => card.rarity === "rare")).toBe(true);
  });

  it("never puts the same card twice in a booster", () => {
    const random = createSeededRandom(SEED);
    for (let n = 0; n < 2000; n++) {
      const { cards } = drawBooster(rules, fullPool, {}, random);
      expect(new Set(cards.map((card) => card.cardId)).size).toBe(cards.length);
    }
  });

  it("falls back to another rarity once the booster holds every card of the drawn one", () => {
    const allCommon: DrawRules = {
      ...rules,
      weights: { common: 1, uncommon: 0, rare: 0, precious: 0, epic: 0, legendary: 0 },
      guaranteedMinRarity: "common",
    };
    const { cards } = drawBooster(allCommon, fullPool, {}, createSeededRandom(SEED));
    expect(cards.map((card) => card.rarity)).toEqual([
      "common",
      "common",
      "common",
      "uncommon",
      "uncommon",
    ]);
  });

  it("repeats cards only when the pool is smaller than a booster", () => {
    const tinyPool = byRarity((rarity) =>
      rarity === "uncommon" ? ["uncommon-1", "uncommon-2"] : [],
    );
    const { cards } = drawBooster(rules, tinyPool, {}, createSeededRandom(SEED));
    expect(cards).toHaveLength(5);
    expect(new Set(cards.map((card) => card.cardId))).toEqual(
      new Set(["uncommon-1", "uncommon-2"]),
    );
  });

  it.each<[string, DrawRules]>([
    ["no card per booster", { ...rules, cardsPerBooster: 0 }],
    ["fractional weight", { ...rules, weights: { ...rules.weights, rare: 1.5 } }],
    ["negative weight", { ...rules, weights: { ...rules.weights, rare: -1 } }],
    [
      "all weights at zero",
      {
        ...rules,
        weights: { common: 0, uncommon: 0, rare: 0, precious: 0, epic: 0, legendary: 0 },
      },
    ],
    [
      "guarantee after zero boosters",
      { ...rules, pity: [{ minRarity: "epic", afterBoosters: 0 }] },
    ],
    [
      "two guarantees for one rarity",
      {
        ...rules,
        pity: [
          { minRarity: "epic", afterBoosters: 10 },
          { minRarity: "epic", afterBoosters: 20 },
        ],
      },
    ],
  ])("rejects invalid rules: %s", (_label, badRules) => {
    expect(() => drawBooster(badRules, fullPool, {}, createSeededRandom(SEED))).toThrow(RangeError);
  });

  it("rejects an empty pool", () => {
    const empty = byRarity((): string[] => []);
    expect(() => drawBooster(rules, empty, {}, createSeededRandom(SEED))).toThrow(RangeError);
  });

  it("rejects a negative pity counter", () => {
    expect(() => drawBooster(rules, fullPool, { epic: -1 }, createSeededRandom(SEED))).toThrow(
      RangeError,
    );
  });
});

describe("drawBooster statistics", () => {
  const BOOSTERS = 100_000;
  /** Enough cards per rarity that no booster runs out of one, which would skew the counts. */
  const largePool = byRarity((rarity) => Array.from({ length: 20 }, (_, n) => `${rarity}-${n}`));

  it("follows the weights on regular cards", () => {
    const random = createSeededRandom(SEED);
    const counts = byRarity(() => 0);
    let regularCards = 0;
    for (let i = 0; i < BOOSTERS; i++) {
      // Counters at 0: no guarantee triggers, only the last slot is constrained.
      const { cards } = drawBooster(rules, largePool, {}, random);
      for (const card of cards.slice(0, -1)) {
        counts[card.rarity]++;
        regularCards++;
      }
    }

    for (const rarity of RARITIES) {
      const p = rules.weights[rarity] / 10_000;
      const expected = regularCards * p;
      const sigma = Math.sqrt(regularCards * p * (1 - p));
      expect(Math.abs(counts[rarity] - expected)).toBeLessThan(5 * sigma);
    }
  });

  it("never exceeds the guaranteed number of boosters without each rarity", () => {
    const random = createSeededRandom(SEED);
    let counters = {};
    const drought = { epic: 0, legendary: 0 };
    const longest = { epic: 0, legendary: 0 };
    for (let i = 0; i < BOOSTERS; i++) {
      const draw = drawBooster(rules, largePool, counters, random);
      counters = draw.pityCounters;
      for (const rarity of ["epic", "legendary"] as const) {
        drought[rarity] = draw.cards.some((card) => isAtLeast(card.rarity, rarity))
          ? 0
          : drought[rarity] + 1;
        longest[rarity] = Math.max(longest[rarity], drought[rarity]);
      }
    }
    expect(longest.epic).toBeLessThanOrEqual(39);
    expect(longest.legendary).toBeLessThanOrEqual(149);
  });
});

describe("drawRulesAt", () => {
  const later: DrawRules = { ...rules, startsAt: 1_000, cardsPerBooster: 6 };
  const schedule: DrawSchedule = [rules, later];

  it("returns the rules in force at a given time", () => {
    expect(drawRulesAt(schedule, 999)).toBe(rules);
    expect(drawRulesAt(schedule, 1_000)).toBe(later);
    expect(drawRulesAt(schedule, 5_000)).toBe(later);
  });

  it("applies the first rules to any earlier time", () => {
    expect(drawRulesAt([later], 0)).toBe(later);
  });
});

describe("launch draw rules", () => {
  it("sum the weights to 10,000 so they read as exact percentages", () => {
    for (const period of DRAW_SCHEDULE) {
      const total = RARITIES.reduce((sum, rarity) => sum + period.weights[rarity], 0);
      expect(total).toBe(10_000);
    }
  });

  it("are valid and usable", () => {
    for (const period of DRAW_SCHEDULE) {
      expect(() => drawBooster(period, fullPool, {}, createSeededRandom(SEED))).not.toThrow();
    }
  });
});

describe("canonical pools", () => {
  it("give the same booster whatever the original order of the cards", () => {
    const shuffled = byRarity((rarity) => [...fullPool[rarity]].reverse());
    const fromShuffled = drawBooster(
      rules,
      canonicalizePool(shuffled),
      {},
      createSeededRandom(SEED),
    );
    const fromSorted = drawBooster(rules, canonicalizePool(fullPool), {}, createSeededRandom(SEED));
    expect(fromShuffled).toEqual(fromSorted);
  });

  it("drop duplicate ids", () => {
    const withDuplicates = poolWith({ rare: ["rare-2", "rare-1", "rare-2"] });
    expect(canonicalizePool(withDuplicates).rare).toEqual(["rare-1", "rare-2"]);
  });

  it("sort independently of the locale", () => {
    const pool = canonicalizePool(poolWith({ common: ["é", "z", "E", "a"] }));
    expect(pool.common).toEqual(["E", "a", "z", "é"]);
  });

  it("have a stable description, the input of the fingerprint", () => {
    const description = describePool(canonicalizePool(fullPool));
    expect(
      describePool(canonicalizePool(byRarity((rarity) => [...fullPool[rarity]].reverse()))),
    ).toBe(description);
    expect(JSON.parse(description)[0]).toEqual(["common", ["common-1", "common-2", "common-3"]]);
  });
});
