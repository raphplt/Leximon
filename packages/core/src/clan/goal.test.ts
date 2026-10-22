import { describe, expect, it } from "vitest";
import { gameWeekOf } from "../bonus/bonus";
import { CLAN_GOAL_SCHEDULE } from "../rules";
import {
  claimableTiers,
  claimDeadline,
  clanGoalRulesAt,
  goalTargets,
  highestTier,
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
    expect(goalTargets(rules, 20)).toEqual({ bronze: 100, silver: 200, gold: 300 });
    expect(goalTargets(rules, 0)).toEqual({ bronze: 5, silver: 10, gold: 15 });
  });

  it("reads the tiers reached", () => {
    const targets = goalTargets(rules, 2);
    expect(tiersReached(targets, 9)).toEqual([]);
    expect(highestTier(targets, 9)).toBeNull();
    expect(tiersReached(targets, 20)).toEqual(["bronze", "silver"]);
    expect(highestTier(targets, 30)).toBe("gold");
  });

  it("gives boosters at silver and gold to members who brought 5 words", () => {
    expect(claimableTiers(rules, ["bronze", "silver", "gold"], 5)).toEqual(["silver", "gold"]);
    expect(claimableTiers(rules, ["bronze"], 40)).toEqual([]);
    expect(claimableTiers(rules, ["bronze", "silver"], 4)).toEqual([]);
  });

  it("keeps a week's rewards until the end of the following week", () => {
    const week = gameWeekOf(Date.UTC(2026, 9, 22, 12));
    expect(claimDeadline(week.start)).toBe(Date.UTC(2026, 10, 1, 23));
  });
});
