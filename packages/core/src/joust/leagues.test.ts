import { describe, expect, it } from "vitest";
import { LEAGUE_SCHEDULE } from "../rules";
import {
  type Division,
  divisionOf,
  divisions,
  floorOf,
  freshStanding,
  joustLaurels,
  type LeagueRules,
  leagueRulesAt,
  leagueStepRewards,
  pendingLeagueRewards,
  rewardedDivisions,
  SEASON_END_STEP,
  seasonOf,
  seasonStart,
} from "./leagues";

const rules: LeagueRules = leagueRulesAt(LEAGUE_SCHEDULE, Date.now());
const name = (division: Division) => `${division.league} ${division.rank ?? ""}`.trim();
const even = { rating: 1500, opponentRating: 1500 };

describe("divisions", () => {
  it("cuts each league into three divisions, the last one whole", () => {
    const all = divisions(rules);
    expect(all).toHaveLength(13);
    expect(all.slice(0, 4).map((division) => [name(division), division.from])).toEqual([
      ["page 3", 0],
      ["page 2", 100],
      ["page 1", 200],
      ["ecuyer 3", 300],
    ]);
    expect(all.at(-1)).toMatchObject({ league: "champion", rank: null, from: 1200, index: 12 });
  });

  it("places laurels in their division", () => {
    expect(name(divisionOf(rules, 0))).toBe("page 3");
    expect(name(divisionOf(rules, 742))).toBe("chevalier 2");
    expect(name(divisionOf(rules, 899))).toBe("chevalier 1");
    expect(name(divisionOf(rules, 5000))).toBe("champion");
  });

  it("floors at the start of the league reached", () => {
    expect(floorOf(rules, 250)).toBe(0);
    expect(floorOf(rules, 742)).toBe(600);
    expect(floorOf(rules, 1300)).toBe(1200);
  });
});

describe("joustLaurels", () => {
  const start = { laurels: 400, peak: 400, streak: 0 };

  it("gives 25 for a win against an even opponent", () => {
    expect(joustLaurels(rules, start, { outcome: "won", ...even }).delta).toBe(25);
    expect(
      joustLaurels(rules, { laurels: 1300, peak: 1300, streak: 0 }, { outcome: "won", ...even })
        .delta,
    ).toBe(25);
  });

  it("takes more for a loss the higher the league the player is in", () => {
    const lost = (laurels: number) =>
      joustLaurels(rules, { laurels, peak: laurels, streak: 0 }, { outcome: "lost", ...even })
        .delta;
    expect(lost(100)).toBe(-15);
    expect(lost(400)).toBe(-20);
    expect(lost(700)).toBe(-23);
    expect(lost(1000)).toBe(-26);
    expect(lost(1300)).toBe(-30);
  });

  it("weighs the laurels by the opponent's rating, within bounds", () => {
    const won = (opponentRating: number) =>
      joustLaurels(rules, start, { outcome: "won", rating: 1500, opponentRating }).delta;
    const lost = (opponentRating: number) =>
      joustLaurels(rules, start, { outcome: "lost", rating: 1500, opponentRating }).delta;
    expect(won(1700)).toBe(30);
    expect(won(2500)).toBe(35);
    expect(won(1100)).toBe(15);
    expect(lost(1700)).toBe(-15);
    expect(lost(2500)).toBe(-10);
    expect(lost(500)).toBe(-30);
  });

  it("changes nothing on a draw, but breaks the streak", () => {
    const change = joustLaurels(rules, { ...start, streak: 4 }, { outcome: "draw", ...even });
    expect(change.delta).toBe(0);
    expect(change.after).toEqual({ laurels: 400, peak: 400, streak: 0 });
  });

  it("adds to a win from the third in a row", () => {
    const second = joustLaurels(rules, { ...start, streak: 1 }, { outcome: "won", ...even });
    expect(second.delta).toBe(25);
    const third = joustLaurels(rules, second.after, { outcome: "won", ...even });
    expect(third.delta).toBe(35);
    expect(third.after).toEqual({ laurels: 460, peak: 460, streak: 3 });
  });

  it("never takes a player below the league reached", () => {
    const change = joustLaurels(
      rules,
      { laurels: 605, peak: 640, streak: 2 },
      { outcome: "lost", ...even },
    );
    expect(change.after).toEqual({ laurels: 600, peak: 640, streak: 0 });
    expect(change.delta).toBe(-5);
    const atFloor = joustLaurels(rules, change.after, { outcome: "lost", ...even });
    expect(atFloor.delta).toBe(0);
  });

  it("lets a player fall within their league", () => {
    const change = joustLaurels(
      rules,
      { laurels: 710, peak: 720, streak: 0 },
      { outcome: "lost", ...even },
    );
    expect(change.after.laurels).toBe(687);
  });
});

describe("seasons", () => {
  it("follows the carnet's calendar from Monday 9 November 2026", () => {
    expect(seasonOf(rules, "2026-11-09")).toEqual({
      index: 0,
      firstDay: "2026-11-09",
      lastDay: "2026-12-06",
    });
    expect(seasonOf(rules, "2026-12-07").index).toBe(1);
    expect(seasonOf(rules, "2026-11-08").index).toBe(-1);
  });

  it("starts a league lower, at its start", () => {
    expect(seasonStart(rules, null, 3)).toBe(0);
    expect(seasonStart(rules, { season: 2, laurels: 1000 }, 3)).toBe(600);
    expect(seasonStart(rules, { season: 2, laurels: 1500 }, 3)).toBe(900);
    expect(seasonStart(rules, { season: 2, laurels: 450 }, 3)).toBe(0);
  });

  it("drops a league more for each season skipped", () => {
    expect(seasonStart(rules, { season: 0, laurels: 1300 }, 2)).toBe(600);
    expect(seasonStart(rules, { season: 0, laurels: 1300 }, 9)).toBe(0);
  });

  it("keeps the season being played", () => {
    expect(seasonStart(rules, { season: 3, laurels: 1300 }, 3)).toBe(0);
    expect(freshStanding(rules, { season: 2, laurels: 1300 }, 3)).toEqual({
      laurels: 900,
      peak: 900,
      streak: 0,
    });
  });
});

describe("rewards", () => {
  it("rewards a division with écus and a league with a garni sachet", () => {
    expect(leagueStepRewards(rules, 1, "page")).toEqual([{ kind: "ecus", amount: 20 }]);
    expect(leagueStepRewards(rules, 3, "page")).toEqual([{ kind: "garni_booster" }]);
    expect(leagueStepRewards(rules, 12, "page")).toEqual([{ kind: "garni_booster" }]);
    expect(leagueStepRewards(rules, 13, "page")).toEqual([]);
    expect(leagueStepRewards(rules, -1, "page")).toEqual([]);
  });

  it("rewards the end of a season by the league reached", () => {
    expect(leagueStepRewards(rules, SEASON_END_STEP, "ecuyer")).toEqual([
      { kind: "bonus_booster" },
      { kind: "bonus_booster" },
    ]);
    expect(leagueStepRewards(rules, SEASON_END_STEP, "champion")).toEqual([
      { kind: "precious_garni_booster" },
    ]);
  });

  it("rewards only the divisions climbed above the season's start", () => {
    expect(rewardedDivisions(rules, 0, 250).map((division) => division.index)).toEqual([1, 2]);
    expect(rewardedDivisions(rules, 600, 742).map((division) => division.index)).toEqual([7]);
    expect(rewardedDivisions(rules, 600, 650)).toEqual([]);
  });

  it("lists what is left to claim, the end of past seasons included", () => {
    const pending = pendingLeagueRewards(
      rules,
      [
        { season: 1, started: 0, laurels: 120, peak: 160 },
        { season: 0, started: 0, laurels: 310, peak: 310 },
      ],
      [
        { season: 0, step: 1 },
        { season: 0, step: 2 },
      ],
      1,
    );
    expect(pending).toEqual([
      { season: 0, step: 3 },
      { season: 0, step: SEASON_END_STEP },
      { season: 1, step: 1 },
    ]);
  });
});
