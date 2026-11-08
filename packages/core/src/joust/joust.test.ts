import { describe, expect, it } from "vitest";
import type { Rarity } from "../booster/rarity";
import type { WordClass } from "../mastery/challenge";
import { createSeededRandom } from "../random";
import { JOUST_SCHEDULE } from "../rules";
import {
  answerInTime,
  type ChoiceCard,
  composeDeck,
  type DeckCandidate,
  deckCost,
  deckProblem,
  joustChoices,
  joustOutcome,
  joustRulesAt,
  playedXp,
  runOver,
  runScore,
  trappedCards,
  winReward,
  wishedCards,
} from "./joust";

const rules = joustRulesAt(JOUST_SCHEDULE, Date.UTC(2026, 10, 10));
const seed = (n: number) => createSeededRandom(n.toString(16).padStart(32, "0"));

function candidate(id: string, rarity: Rarity, level: DeckCandidate["level"] = "sketch") {
  return { cardId: id, rarity, level } as const;
}

const commons = Array.from({ length: 12 }, (_, i) => candidate(`c${i}`, "common"));

describe("the deck", () => {
  it("costs the points of its rarities", () => {
    expect(deckCost(rules, ["common", "rare", "legendary"])).toBe(10);
  });

  it("says what keeps a deck from being saved", () => {
    const ids = commons.slice(0, 10).map((c) => c.cardId);
    expect(deckProblem(rules, ids, commons)).toBeNull();
    expect(deckProblem(rules, ids.slice(0, 4), commons)).toBe("too_few");
    expect(deckProblem(rules, commons.map((c) => c.cardId).slice(0, 11), commons)).toBe("too_many");
    expect(deckProblem(rules, [...ids.slice(0, 9), "c0"], commons)).toBe("duplicate");
    expect(deckProblem(rules, [...ids.slice(0, 9), "unknown"], commons)).toBe("not_eligible");
    const blank = [...commons.slice(0, 9), candidate("b", "common", "blank")];
    expect(
      deckProblem(
        rules,
        blank.map((c) => c.cardId),
        blank,
      ),
    ).toBe("not_eligible");
    const rich = [
      ...["l1", "l2", "l3", "l4"].map((id) => candidate(id, "legendary")),
      ...commons.slice(0, 6),
    ];
    expect(
      deckProblem(
        rules,
        rich.map((c) => c.cardId),
        rich,
      ),
    ).toBe("over_budget");
  });

  it("makes a full deck of the rarest words the budget allows", () => {
    const pool = [
      ...commons,
      candidate("l1", "legendary"),
      candidate("e1", "epic"),
      candidate("r1", "rare"),
      candidate("r2", "rare"),
      candidate("x", "legendary", "blank"),
    ];
    const deck = composeDeck(rules, pool);
    expect(deck).toHaveLength(10);
    expect(deck).not.toContain("x");
    expect(deckProblem(rules, deck, pool)).toBeNull();
    const spent = deckCost(
      rules,
      deck.map((id) => pool.find((c) => c.cardId === id)?.rarity ?? "common"),
    );
    expect(spent).toBeGreaterThan(20);
    expect(spent).toBeLessThanOrEqual(25);
    expect(deck).toContain("l1");
  });

  it("keeps the cards the player chose while they can stay, and fills the rest", () => {
    const pool = [...commons, candidate("r1", "rare")];
    const deck = composeDeck(rules, pool, ["r1", "gone", "c3"]);
    expect(deck.slice(0, 2)).toEqual(["r1", "c3"]);
    expect(deck).toHaveLength(10);
    expect(deck).not.toContain("gone");
  });

  it("holds what it can when the player has few words", () => {
    expect(composeDeck(rules, commons.slice(0, 3))).toHaveLength(3);
    expect(composeDeck(rules, [])).toEqual([]);
  });
});

describe("joustChoices", () => {
  const card = (
    id: string,
    collectionId: string,
    rarity: Rarity,
    wordClass: WordClass = "noun",
  ): ChoiceCard => ({ id, collectionId, rarity, wordClass });
  const answer = card("a", "fondateurs", "rare");

  it("offers the right word among words of the same collection and rarity", () => {
    const catalogue = [
      answer,
      ...["b", "c", "d", "e"].map((id) => card(id, "fondateurs", "rare")),
      card("f", "fondateurs", "common"),
      card("g", "bestiaire", "rare"),
    ];
    for (let n = 0; n < 20; n++) {
      const choices = joustChoices(rules, seed(n), answer, catalogue);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain("a");
      expect(choices.every((id) => ["a", "b", "c", "d", "e"].includes(id))).toBe(true);
    }
  });

  it("takes the same collection at the nearest rarity, then another collection", () => {
    const catalogue = [
      answer,
      card("b", "fondateurs", "rare"),
      card("c", "fondateurs", "precious"),
      card("d", "fondateurs", "legendary"),
      card("e", "bestiaire", "rare"),
    ];
    const choices = joustChoices(rules, seed(1), answer, catalogue);
    expect([...choices].sort()).toEqual(["a", "b", "c", "d"]);
    const small = catalogue.filter((c) => c.id !== "d");
    expect([...joustChoices(rules, seed(1), answer, small)].sort()).toEqual(["a", "b", "c", "e"]);
  });

  it("keeps to the word's class before its collection and rarity", () => {
    const verb = card("a", "fondateurs", "rare", "verb");
    const catalogue = [
      verb,
      ...["b", "c", "d"].map((id) => card(id, "fondateurs", "rare")),
      card("e", "fondateurs", "common", "verb"),
      card("f", "bestiaire", "legendary", "verb"),
      card("g", "bestiaire", "rare", "verb"),
    ];
    for (let n = 0; n < 20; n++) {
      const choices = joustChoices(rules, seed(n), verb, catalogue);
      expect([...choices].sort()).toEqual(["a", "e", "f", "g"]);
    }
    const twoVerbs = catalogue.filter((c) => c.id !== "f" && c.id !== "g");
    expect(joustChoices(rules, seed(1), verb, twoVerbs)).toContain("e");
  });

  it("puts the right word anywhere among the choices", () => {
    const catalogue = [answer, ...["b", "c", "d"].map((id) => card(id, "fondateurs", "rare"))];
    const places = new Set(
      Array.from({ length: 40 }, (_, n) => joustChoices(rules, seed(n), answer, catalogue)).map(
        (choices) => choices.indexOf("a"),
      ),
    );
    expect(places.size).toBe(4);
  });
});

describe("the run", () => {
  const at = (servedAt: number | null, answeredAt: number | null, correct = true) => ({
    servedAt,
    answeredAt,
    correct,
  });

  it("refuses an answer past the clock and its allowance", () => {
    expect(answerInTime(rules, 0, 16_999)).toBe(true);
    expect(answerInTime(rules, 0, 17_001)).toBe(false);
  });

  it("counts right answers and time, a question left on full time", () => {
    const score = runScore(rules, [
      at(0, 3_000),
      at(10_000, 14_000, false),
      at(20_000, 40_000),
      at(50_000, null),
      at(null, null),
    ]);
    expect(score).toEqual({ correct: 2, ms: 3_000 + 4_000 + 15_000 + 15_000 + 15_000 });
  });

  it("ends when every question is answered or past its clock, or when its time is gone", () => {
    const started = [at(0, 2_000), at(null, null)];
    expect(runOver(rules, started, 0, 60_000)).toBe(false);
    expect(runOver(rules, started, 0, rules.runMs)).toBe(true);
    expect(runOver(rules, [at(null, null)], null, 10 ** 9)).toBe(false);
    expect(runOver(rules, [at(0, 1), at(5, 6)], 0, 10)).toBe(true);
    // A question left past its clock is closed too.
    expect(runOver(rules, [at(0, 2_000), at(3_000, null)], 0, 10_000)).toBe(false);
    expect(runOver(rules, [at(0, 2_000), at(3_000, null)], 0, 3_000 + 17_001)).toBe(true);
  });
});

describe("joustOutcome", () => {
  it("gives the joust to the most right answers, then to the fastest", () => {
    expect(joustOutcome({ correct: 4, ms: 50_000 }, { correct: 3, ms: 9_000 })).toBe("challenger");
    expect(joustOutcome({ correct: 3, ms: 31_000 }, { correct: 3, ms: 30_000 })).toBe("opponent");
    expect(joustOutcome({ correct: 3, ms: 30_000 }, { correct: 3, ms: 30_000 })).toBe("draw");
  });
});

describe("rewards", () => {
  it("gives XP for each joust played, up to the day's count", () => {
    expect(playedXp(rules, 0)).toBe(20);
    expect(playedXp(rules, 4)).toBe(20);
    expect(playedXp(rules, 5)).toBe(0);
  });

  it("gives a sachet for the first win of the day only, and nothing past the day's count", () => {
    expect(winReward(rules, { rewarded: true, wonToday: 0 })).toEqual({ xp: 20, boosters: 1 });
    expect(winReward(rules, { rewarded: true, wonToday: 1 })).toEqual({ xp: 20, boosters: 0 });
    expect(winReward(rules, { rewarded: false, wonToday: 0 })).toEqual({ xp: 0, boosters: 0 });
  });
});

describe("traps and wishes", () => {
  it("count the cards a played run did not find, once each", () => {
    const run = [
      { cardId: "a", correct: true },
      { cardId: "b", correct: false },
      { cardId: "c", correct: false },
      { cardId: "b", correct: false },
    ];
    expect(trappedCards(run, true)).toEqual(["b", "c"]);
    expect(trappedCards(run, false)).toEqual([]);
  });

  it("wish only the words the player does not own", () => {
    expect(wishedCards(["a", "b", "c", "a"], new Set(["b"]))).toEqual(["a", "c"]);
    expect(wishedCards(["b"], new Set(["b"]))).toEqual([]);
  });
});
