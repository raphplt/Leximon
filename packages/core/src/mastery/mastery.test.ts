import { describe, expect, it } from "vitest";
import { MASTERY_SCHEDULE } from "../rules";
import {
  isDue,
  isProvenLevel,
  levelFor,
  levelUpPossible,
  type MasteryRules,
  masteryRulesAt,
  newWordMastery,
  provenLevel,
  recallProbability,
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
  slipToleranceFromLetters: 6,
  startLevel: "sketch",
};
const typed = { grade: "good", typed: true } as const;
const picked = { grade: "good", typed: false } as const;
const wrong = { grade: "again", typed: true } as const;
const proven: MasteryRules = { ...rules, levelBy: "provenRecall" };
const blank: MasteryRules = { ...proven, startLevel: "blank" };

/** Answers right each time the word comes back; returns the mastery after each answer. */
function recallEachTime(times: number, using = rules): WordMastery[] {
  let mastery = newWordMastery(rules, 0);
  let now = 0;
  const steps: WordMastery[] = [];
  for (let i = 0; i < times; i++) {
    mastery = reviewWord(using, mastery, typed, now).mastery;
    steps.push(mastery);
    now = mastery.memory.due;
  }
  return steps;
}

describe("mastery", () => {
  it("starts a new word as a due sketch", () => {
    const mastery = newWordMastery(rules, 1_000);
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
    const outcome = reviewWord(rules, gilded, wrong, gilded.memory.due);
    expect(outcome.mastery.level).toBe("gilded");
    expect(outcome.mastery.memory.lapses).toBe(1);
    expect(outcome.rating).toBe(1);
    expect(outcome.levelUp).toBe(false);
  });

  it("reports a level up", () => {
    const [first] = recallEachTime(1);
    if (first === undefined) throw new Error("missing step");
    expect(reviewWord(rules, first, typed, first.memory.due).levelUp).toBe(true);
  });

  it("is deterministic", () => {
    const a = reviewWord(rules, newWordMastery(rules, 0), typed, 5 * DAY);
    const b = reviewWord(rules, newWordMastery(rules, 0), typed, 5 * DAY);
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
      const first = reviewWord(proven, newWordMastery(rules, 0), picked, 0).mastery;
      const late = reviewWord(proven, first, typed, 60 * DAY);
      expect(late.mastery.level).toBe("ink");
      expect(late.levelUp).toBe(true);
    });

    it("never climbs on a wrong answer or a first answer", () => {
      const first = reviewWord(proven, newWordMastery(rules, 0), picked, 0).mastery;
      expect(first.level).toBe("sketch");
      expect(reviewWord(proven, first, wrong, 40 * DAY).mastery.level).toBe("sketch");
    });

    it("climbs only on a typed answer", () => {
      const first = reviewWord(proven, newWordMastery(rules, 0), picked, 0).mastery;
      expect(reviewWord(proven, first, picked, 10 * DAY).mastery.level).toBe("sketch");
      expect(reviewWord(proven, first, typed, 10 * DAY).mastery.level).toBe("ink");
    });

    it("climbs on a typed answer with a slip, rated hard", () => {
      const first = reviewWord(proven, newWordMastery(rules, 0), picked, 0).mastery;
      const slip = reviewWord(proven, first, { grade: "hard", typed: true }, 10 * DAY);
      expect(slip.mastery.level).toBe("ink");
      expect(slip.rating).toBe(2);
      const good = reviewWord(proven, first, typed, 10 * DAY);
      expect(slip.mastery.memory.due).toBeLessThan(good.mastery.memory.due);
    });

    it("asks for the word typed only when a right answer can raise the level", () => {
      expect(levelUpPossible(proven, "sketch", null, 60 * DAY)).toBe(false);
      expect(levelUpPossible(proven, "sketch", 0, 6 * DAY)).toBe(false);
      expect(levelUpPossible(proven, "sketch", 0, 7 * DAY)).toBe(true);
      expect(levelUpPossible(proven, "ink", 0, 29 * DAY)).toBe(false);
      expect(levelUpPossible(proven, "ink", 0, 30 * DAY)).toBe(true);
      expect(levelUpPossible(proven, "gilded", 0, 365 * DAY)).toBe(false);
      expect(levelUpPossible(rules, "sketch", 0, 60 * DAY)).toBe(false);
    });

    it("reads levels from the days remembered", () => {
      expect(provenLevel(proven, 6.9, "sketch")).toBe("sketch");
      expect(provenLevel(proven, 7, "sketch")).toBe("ink");
      expect(provenLevel(proven, 29, "ink")).toBe("ink");
      expect(provenLevel(proven, 30, "ink")).toBe("gilded");
      expect(provenLevel(proven, 0, "gilded")).toBe("gilded");
    });
  });

  describe("blank page", () => {
    it("starts a new word on a blank page", () => {
      expect(newWordMastery(blank, 0).level).toBe("blank");
    });

    it("reaches the sketch on the first right answer, picked or typed", () => {
      const met = reviewWord(blank, newWordMastery(blank, 0), picked, 0);
      expect(met.mastery.level).toBe("sketch");
      expect(met.levelUp).toBe(true);
    });

    it("stays blank while the word is missed", () => {
      const missed = reviewWord(blank, newWordMastery(blank, 0), wrong, 0).mastery;
      expect(missed.level).toBe("blank");
      expect(reviewWord(blank, missed, picked, 2 * DAY).mastery.level).toBe("sketch");
    });

    it("never asks for the word typed on a blank page", () => {
      expect(levelUpPossible(blank, "blank", 0, 60 * DAY)).toBe(false);
    });

    it("earns the level's rewards only from the ink on", () => {
      expect(isProvenLevel("sketch")).toBe(false);
      expect(isProvenLevel("ink")).toBe(true);
      expect(isProvenLevel("gilded")).toBe(true);
    });
  });

  it("predicts a recall that fades with time", () => {
    const learnt = reviewWord(proven, newWordMastery(rules, 0), picked, 0).mastery;
    const soon = recallProbability(proven, learnt.memory, DAY);
    const late = recallProbability(proven, learnt.memory, 60 * DAY);
    expect(soon).toBeGreaterThan(late);
    expect(soon).toBeLessThanOrEqual(1);
    expect(late).toBeGreaterThan(0);
  });

  it("applies the rules in force at the time", () => {
    const later = { ...rules, startsAt: 100, requestRetention: 0.8 };
    expect(masteryRulesAt([rules, later], 99)).toBe(rules);
    expect(masteryRulesAt([rules, later], 100)).toBe(later);
    expect(masteryRulesAt(MASTERY_SCHEDULE, Date.now()).levelThresholdDays.ink).toBe(7);
    expect(masteryRulesAt(MASTERY_SCHEDULE, Date.now()).levelBy).toBe("provenRecall");
    expect(masteryRulesAt(MASTERY_SCHEDULE, Date.now()).startLevel).toBe("blank");
  });
});
