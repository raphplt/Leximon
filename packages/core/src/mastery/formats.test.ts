import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import { PRACTICE_SCHEDULE } from "../rules";
import { otherChoiceFormat } from "./challenge";
import {
  type AskedFormat,
  closeChoicePools,
  endsWithPairs,
  pairsCards,
  pickFormat,
} from "./formats";
import { practiceRulesAt } from "./practice";

const rules = practiceRulesAt(PRACTICE_SCHEDULE, Date.UTC(2026, 10, 5));
const seeded = () => createSeededRandom("0123456789abcdef0123456789abcdef");
const ALL = { listen: true, difficulty: "normal" } as const;

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
  const plain = { counted: true, fresh: false, rising: false };

  it("asks a word that can rise typed, and a new word its definition", () => {
    expect([...draws({ ...plain, rising: true }, ALL).keys()]).toEqual(["typed"]);
    expect([...draws({ ...plain, fresh: true }, ALL).keys()]).toEqual(["definition"]);
  });

  it("draws among the formats kept, about evenly", () => {
    const seen = draws(plain, ALL);
    expect([...seen.keys()].sort()).toEqual(["definition", "listen", "word"]);
    for (const count of seen.values()) expect(count).toBeGreaterThan(100);
    const plainOnly = draws(plain, { listen: false, difficulty: "normal" });
    expect([...plainOnly.keys()].sort()).toEqual(["definition", "word"]);
  });

  it("asks often to type the word in demanding practice, never in a review that counts", () => {
    const hard = { ...ALL, difficulty: "hard" } as const;
    const practice = draws({ ...plain, counted: false }, hard);
    expect(practice.get("typed")).toBeGreaterThan(160);
    expect(draws(plain, hard).get("typed")).toBeUndefined();
  });
});

describe("catch-up", () => {
  it("asks a heard word again as its word to find", () => {
    expect(otherChoiceFormat("listen")).toBe("word");
  });
});

describe("close choices", () => {
  const initialOf = (id: string) => id.slice(0, 1);

  it("prefers the same theme and initial, then the rest of the theme", () => {
    const theme = ["ba", "bb", "bz", "ca"];
    expect(closeChoicePools("bz", initialOf, theme)).toEqual([
      ["ba", "bb"],
      ["ba", "bb", "ca"],
    ]);
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
