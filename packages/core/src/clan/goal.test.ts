import { describe, expect, it } from "vitest";
import { gameWeekOf } from "../bonus/bonus";
import { CLAN_GOAL_SCHEDULE } from "../rules";
import {
  claimableTiers,
  claimDeadline,
  clanGoalRulesAt,
  goalTargets,
  goalTiers,
  highestTier,
  nextTier,
  tiersReached,
} from "./goal";

const rules = clanGoalRulesAt(CLAN_GOAL_SCHEDULE, Date.UTC(2026, 9, 22));

describe("gameWeekOf", () => {
  it("starts on Monday at midnight in Paris", () => {
    // Thursday 22 October 2026, summer time: the week starts on Sunday 18 at 22:00 UTC.
    const week = gameWeekOf(Date.UTC(2026, 9, 22, 12));
    expect(week.key).toBe("2026-10-19");
    expect(week.start).toBe(Date.UTC(2026, 9, 18, 22));
    // The clocks go back on 25 October: the next Monday starts at 23:00 UTC.
    expect(week.end).toBe(Date.UTC(2026, 9, 25, 23));
  });

  it("puts Sunday night in the week that ends, and Monday in the next one", () => {
    expect(gameWeekOf(Date.UTC(2026, 9, 25, 22, 59)).key).toBe("2026-10-19");
    expect(gameWeekOf(Date.UTC(2026, 9, 25, 23)).key).toBe("2026-10-26");
  });
});

describe("weekly goal", () => {
  it("scales the targets with the active members, one at least", () => {
    expect(goalTargets(rules, 20, false)).toEqual({
      bronze: 300,
      silver: 600,
      gold: 1000,
      illuminated: null,
    });
    expect(goalTargets(rules, 0, true)).toEqual({
      bronze: 15,
      silver: 30,
      gold: 50,
      illuminated: 60,
    });
  });

  it("has a fourth tier only when the clan's level opened it", () => {
    expect(goalTiers(goalTargets(rules, 3, false))).toEqual(["bronze", "silver", "gold"]);
    expect(goalTiers(goalTargets(rules, 3, true))).toEqual([
      "bronze",
      "silver",
      "gold",
      "illuminated",
    ]);
  });

  it("reads the tiers reached and the next one", () => {
    const targets = goalTargets(rules, 2, false);
    expect(tiersReached(targets, 29)).toEqual([]);
    expect(highestTier(targets, 29)).toBeNull();
    expect(nextTier(targets, 29)).toBe("bronze");
    expect(tiersReached(targets, 60)).toEqual(["bronze", "silver"]);
    expect(highestTier(targets, 500)).toBe("gold");
    expect(nextTier(targets, 500)).toBeNull();
    expect(nextTier(goalTargets(rules, 2, true), 100)).toBe("illuminated");
  });

  it("gives boosters from silver on to members who gave 15 correct answers", () => {
    expect(claimableTiers(rules, ["bronze", "silver", "gold", "illuminated"], 15)).toEqual([
      "silver",
      "gold",
      "illuminated",
    ]);
    expect(claimableTiers(rules, ["bronze"], 40)).toEqual([]);
    expect(claimableTiers(rules, ["bronze", "silver"], 14)).toEqual([]);
  });

  it("keeps a week's rewards until the end of the following week", () => {
    const week = gameWeekOf(Date.UTC(2026, 9, 22, 12));
    expect(claimDeadline(week.start)).toBe(Date.UTC(2026, 10, 1, 23));
  });
});
