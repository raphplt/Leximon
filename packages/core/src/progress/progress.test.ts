import { describe, expect, it } from "vitest";
import { XP_SCHEDULE } from "../rules";
import { answerXp, boosterXp, levelOf, progressGain, xpRulesAt, xpToReach } from "./progress";

const rules = xpRulesAt(XP_SCHEDULE, 0);

describe("xpToReach", () => {
  it("follows 150 + 45 × (n − 1) per level", () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(150);
    expect(xpToReach(3)).toBe(345);
    expect(xpToReach(10)).toBe(2970);
    expect(xpToReach(30)).toBe(22_620);
  });
});

describe("levelOf", () => {
  it("starts everyone at level 1", () => {
    expect(levelOf(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 150 });
  });

  it("changes level exactly at the threshold", () => {
    expect(levelOf(149).level).toBe(1);
    expect(levelOf(150)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 195 });
    expect(levelOf(2969).level).toBe(9);
    expect(levelOf(2970).level).toBe(10);
  });

  it("agrees with xpToReach on every level up to 500", () => {
    for (let level = 1; level <= 500; level++) {
      const start = xpToReach(level);
      expect(levelOf(start).level).toBe(level);
      expect(levelOf(xpToReach(level + 1) - 1)).toEqual({
        level,
        xpIntoLevel: xpToReach(level + 1) - 1 - start,
        xpForNextLevel: xpToReach(level + 1) - start,
      });
    }
  });

  it("treats a negative or fractional total as what was really earned", () => {
    expect(levelOf(-5).level).toBe(1);
    expect(levelOf(150.9).xpIntoLevel).toBe(0);
  });
});

describe("boosterXp", () => {
  it("rewards the open, the first one of the day and every new word by rarity", () => {
    expect(boosterXp(rules, { newWords: [], firstOfDay: false })).toBe(10);
    expect(boosterXp(rules, { newWords: [], firstOfDay: true })).toBe(30);
    expect(boosterXp(rules, { newWords: ["common", "legendary"], firstOfDay: false })).toBe(65);
  });

  it("pays rarer words more", () => {
    const values = Object.values(rules.newWord);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(rules.newWord.common).toBe(5);
    expect(rules.newWord.legendary).toBe(50);
  });
});

describe("answerXp", () => {
  it("rewards right answers and level ups, nothing for a wrong answer", () => {
    expect(answerXp(rules, { correct: false, levelUp: false })).toBe(0);
    expect(answerXp(rules, { correct: true, levelUp: false })).toBe(15);
    expect(answerXp(rules, { correct: true, levelUp: true })).toBe(40);
  });
});

describe("progressGain", () => {
  it("tells whether the gain crossed a level", () => {
    expect(progressGain(160, 20)).toMatchObject({ level: 2, xpGained: 20, levelUp: true });
    expect(progressGain(180, 20)).toMatchObject({ level: 2, xpIntoLevel: 30, levelUp: false });
    expect(progressGain(0, 0)).toMatchObject({ level: 1, levelUp: false });
  });
});
