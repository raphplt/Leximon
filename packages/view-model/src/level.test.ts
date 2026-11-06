import { xpToReach } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  levelDescription,
  levelLabel,
  levelRatio,
  levelUpGain,
  playerTitle,
  roadSubtitle,
  xpGainLabel,
  xpProgressLabel,
  xpSources,
} from "./level";

const NOW = Date.UTC(2026, 9, 22);
const at16 = { xp: xpToReach(16) + 260, level: 16, xpIntoLevel: 260, xpForNextLevel: 825 };

describe("level", () => {
  it("labels a gain only when something was earned", () => {
    expect(xpGainLabel({ xpGained: 35 })).toBe("+35 XP");
    expect(xpGainLabel({ xpGained: 0 })).toBeNull();
  });

  it("gives the banner of a new level, with its coffret when one waits", () => {
    expect(levelUpGain({ levelUp: true, level: 6 }, true)).toEqual({
      title: "Niveau 6",
      note: "Un coffret t'attend",
    });
    expect(levelUpGain({ levelUp: true, level: 6 }, false)).toEqual({
      title: "Niveau 6",
      note: null,
    });
    expect(levelUpGain({ levelUp: false, level: 6 }, true)).toBeNull();
  });

  it("measures the current level", () => {
    expect(levelRatio({ xpIntoLevel: 100, xpForNextLevel: 400 })).toBe(0.25);
    expect(levelRatio({ xpIntoLevel: 500, xpForNextLevel: 400 })).toBe(1);
    expect(xpProgressLabel(at16)).toBe("260 / 825 XP");
    expect(levelLabel(at16.level)).toBe("Niveau 16");
    expect(levelDescription(at16)).toBe("Niveau 16, 260 sur 825 XP");
    expect(roadSubtitle(at16)).toBe("Niveau 16 · encore 565 XP avant le 17");
  });

  it("carries the title of the highest milestone claimed", () => {
    expect(playerTitle([], NOW)).toBeNull();
    expect(playerTitle([2, 3, 5, 15], NOW)).toBe("Fine plume");
    expect(playerTitle([5, 12], NOW)).toBe("Lexicographe en herbe");
  });

  it("reads the XP table from the rules in force", () => {
    expect(xpSources(NOW)).toContainEqual({ action: "Nouveau mot", xp: "5 à 50" });
    expect(xpSources(NOW)[0]).toEqual({ action: "Ouvrir un sachet", xp: "10" });
  });
});
