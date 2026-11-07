/**
 * Leagues of ranked jousts, played as a tournament each week. A player enters the week's
 * tournament with the result of their first ranked joust of the week, in a group of their league;
 * automatons fill the places no player took. Ranked wins and draws bring points; at the end of
 * the week the first places of the group go up a league and the last go down. A week without a
 * ranked joust changes nothing.
 *
 * The automatons never joust: their points are drawn from the group's seed and rise over the
 * week, higher in the higher leagues, so that they set how hard each league is to leave while the
 * groups are not full. They are always shown as automatons.
 *
 * Concurrency: these functions are pure. Callers add a joust's points under both members' locks,
 * enter a group under a lock of its league and week, and claim a reward under the wallet lock.
 */

import { gameTimeOn } from "../bonus/bonus";
import type { EpochMs } from "../booster/refill";
import { type CarnetPeriod, carnetPeriodOf, periodAt } from "../progress/carnet";
import type { LevelReward } from "../progress/rewards";
import { createSeededRandom, type RandomSource, randomInt } from "../random";

export const LEAGUES = [
  "page",
  "ecuyer",
  "chevalier",
  "banneret",
  "marechal",
  "connetable",
  "champion",
] as const;
export type League = (typeof LEAGUES)[number];

export type JoustResult = "won" | "lost" | "draw";
export type WeekMove = "up" | "stay" | "down";

export interface LeagueRules {
  /** Period start; the rules in force when a joust ends or a reward is claimed apply. */
  readonly startsAt: EpochMs;
  /** A Monday (Paris): the first day of week 0; the weeks before have negative numbers. */
  readonly firstWeekDay: string;
  /** Places of a group: players first, automatons for the rest. */
  readonly groupSize: number;
  /** Ranked jousts a player may play in a day (Paris), launched or received. */
  readonly rankedPerDay: number;
  readonly points: Readonly<Record<JoustResult, number>>;
  /** At the end of a week: how many first places go up, and last places go down. */
  readonly moves: Readonly<Record<League, { readonly up: number; readonly down: number }>>;
  /** Points of the automatons over a whole week: a normal draw, kept within what a player can do. */
  readonly bots: Readonly<Record<League, { readonly mean: number; readonly spread: number }>>;
  /** What a week played gives, by its league. */
  readonly weekEcus: Readonly<Record<League, number>>;
  /** Given on top for going up. */
  readonly upRewards: readonly LevelReward[];
  /** Given on top to the first places of the Champion group. */
  readonly championPodium: { readonly places: number; readonly rewards: readonly LevelReward[] };
}

export type LeagueSchedule = readonly [LeagueRules, ...LeagueRules[]];

export function leagueRulesAt(schedule: LeagueSchedule, time: EpochMs): LeagueRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export function leagueRank(league: League): number {
  return LEAGUES.indexOf(league);
}

export function leagueAt(rank: number): League {
  return LEAGUES[Math.max(0, Math.min(LEAGUES.length - 1, rank))] ?? "page";
}

// --- Weeks ---------------------------------------------------------------------------------------

const WEEK_DAYS = 7;
const calendarOf = (rules: LeagueRules) => ({
  firstPeriodDay: rules.firstWeekDay,
  periodDays: WEEK_DAYS,
});

/** The week of a day (Paris, "2026-11-09"). */
export function weekOf(rules: LeagueRules, day: string): CarnetPeriod {
  return carnetPeriodOf(calendarOf(rules), day);
}

export function weekAt(rules: LeagueRules, index: number): CarnetPeriod {
  return periodAt(calendarOf(rules), index);
}

// --- A joust -------------------------------------------------------------------------------------

export function joustPoints(rules: LeagueRules, result: JoustResult): number {
  return rules.points[result];
}

/** The most points a player can make in a week. */
export function weekPointsCap(rules: LeagueRules): number {
  return rules.rankedPerDay * WEEK_DAYS * rules.points.won;
}

/** Ranked jousts the player may still play today. */
export function rankedLeft(rules: LeagueRules, rankedToday: number): number {
  return Math.max(0, rules.rankedPerDay - rankedToday);
}

// --- The automatons ------------------------------------------------------------------------------

export interface GroupSeed {
  readonly league: League;
  readonly week: number;
  /** 32 lowercase hex characters, drawn when the group was made. */
  readonly seed: string;
}

interface BotPlan {
  readonly total: number;
  /** When the automaton jousts in the week, and the share of its points each time. */
  readonly steps: readonly { readonly at: EpochMs; readonly share: number }[];
}

function unit(random: RandomSource): number {
  return random.nextUint32() / 2 ** 32;
}

function normal(random: RandomSource): number {
  const u = Math.max(unit(random), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * unit(random));
}

function dayAfter(day: string, days: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/** Every automaton a group could hold, in the order they leave as players arrive. */
function botPlans(rules: LeagueRules, group: GroupSeed): BotPlan[] {
  const random = createSeededRandom(group.seed);
  const firstDay = weekAt(rules, group.week).firstDay;
  const { mean, spread } = rules.bots[group.league];
  const cap = weekPointsCap(rules);
  return Array.from({ length: rules.groupSize }, () => {
    const total = Math.max(0, Math.min(cap, Math.round(mean + spread * normal(random))));
    const steps = Array.from({ length: WEEK_DAYS }, (_, day) => {
      const plays = unit(random) < 0.8;
      const share = plays ? 0.5 + unit(random) : 0;
      const hour = 8 + randomInt(random, 15);
      const minute = randomInt(random, 60);
      return { at: gameTimeOn(dayAfter(firstDay, day), hour) + minute * 60_000, share };
    });
    return { total, steps };
  });
}

export interface BotStanding {
  readonly index: number;
  readonly points: number;
  /** When it reached those points: the start of the week before its first step. */
  readonly scoredAt: EpochMs;
}

/** The first `count` automatons of a group as they stand at `at`. */
export function botsOf(
  rules: LeagueRules,
  group: GroupSeed,
  count: number,
  at: EpochMs,
): BotStanding[] {
  const weekStart = gameTimeOn(weekAt(rules, group.week).firstDay, 0);
  return botPlans(rules, group)
    .slice(0, Math.max(0, count))
    .map((plan, index) => {
      const whole = plan.steps.reduce((sum, step) => sum + step.share, 0);
      let done = 0;
      let scoredAt = weekStart;
      for (const step of plan.steps) {
        if (step.at > at || step.share === 0) continue;
        done += step.share;
        scoredAt = Math.max(scoredAt, step.at);
      }
      const points = whole === 0 ? 0 : Math.round((plan.total * done) / whole);
      return { index, points, scoredAt: points === 0 ? weekStart : scoredAt };
    });
}

// --- The group -----------------------------------------------------------------------------------

export interface GroupMember {
  readonly userId: string;
  readonly points: number;
  /** When the member reached their points; when they entered the group if they have none. */
  readonly scoredAt: EpochMs;
}

export type GroupLine =
  | {
      readonly kind: "player";
      readonly userId: string;
      readonly points: number;
      readonly place: number;
      readonly move: WeekMove;
    }
  | {
      readonly kind: "bot";
      readonly index: number;
      readonly points: number;
      readonly place: number;
      readonly move: WeekMove;
    };

/** What a place gives at the end of the week. Going up takes at least one point. */
export function moveOf(
  rules: LeagueRules,
  league: League,
  place: number,
  points: number,
): WeekMove {
  const { up, down } = rules.moves[league];
  if (place <= up && points > 0) return "up";
  if (place > rules.groupSize - down) return "down";
  return "stay";
}

/**
 * The group as it stands at `at`: its players and the automatons that fill the places left, by
 * points, the first to reach a score ahead at equal points, players ahead of automatons last.
 */
export function groupStandings(
  rules: LeagueRules,
  group: GroupSeed,
  members: readonly GroupMember[],
  at: EpochMs,
): GroupLine[] {
  const bots = botsOf(rules, group, rules.groupSize - members.length, at);
  const lines = [
    ...members.map((member) => ({
      key: `p:${member.userId}`,
      points: member.points,
      scoredAt: member.scoredAt,
      player: member.userId as string | null,
      bot: -1,
    })),
    ...bots.map((bot) => ({
      key: `b:${String(bot.index).padStart(3, "0")}`,
      points: bot.points,
      scoredAt: bot.scoredAt,
      player: null,
      bot: bot.index,
    })),
  ].sort(
    (a, b) =>
      b.points - a.points ||
      a.scoredAt - b.scoredAt ||
      (a.player === null ? 1 : 0) - (b.player === null ? 1 : 0) ||
      (a.key < b.key ? -1 : 1),
  );
  return lines.map((line, position) => {
    const place = position + 1;
    const move = moveOf(rules, group.league, place, line.points);
    return line.player === null
      ? { kind: "bot", index: line.bot, points: line.points, place, move }
      : { kind: "player", userId: line.player, points: line.points, place, move };
  });
}

export function leagueAfter(league: League, move: WeekMove): League {
  const shift = move === "up" ? 1 : move === "down" ? -1 : 0;
  return leagueAt(leagueRank(league) + shift);
}

// --- Rewards -------------------------------------------------------------------------------------

/** What a week played gives: écus by league, and more for going up or for the Champion podium. */
export function weekRewards(
  rules: LeagueRules,
  league: League,
  place: number,
  move: WeekMove,
): readonly LevelReward[] {
  const rewards: LevelReward[] = [{ kind: "ecus", amount: rules.weekEcus[league] }];
  if (move === "up") rewards.push(...rules.upRewards);
  if (league === "champion" && place <= rules.championPodium.places) {
    rewards.push(...rules.championPodium.rewards);
  }
  return rewards;
}
