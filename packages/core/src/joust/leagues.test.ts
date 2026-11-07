import { describe, expect, it } from "vitest";
import { gameTimeOn } from "../bonus/bonus";
import { LEAGUE_SCHEDULE } from "../rules";
import {
  botsOf,
  type GroupMember,
  type GroupSeed,
  groupStandings,
  joustPoints,
  LEAGUES,
  type LeagueRules,
  leagueAfter,
  leagueRulesAt,
  moveOf,
  rankedLeft,
  weekAt,
  weekOf,
  weekPointsCap,
  weekRewards,
} from "./leagues";

const rules: LeagueRules = leagueRulesAt(LEAGUE_SCHEDULE, Date.now());
const SEED = "0123456789abcdef0123456789abcdef";
const group = (league: GroupSeed["league"], week = 0, seed = SEED): GroupSeed => ({
  league,
  week,
  seed,
});
const monday = gameTimeOn("2026-11-09", 0);
const sundayNight = gameTimeOn("2026-11-16", 0) - 1;

describe("weeks", () => {
  it("run from Monday 9 November 2026, Paris time", () => {
    expect(weekOf(rules, "2026-11-09")).toEqual({
      index: 0,
      firstDay: "2026-11-09",
      lastDay: "2026-11-15",
    });
    expect(weekOf(rules, "2026-11-15").index).toBe(0);
    expect(weekOf(rules, "2026-11-16").index).toBe(1);
    expect(weekOf(rules, "2026-11-08").index).toBe(-1);
    expect(weekAt(rules, 2).firstDay).toBe("2026-11-23");
  });
});

describe("a joust", () => {
  it("gives 3 points for a win, 1 for a draw, none for a defeat", () => {
    expect(joustPoints(rules, "won")).toBe(3);
    expect(joustPoints(rules, "draw")).toBe(1);
    expect(joustPoints(rules, "lost")).toBe(0);
  });

  it("allows 5 ranked jousts a day", () => {
    expect(rankedLeft(rules, 0)).toBe(5);
    expect(rankedLeft(rules, 4)).toBe(1);
    expect(rankedLeft(rules, 7)).toBe(0);
    expect(weekPointsCap(rules)).toBe(105);
  });
});

describe("the automatons", () => {
  it("are drawn the same from the same seed", () => {
    expect(botsOf(rules, group("chevalier"), 30, sundayNight)).toEqual(
      botsOf(rules, group("chevalier"), 30, sundayNight),
    );
    expect(botsOf(rules, group("chevalier"), 30, sundayNight)).not.toEqual(
      botsOf(rules, group("chevalier", 0, "f".repeat(32)), 30, sundayNight),
    );
  });

  it("start the week at nothing and only gain", () => {
    const at = (time: number) => botsOf(rules, group("banneret"), 30, time);
    expect(at(monday).every((bot) => bot.points === 0)).toBe(true);
    let before = at(monday);
    for (let day = 1; day <= 7; day += 1) {
      const now = at(monday + day * 86_400_000 - 1);
      now.forEach((bot, index) => {
        expect(bot.points).toBeGreaterThanOrEqual(before[index]?.points ?? 0);
      });
      before = now;
    }
  });

  it("make more points in the higher leagues, never more than a player can", () => {
    const mean = (league: GroupSeed["league"]) => {
      let total = 0;
      for (let seed = 0; seed < 40; seed += 1) {
        const bots = botsOf(
          rules,
          group(league, 0, seed.toString(16).padStart(32, "0")),
          30,
          sundayNight,
        );
        total += bots.reduce((sum, bot) => sum + bot.points, 0) / bots.length;
        for (const bot of bots) expect(bot.points).toBeLessThanOrEqual(weekPointsCap(rules));
      }
      return total / 40;
    };
    const means = LEAGUES.map(mean);
    for (let rank = 1; rank < means.length; rank += 1) {
      expect(means[rank]).toBeGreaterThan(means[rank - 1] ?? 0);
    }
    expect(means[0]).toBeGreaterThan(rules.bots.page.mean - 3);
    expect(means[0]).toBeLessThan(rules.bots.page.mean + 3);
  });

  it("keep their order as players take their places", () => {
    const all = botsOf(rules, group("page"), 30, sundayNight);
    expect(botsOf(rules, group("page"), 12, sundayNight)).toEqual(all.slice(0, 12));
  });
});

describe("the group", () => {
  const member = (userId: string, points: number, scoredAt = monday + 1): GroupMember => ({
    userId,
    points,
    scoredAt,
  });

  it("fills the places left with automatons", () => {
    const lines = groupStandings(rules, group("ecuyer"), [member("a", 9)], sundayNight);
    expect(lines).toHaveLength(30);
    expect(lines.filter((line) => line.kind === "bot")).toHaveLength(29);
    expect(lines.map((line) => line.place)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("ranks by points, the first to reach a score ahead", () => {
    const lines = groupStandings(
      rules,
      group("page"),
      [member("late", 200, monday + 5_000), member("early", 200, monday + 1_000)],
      sundayNight,
    );
    expect(lines[0]).toMatchObject({ kind: "player", userId: "early", place: 1, move: "up" });
    expect(lines[1]).toMatchObject({ kind: "player", userId: "late", place: 2, move: "up" });
  });

  it("puts a player ahead of an automaton on the same points at the same time", () => {
    const bots = botsOf(rules, group("page"), 29, sundayNight);
    const top = bots.reduce((best, bot) => (bot.points > best.points ? bot : best));
    const lines = groupStandings(
      rules,
      group("page"),
      [member("tied", top.points, top.scoredAt)],
      sundayNight,
    );
    const mine = lines.find((line) => line.kind === "player");
    const theirs = lines.find((line) => line.kind === "bot" && line.index === top.index);
    expect(mine?.place).toBeLessThan(theirs?.place ?? 0);
  });

  it("is full of players once 30 have come", () => {
    const members = Array.from({ length: 30 }, (_, i) => member(`p${i}`, i));
    const lines = groupStandings(rules, group("chevalier"), members, sundayNight);
    expect(lines.every((line) => line.kind === "player")).toBe(true);
  });
});

describe("the end of the week", () => {
  it("sends the first places up and the last down, by league", () => {
    expect(moveOf(rules, "page", 10, 5)).toBe("up");
    expect(moveOf(rules, "page", 11, 5)).toBe("stay");
    expect(moveOf(rules, "page", 30, 0)).toBe("stay");
    expect(moveOf(rules, "chevalier", 7, 40)).toBe("up");
    expect(moveOf(rules, "chevalier", 25, 10)).toBe("stay");
    expect(moveOf(rules, "chevalier", 26, 10)).toBe("down");
    expect(moveOf(rules, "champion", 1, 90)).toBe("stay");
    expect(moveOf(rules, "champion", 23, 40)).toBe("down");
  });

  it("takes a point to go up", () => {
    expect(moveOf(rules, "page", 1, 0)).toBe("stay");
  });

  it("moves a league up or down, within the ladder", () => {
    expect(leagueAfter("page", "up")).toBe("ecuyer");
    expect(leagueAfter("banneret", "down")).toBe("chevalier");
    expect(leagueAfter("page", "down")).toBe("page");
    expect(leagueAfter("champion", "up")).toBe("champion");
    expect(leagueAfter("marechal", "stay")).toBe("marechal");
  });

  it("rewards the week by league, more for going up and for the Champion podium", () => {
    expect(weekRewards(rules, "page", 20, "stay")).toEqual([{ kind: "ecus", amount: 10 }]);
    expect(weekRewards(rules, "chevalier", 2, "up")).toEqual([
      { kind: "ecus", amount: 20 },
      { kind: "garni_booster" },
    ]);
    expect(weekRewards(rules, "champion", 3, "stay")).toEqual([
      { kind: "ecus", amount: 40 },
      { kind: "precious_garni_booster" },
    ]);
    expect(weekRewards(rules, "champion", 4, "stay")).toEqual([{ kind: "ecus", amount: 40 }]);
  });
});
