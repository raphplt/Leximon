import { describe, expect, it } from "vitest";
import { levelDescription, levelRatio, levelUpLabel, xpGainLabel } from "./progress";

const progress = { xp: 135, level: 2, xpIntoLevel: 35, xpForNextLevel: 120 };

describe("progress labels", () => {
  it("shows a gain only when there is one", () => {
    expect(xpGainLabel({ xpGained: 35 })).toBe("+35 XP");
    expect(xpGainLabel({ xpGained: 0 })).toBeNull();
  });

  it("celebrates a level up only", () => {
    expect(levelUpLabel({ levelUp: true, level: 6 })).toBe("Niveau 6 !");
    expect(levelUpLabel({ levelUp: false, level: 6 })).toBeNull();
  });

  it("describes the level for screen readers", () => {
    expect(levelDescription(progress)).toBe("Niveau 2 · 35 / 120 XP");
  });

  it("keeps the ratio between 0 and 1", () => {
    expect(levelRatio(progress)).toBeCloseTo(35 / 120);
    expect(levelRatio({ xpIntoLevel: 200, xpForNextLevel: 120 })).toBe(1);
    expect(levelRatio({ xpIntoLevel: -1, xpForNextLevel: 120 })).toBe(0);
  });
});
