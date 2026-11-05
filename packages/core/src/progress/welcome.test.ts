import { describe, expect, it } from "vitest";
import { WELCOME_SCHEDULE } from "../rules";
import { rewardReserve } from "./rewards";
import { type WelcomeRules, welcomeRewards, welcomeRulesAt, welcomeState } from "./welcome";

const rules: WelcomeRules = {
  startsAt: 0,
  days: [[{ kind: "bonus_booster" }], [{ kind: "garni_booster" }], [{ kind: "bonus_booster" }]],
};

describe("welcomeState", () => {
  it("opens the first day to a player who claimed nothing", () => {
    expect(welcomeState(rules, [], "2026-11-05")).toEqual({ kind: "open", day: 1 });
  });

  it("keeps the next day for tomorrow once a day was claimed today", () => {
    const claims = [{ day: 1, on: "2026-11-05" }];
    expect(welcomeState(rules, claims, "2026-11-05")).toEqual({ kind: "tomorrow", day: 2 });
    expect(welcomeState(rules, claims, "2026-11-06")).toEqual({ kind: "open", day: 2 });
  });

  it("loses nothing when days are skipped", () => {
    const claims = [{ day: 1, on: "2026-11-05" }];
    expect(welcomeState(rules, claims, "2026-11-20")).toEqual({ kind: "open", day: 2 });
  });

  it("ends once every day is claimed", () => {
    const claims = [
      { day: 1, on: "2026-11-05" },
      { day: 2, on: "2026-11-06" },
      { day: 3, on: "2026-11-08" },
    ];
    expect(welcomeState(rules, claims, "2026-11-08")).toEqual({ kind: "done" });
    expect(welcomeState(rules, claims, "2026-11-09")).toEqual({ kind: "done" });
  });
});

describe("welcomeRewards", () => {
  it("gives each day its own rewards, nothing outside the week", () => {
    expect(welcomeRewards(rules, 2)).toEqual([{ kind: "garni_booster" }]);
    expect(welcomeRewards(rules, 0)).toEqual([]);
    expect(welcomeRewards(rules, 4)).toEqual([]);
    expect(welcomeRewards(rules, 1.5)).toEqual([]);
  });
});

describe("the welcome week in force", () => {
  const week = welcomeRulesAt(WELCOME_SCHEDULE, Date.UTC(2026, 10, 10));

  it("lasts seven days", () => {
    expect(week.days).toHaveLength(7);
  });

  it("gives six sachets, three garni ones including a precious one, an avatar and a title", () => {
    const all = week.days.flat();
    expect(rewardReserve(all)).toEqual({ bonus: 9, garni: 3, precious: 1 });
    expect(all.filter((reward) => reward.kind === "avatar")).toHaveLength(1);
    expect(all.filter((reward) => reward.kind === "title")).toHaveLength(1);
  });

  it("names its avatar and its title, known before they are won", () => {
    for (const reward of week.days.flat()) {
      if (reward.kind === "avatar") expect(reward.avatar).toBeTruthy();
    }
  });
});
