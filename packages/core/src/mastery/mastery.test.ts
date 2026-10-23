import { describe, expect, it } from "vitest";
import { MASTERY_SCHEDULE } from "../rules";
import {
  isDue,
  levelFor,
  type MasteryRules,
  masteryRulesAt,
  newWordMastery,
  provenLevel,
  reviewWord,
  type WordMastery,
} from "./mastery";

const DAY = 86_400_000;
const rules: MasteryRules = {
  startsAt: 0,
  requestRetention: 0.9,
  maximumIntervalDays: 365,
  levelThresholdDays: { ink: 7, gilded: 30 },
  levelBy: "stability",
};
const proven: MasteryRules = { ...rules, levelBy: "provenRecall" };

/** Answers right each time the word comes back; returns the mastery after each answer. */
function recallEachTime(times: number, using = rules): WordMastery[] {
  let mastery = newWordMastery(0);
  let now = 0;
  const steps: WordMastery[] = [];
  for (let i = 0; i < times; i++) {
    mastery = reviewWord(using, mastery, true, now).mastery;
    steps.push(mastery);
    now = mastery.memory.due;
  }
  return steps;
}

describe("mastery", () => {
  it("starts a new word as a due sketch", () => {
    const mastery = newWordMastery(1_000);
    expect(mastery.level).toBe("sketch");
    expect(isDue(mastery.memory, 1_000)).toBe(true);
    expect(mastery.memory.reps).toBe(0);
  });

  it("spaces reviews further apart after each recall", () => {
    const intervals = recallEachTime(4).map((m, i, all) =>
      i === 0 ? m.memory.due : m.memory.due - (all[i - 1]?.memory.due ?? 0),
    );
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1] ?? 0);
    }
    // A forgotten word never comes back within the same day once learnt.
    expect(intervals[0]).toBeGreaterThanOrEqual(DAY);
  });

  it("reaches ink then gilded through spaced recalls", () => {
    const levels = recallEachTime(3).map((m) => m.level);
    expect(levels).toEqual(["sketch", "ink", "gilded"]);
  });

  it("never lowers a level after a forgotten word", () => {
    const [, , gilded] = recallEachTime(3);
    if (gilded === undefined) throw new Error("missing step");
    const outcome = reviewWord(rules, gilded, false, gilded.memory.due);
    expect(outcome.mastery.level).toBe("gilded");
    expect(outcome.mastery.memory.lapses).toBe(1);
    expect(outcome.rating).toBe(1);
    expect(outcome.levelUp).toBe(false);
  });

  it("reports a level up", () => {
    const [first] = recallEachTime(1);
    if (first === undefined) throw new Error("missing step");
    expect(reviewWord(rules, first, true, first.memory.due).levelUp).toBe(true);
  });

  it("is deterministic", () => {
    const a = reviewWord(rules, newWordMastery(0), true, 5 * DAY);
    const b = reviewWord(rules, newWordMastery(0), true, 5 * DAY);
    expect(a).toEqual(b);
  });

  it("computes levels from stability without going down", () => {
    expect(levelFor(rules, 3, "sketch")).toBe("sketch");
    expect(levelFor(rules, 7, "sketch")).toBe("ink");
    expect(levelFor(rules, 45, "ink")).toBe("gilded");
    expect(levelFor(rules, 1, "ink")).toBe("ink");
  });

  describe("proven recall", () => {
    it("climbs only once a right answer comes 7, then 30 days after the previous one", () => {
      const steps = recallEachTime(4, proven);
      expect(steps.map((m) => m.level)).toEqual(["sketch", "sketch", "ink", "gilded"]);
      const [, second, third] = steps;
      const gap = (a?: WordMastery, b?: WordMastery) =>
        ((b?.memory.lastReviewedAt ?? 0) - (a?.memory.lastReviewedAt ?? 0)) / DAY;
      expect(gap(second, third)).toBeGreaterThanOrEqual(7);
    });

    it("climbs one level per answer, however long the word was remembered", () => {
      const first = reviewWord(proven, newWordMastery(0), true, 0).mastery;
      const late = reviewWord(proven, first, true, 60 * DAY);
      expect(late.mastery.level).toBe("ink");
      expect(late.levelUp).toBe(true);
    });

    it("never climbs on a wrong answer or a first answer", () => {
      const first = reviewWord(proven, newWordMastery(0), true, 0).mastery;
      expect(first.level).toBe("sketch");
      expect(reviewWord(proven, first, false, 40 * DAY).mastery.level).toBe("sketch");
    });

    it("reads levels from the days remembered", () => {
      expect(provenLevel(proven, 6.9, "sketch")).toBe("sketch");
      expect(provenLevel(proven, 7, "sketch")).toBe("ink");
      expect(provenLevel(proven, 29, "ink")).toBe("ink");
      expect(provenLevel(proven, 30, "ink")).toBe("gilded");
      expect(provenLevel(proven, 0, "gilded")).toBe("gilded");
    });
  });

  it("applies the rules in force at the time", () => {
    const later = { ...rules, startsAt: 100, requestRetention: 0.8 };
    expect(masteryRulesAt([rules, later], 99)).toBe(rules);
    expect(masteryRulesAt([rules, later], 100)).toBe(later);
    expect(masteryRulesAt(MASTERY_SCHEDULE, Date.now()).levelThresholdDays.ink).toBe(7);
    expect(masteryRulesAt(MASTERY_SCHEDULE, Date.now()).levelBy).toBe("provenRecall");
  });
});
