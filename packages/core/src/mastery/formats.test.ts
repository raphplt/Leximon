import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import { PRACTICE_SCHEDULE } from "../rules";
import { gradeLetters, otherChoiceFormat } from "./challenge";
import {
  type AskedFormat,
  canSpellWithTiles,
  closeChoicePool,
  endsWithPairs,
  letterTiles,
  pairsCards,
  pickFormat,
} from "./formats";
import { practiceRulesAt } from "./practice";

const rules = practiceRulesAt(PRACTICE_SCHEDULE, Date.UTC(2026, 10, 5));
const seeded = () => createSeededRandom("0123456789abcdef0123456789abcdef");
const ALL = { listen: true, letters: true, difficulty: "normal" } as const;

function draws(
  word: Parameters<typeof pickFormat>[2],
  choices: Parameters<typeof pickFormat>[3],
  count = 400,
): Map<AskedFormat, number> {
  const random = seeded();
  const seen = new Map<AskedFormat, number>();
  for (let i = 0; i < count; i++) {
    const format = pickFormat(random, rules, word, choices);
    seen.set(format, (seen.get(format) ?? 0) + 1);
  }
  return seen;
}

describe("pickFormat", () => {
  const plain = { counted: true, fresh: false, rising: false, spellable: true };

  it("asks a word that can rise typed, and a new word its definition", () => {
    expect([...draws({ ...plain, rising: true }, ALL).keys()]).toEqual(["typed"]);
    expect([...draws({ ...plain, fresh: true }, ALL).keys()]).toEqual(["definition"]);
  });

  it("draws among the formats kept, about evenly", () => {
    const seen = draws(plain, ALL);
    expect([...seen.keys()].sort()).toEqual(["definition", "letters", "listen", "word"]);
    for (const count of seen.values()) expect(count).toBeGreaterThan(70);
    const plainOnly = draws(plain, { listen: false, letters: false, difficulty: "normal" });
    expect([...plainOnly.keys()].sort()).toEqual(["definition", "word"]);
    const noTiles = draws({ ...plain, spellable: false }, ALL);
    expect(noTiles.has("letters")).toBe(false);
  });

  it("spells out often in demanding practice, never in a review that counts", () => {
    const hard = { ...ALL, difficulty: "hard" } as const;
    const practice = draws({ ...plain, counted: false }, hard);
    const spelled = (practice.get("typed") ?? 0) + (practice.get("letters") ?? 0);
    expect(spelled).toBeGreaterThan(220);
    expect(draws(plain, hard).get("typed")).toBeUndefined();
  });
});

describe("letters", () => {
  it("rebuilds plain words of 4 to 12 letters", () => {
    expect(canSpellWithTiles(rules, "équanimité")).toBe(true);
    expect(canSpellWithTiles(rules, "vit")).toBe(false);
    expect(canSpellWithTiles(rules, "arc-en-ciel")).toBe(false);
    expect(canSpellWithTiles(rules, "à la fortune du pot")).toBe(false);
    expect(canSpellWithTiles(rules, "anticonstitution")).toBe(false);
  });

  it("gives every letter plus the decoys, never in order", () => {
    const tiles = letterTiles(seeded(), rules, "Introït");
    expect(tiles).toHaveLength(9);
    for (const letter of "introït") expect(tiles).toContain(letter);
    expect(tiles.slice(0, 7).join("")).not.toBe("introït");
  });

  it("grades the word rebuilt without slips, accents aside", () => {
    expect(gradeLetters("introit", "introït")).toBe("good");
    expect(gradeLetters("intorït", "introït")).toBe("again");
  });

  it("asks a heard word again as its word to find", () => {
    expect(otherChoiceFormat("listen")).toBe("word");
    expect(otherChoiceFormat("letters")).toBe("definition");
  });
});

describe("close choices", () => {
  const initialOf = (id: string) => id.slice(0, 1);

  it("prefers the same theme and initial, then the theme, then the collection", () => {
    const theme = ["ba", "bb", "bc", "bd", "ca"];
    expect(closeChoicePool("bz", initialOf, theme, ["x"], 3)).toEqual(["ba", "bb", "bc", "bd"]);
    expect(closeChoicePool("cz", initialOf, theme, ["x"], 3)).toEqual(theme);
    expect(closeChoicePool("cz", initialOf, ["ca"], ["x", "y", "z"], 3)).toEqual(["x", "y", "z"]);
  });
});

describe("pairs", () => {
  it("takes the word and three others", () => {
    const cards = pairsCards(seeded(), rules, "a", ["a", "b", "c", "d", "e"]);
    expect(cards).toHaveLength(4);
    expect(cards?.[0]).toBe("a");
    expect(new Set(cards).size).toBe(4);
    expect(pairsCards(seeded(), rules, "a", ["a", "b", "c"])).toBeNull();
  });

  it("ends a series of five or more on practice", () => {
    const series = (counted: boolean[]) => counted.map((c) => ({ counted: c }));
    expect(endsWithPairs(rules, series([true, true, false, false, false]))).toBe(true);
    expect(endsWithPairs(rules, series([false, false, false, false, true]))).toBe(false);
    expect(endsWithPairs(rules, series([false, false, false, false]))).toBe(false);
  });
});
