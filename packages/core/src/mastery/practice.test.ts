import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import { PRACTICE_SCHEDULE } from "../rules";
import { planPractice, practiceRulesAt, practiceXp } from "./practice";

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
