import { describe, expect, it } from "vitest";
import { CLAN_GOAL_SCHEDULE, CLAN_LEVEL } from "../rules";
import { clanGoalRulesAt } from "./goal";
import {
  clanLevelOf,
  clanLevelUnlock,
  clanUnlocks,
  clanXpToReach,
  nextClanUnlock,
  weekXp,
} from "./level";

const goal = clanGoalRulesAt(CLAN_GOAL_SCHEDULE, Date.UTC(2026, 9, 22));

describe("week XP", () => {
  it("counts each member's correct answers up to the cap, then the tiers", () => {
    expect(weekXp(goal, [40, 250, 0], [])).toBe(140);
    expect(weekXp(goal, [56, 56, 56], ["bronze", "silver", "gold"])).toBe(168 + 350);
  });
});

describe("clan level", () => {
  it("follows 500 + 250 × (n − 1)", () => {
    expect(clanXpToReach(CLAN_LEVEL, 2)).toBe(500);
    expect(clanXpToReach(CLAN_LEVEL, 3)).toBe(1250);
    expect(clanLevelOf(CLAN_LEVEL, 1249)).toMatchObject({ level: 2, xpIntoLevel: 749 });
  });

  it("opens an emblem item at most levels, the fourth tier at 5 and banners from 10", () => {
    expect(clanLevelUnlock(CLAN_LEVEL, 1)).toBeNull();
    expect(clanLevelUnlock(CLAN_LEVEL, 2)).toEqual({ kind: "color", id: "vermillon" });
    expect(clanLevelUnlock(CLAN_LEVEL, 5)).toEqual({ kind: "illuminated" });
    expect(clanLevelUnlock(CLAN_LEVEL, 6)).toEqual({ kind: "engraving", id: "brisoir" });
    expect(clanLevelUnlock(CLAN_LEVEL, 10)).toEqual({ kind: "banner", id: "bucephale" });
    expect(clanLevelUnlock(CLAN_LEVEL, 15)).toEqual({ kind: "banner", id: "astrolatre" });
  });

  it("sums what a level has opened", () => {
    expect(clanUnlocks(CLAN_LEVEL, 1)).toEqual({
      illuminated: false,
      banners: [],
      emblemItems: [],
    });
    const at10 = clanUnlocks(CLAN_LEVEL, 10);
    expect(at10.illuminated).toBe(true);
    expect(at10.banners).toEqual(["bucephale"]);
    expect(at10.emblemItems).toHaveLength(7);
  });

  it("tells the next level that opens something, until the lists are spent", () => {
    expect(nextClanUnlock(CLAN_LEVEL, 4)).toEqual({ level: 5, unlock: { kind: "illuminated" } });
    expect(nextClanUnlock(CLAN_LEVEL, 1000)).toBeNull();
  });
});
