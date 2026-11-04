import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import { PRACTICE_SCHEDULE } from "../rules";
import {
  planPractice,
  planReview,
  practiceRulesAt,
  practiceXp,
  type ReviewCandidate,
} from "./practice";

const rules = practiceRulesAt(PRACTICE_SCHEDULE, Date.UTC(2026, 9, 30));

describe("planPractice", () => {
  const random = () => createSeededRandom("0123456789abcdef0123456789abcdef");

  it("puts due words first, then words never reviewed", () => {
    const plan = planPractice(random(), ["d1", "d2"], ["n1"], ["o1", "o2"], 4);
    expect(plan.counted).toEqual(["d1", "d2", "n1"]);
    expect(plan.free).toHaveLength(1);
  });

  it("leaves no room for free practice when enough words count", () => {
    const plan = planPractice(random(), ["d1", "d2"], ["n1", "n2"], ["o1"], 3);
    expect(plan.counted).toEqual(["d1", "d2", "n1"]);
    expect(plan.free).toEqual([]);
  });

  it("never repeats a word and stops at the end of the scope", () => {
    const plan = planPractice(random(), [], [], ["o1", "o2", "o3"], 10);
    expect([...plan.free].sort()).toEqual(["o1", "o2", "o3"]);
  });

  it("picks the free words evenly", () => {
    const source = createSeededRandom("fedcba9876543210fedcba9876543210");
    const others = ["a", "b", "c", "d"];
    const seen = new Map<string, number>();
    for (let round = 0; round < 4_000; round++) {
      const [picked] = planPractice(source, [], [], others, 1).free;
      if (picked !== undefined) seen.set(picked, (seen.get(picked) ?? 0) + 1);
    }
    for (const word of others) {
      expect(seen.get(word)).toBeGreaterThan(900);
      expect(seen.get(word)).toBeLessThan(1_100);
    }
  });
});

describe("practiceXp", () => {
  it("gives nothing for a wrong answer", () => {
    expect(practiceXp(rules, { correct: false, earnedToday: 0 })).toBe(0);
  });

  it("gives a right answer its XP until the daily cap", () => {
    expect(practiceXp(rules, { correct: true, earnedToday: 0 })).toBe(rules.xpPerAnswer);
    expect(practiceXp(rules, { correct: true, earnedToday: rules.dailyXpCap })).toBe(0);
  });

  it("never passes the cap, even from a total the cap has since lowered", () => {
    const left = rules.xpPerAnswer - 2;
    expect(practiceXp(rules, { correct: true, earnedToday: rules.dailyXpCap - left })).toBe(left);
    expect(practiceXp(rules, { correct: true, earnedToday: rules.dailyXpCap + 40 })).toBe(0);
  });
});

describe("planReview", () => {
  const review = practiceRulesAt(PRACTICE_SCHEDULE, Date.UTC(2026, 10, 5));
  const random = () => createSeededRandom("0123456789abcdef0123456789abcdef");
  const NOW = 1_000_000;
  const due = (id: string, at: number): ReviewCandidate => ({
    cardId: id,
    due: at,
    obtainedAt: 0,
    recall: 0.5,
  });
  const fresh = (id: string, obtainedAt: number): ReviewCandidate => ({
    cardId: id,
    due: null,
    obtainedAt,
    recall: null,
  });
  const known = (id: string, recall: number): ReviewCandidate => ({
    cardId: id,
    due: NOW + 1_000,
    obtainedAt: 0,
    recall,
  });
  const ids = (items: readonly { cardId: string }[]) => items.map((item) => item.cardId);

  it("asks a new player only new words, the most recent first", () => {
    const candidates = [fresh("a", 1), fresh("b", 3), fresh("c", 2)];
    const plan = planReview(random(), review, { candidates, now: NOW, size: 10, newWordsLeft: 10 });
    expect(ids(plan)).toEqual(["b", "c", "a"]);
    expect(plan.every((item) => item.counted && item.fresh)).toBe(true);
  });

  it("mixes one new word in three while words are due, most overdue first", () => {
    const candidates = [
      ...Array.from({ length: 14 }, (_, i) => due(`d${i}`, NOW - 14 + i)),
      ...Array.from({ length: 8 }, (_, i) => fresh(`n${i}`, i)),
    ];
    const plan = planReview(random(), review, { candidates, now: NOW, size: 10, newWordsLeft: 10 });
    expect(ids(plan)).toEqual(["d0", "d1", "n7", "d2", "d3", "n6", "d4", "d5", "n5", "d6"]);
    expect(plan.every((item) => item.counted)).toBe(true);
  });

  it("fills the series with new words once nothing is due", () => {
    const candidates = [due("d0", NOW), ...Array.from({ length: 5 }, (_, i) => fresh(`n${i}`, i))];
    const plan = planReview(random(), review, { candidates, now: NOW, size: 5, newWordsLeft: 10 });
    expect(ids(plan)).toEqual(["d0", "n4", "n3", "n2", "n1"]);
  });

  it("starts no more new words than the day allows", () => {
    const candidates = Array.from({ length: 6 }, (_, i) => fresh(`n${i}`, i));
    const plan = planReview(random(), review, { candidates, now: NOW, size: 10, newWordsLeft: 2 });
    expect(plan.filter((item) => item.counted).map((item) => item.cardId)).toEqual(["n5", "n4"]);
    expect(plan.filter((item) => !item.counted)).toHaveLength(4);
  });

  it("completes with free practice on the most fragile words", () => {
    const candidates = [
      known("solid", 0.99),
      known("weak", 0.4),
      known("shaky", 0.6),
      fresh("unmet", 0),
    ];
    const plan = planReview(random(), review, { candidates, now: NOW, size: 1, newWordsLeft: 0 });
    expect(plan).toEqual([{ cardId: "weak", counted: false, fresh: false }]);
    const all = planReview(random(), review, { candidates, now: NOW, size: 4, newWordsLeft: 0 });
    expect(all.every((item) => !item.counted)).toBe(true);
    expect([...ids(all)].sort()).toEqual(["shaky", "solid", "unmet", "weak"]);
  });

  it("varies free practice among the fragile words", () => {
    const candidates = Array.from({ length: 30 }, (_, i) => known(`k${i}`, i / 30));
    const source = createSeededRandom("fedcba9876543210fedcba9876543210");
    const seen = new Set<string>();
    for (let round = 0; round < 50; round++) {
      for (const id of ids(
        planReview(source, review, { candidates, now: NOW, size: 3, newWordsLeft: 0 }),
      )) {
        seen.add(id);
      }
    }
    expect(seen.size).toBe(9);
  });

  it("opens with the word the player chose", () => {
    const candidates = [due("d0", NOW - 5), due("d1", NOW - 1), known("k", 0.9)];
    const counted = planReview(random(), review, {
      candidates,
      now: NOW,
      size: 3,
      newWordsLeft: 0,
      first: "d1",
    });
    expect(counted.slice(0, 2)).toEqual([
      { cardId: "d1", counted: true, fresh: false },
      { cardId: "d0", counted: true, fresh: false },
    ]);
    const early = planReview(random(), review, {
      candidates,
      now: NOW,
      size: 3,
      newWordsLeft: 0,
      first: "k",
    });
    expect(early[0]).toEqual({ cardId: "k", counted: false, fresh: false });
  });

  it("never repeats a word", () => {
    const candidates = [due("d0", NOW), fresh("n0", 0), known("k0", 0.2)];
    const plan = planReview(random(), review, {
      candidates,
      now: NOW,
      size: 10,
      newWordsLeft: 10,
      first: "n0",
    });
    expect(new Set(ids(plan)).size).toBe(plan.length);
    expect(plan).toHaveLength(3);
  });
});
