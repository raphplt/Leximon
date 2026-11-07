/**
 * Leagues of ranked jousts. Laurels are won and lost in ranked jousts only, on a ladder of
 * leagues cut into divisions. A season follows the carnet's calendar; at its end each player gets
 * the reward of the league they reached and starts the next one a league lower. The hidden rating
 * still chooses the opponent and only weighs the laurels a joust is worth.
 *
 * Nothing is stored for a season the player did not play: where they start is computed from
 * their last season played, one league lower for each season since.
 *
 * Concurrency: these functions are pure. Callers apply a joust's laurels under both standings'
 * locks, and a reward claim under the player's wallet lock.
 */

import type { EpochMs } from "../booster/refill";
import { type CarnetPeriod, carnetPeriodOf, periodAt } from "../progress/carnet";
import type { LevelReward } from "../progress/rewards";

export const LEAGUES = ["page", "ecuyer", "chevalier", "banneret", "champion"] as const;
export type League = (typeof LEAGUES)[number];

export interface LeagueRules {
  /** Period start; the rules in force when a joust ends or a reward is claimed apply. */
  readonly startsAt: EpochMs;
  /** First day (Paris) of season 0; the seasons before have negative numbers. */
  readonly firstSeasonDay: string;
  readonly seasonDays: number;
  /** Laurels at which each league starts, Page at 0. */
  readonly leagueFrom: Readonly<Record<League, number>>;
  /** Divisions of each league below the last one; the last league has one. */
  readonly divisionsPerLeague: number;
  /** Laurels of a win against an opponent of the same rating, and the bounds by rating gap. */
  readonly win: LaurelRange;
  readonly loss: LaurelRange;
  /** A rating gap this wide reaches a bound of the range. */
  readonly ratingSpread: number;
  /** From this win in a row on, a win brings `streakBonus` more laurels. */
  readonly streakFrom: number;
  readonly streakBonus: number;
  /** The first time in a season a division is reached, and a league. */
  readonly divisionRewards: readonly LevelReward[];
  readonly leagueRewards: readonly LevelReward[];
  /** At the end of a season, by the league reached. */
  readonly seasonRewards: Readonly<Record<League, readonly LevelReward[]>>;
}

export interface LaurelRange {
  readonly base: number;
  readonly min: number;
  readonly max: number;
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

// --- Seasons -------------------------------------------------------------------------------------

const calendarOf = (rules: LeagueRules) => ({
  firstPeriodDay: rules.firstSeasonDay,
  periodDays: rules.seasonDays,
});

/** The season of a day (Paris, "2026-11-09"). */
export function seasonOf(rules: LeagueRules, day: string): CarnetPeriod {
  return carnetPeriodOf(calendarOf(rules), day);
}

export function seasonAt(rules: LeagueRules, index: number): CarnetPeriod {
  return periodAt(calendarOf(rules), index);
}

// --- Divisions -----------------------------------------------------------------------------------

export interface Division {
  readonly league: League;
  /** 3, 2 then 1 within a league, as « Chevalier III » then « Chevalier I »; `null` for the last. */
  readonly rank: number | null;
  readonly from: number;
  /** Its place on the ladder, 0 for the first. */
  readonly index: number;
}

/** Every division, lowest first. */
export function divisions(rules: LeagueRules): readonly Division[] {
  const all: Division[] = [];
  LEAGUES.forEach((league, leagueIndex) => {
    const from = rules.leagueFrom[league];
    const next = LEAGUES[leagueIndex + 1];
    if (next === undefined) {
      all.push({ league, rank: null, from, index: all.length });
      return;
    }
    const step = (rules.leagueFrom[next] - from) / rules.divisionsPerLeague;
    for (let part = 0; part < rules.divisionsPerLeague; part += 1) {
      all.push({
        league,
        rank: rules.divisionsPerLeague - part,
        from: Math.round(from + part * step),
        index: all.length,
      });
    }
  });
  return all;
}

export function divisionOf(rules: LeagueRules, laurels: number): Division {
  const all = divisions(rules);
  return all.findLast((division) => laurels >= division.from) ?? (all[0] as Division);
}

export function leagueOf(rules: LeagueRules, laurels: number): League {
  return divisionOf(rules, laurels).league;
}

/** Laurels never go below the start of the league reached in the season. */
export function floorOf(rules: LeagueRules, peak: number): number {
  return rules.leagueFrom[leagueOf(rules, peak)];
}

// --- A joust's laurels ---------------------------------------------------------------------------

export interface Standing {
  readonly laurels: number;
  /** The most laurels held this season: its league is the floor. */
  readonly peak: number;
  /** Ranked wins in a row this season. */
  readonly streak: number;
}

export interface LaurelsChange {
  readonly before: Standing;
  readonly after: Standing;
  /** Laurels won (positive) or lost (negative), after the floor. */
  readonly delta: number;
}

const clamp = (value: number, range: LaurelRange) =>
  Math.max(range.min, Math.min(range.max, Math.round(value)));

/**
 * The laurels of a ranked joust, from both ratings as they stood before it. Beating a stronger
 * opponent brings more, losing to one costs less; a draw changes nothing and breaks the streak.
 */
export function joustLaurels(
  rules: LeagueRules,
  standing: Standing,
  input: {
    readonly outcome: "won" | "lost" | "draw";
    readonly rating: number;
    readonly opponentRating: number;
  },
): LaurelsChange {
  const gap = (input.opponentRating - input.rating) / rules.ratingSpread;
  if (input.outcome === "draw") {
    return { before: standing, after: { ...standing, streak: 0 }, delta: 0 };
  }
  if (input.outcome === "won") {
    const streak = standing.streak + 1;
    const won = clamp(rules.win.base + gap * (rules.win.max - rules.win.base), rules.win);
    const delta = streak >= rules.streakFrom ? won + rules.streakBonus : won;
    const laurels = standing.laurels + delta;
    return {
      before: standing,
      after: { laurels, peak: Math.max(standing.peak, laurels), streak },
      delta,
    };
  }
  const lost = clamp(rules.loss.base - gap * (rules.loss.max - rules.loss.base), rules.loss);
  const laurels = Math.max(floorOf(rules, standing.peak), standing.laurels - lost);
  return {
    before: standing,
    after: { laurels, peak: standing.peak, streak: 0 },
    delta: laurels - standing.laurels,
  };
}

// --- From one season to the next -----------------------------------------------------------------

/** A season the player played, as it ended or stands. */
export interface SeasonPlayed {
  readonly season: number;
  readonly laurels: number;
}

/**
 * Where the player starts a season: the start of the league below the one they reached in their
 * last season played, one league lower again for each season they skipped since.
 */
export function seasonStart(rules: LeagueRules, last: SeasonPlayed | null, season: number): number {
  if (last === null || last.season >= season) return 0;
  const reached = LEAGUES.indexOf(leagueOf(rules, last.laurels));
  const league = LEAGUES[Math.max(0, reached - (season - last.season))] ?? "page";
  return rules.leagueFrom[league];
}

/** The standing of a season not played yet. */
export function freshStanding(
  rules: LeagueRules,
  last: SeasonPlayed | null,
  season: number,
): Standing {
  const laurels = seasonStart(rules, last, season);
  return { laurels, peak: laurels, streak: 0 };
}

// --- Rewards -------------------------------------------------------------------------------------

/** A league reward: `step` is a division's index, or 0 for the season's end. */
export interface LeagueRewardKey {
  readonly season: number;
  readonly step: number;
}

export const SEASON_END_STEP = 0;

/** What reaching a division gives: a league's first division gives the league's reward. */
export function divisionRewards(rules: LeagueRules, division: Division): readonly LevelReward[] {
  const opensLeague = division.rank === null || division.rank === rules.divisionsPerLeague;
  return opensLeague ? rules.leagueRewards : rules.divisionRewards;
}

/** What a step gives; empty for a step that does not exist. */
export function leagueStepRewards(
  rules: LeagueRules,
  step: number,
  league: League,
): readonly LevelReward[] {
  if (step === SEASON_END_STEP) return rules.seasonRewards[league];
  const division = divisions(rules)[step];
  return division === undefined || step < 1 ? [] : divisionRewards(rules, division);
}

/**
 * The divisions a season rewards: those reached above the one it started in. The starting
 * division and the ones below were not climbed this season.
 */
export function rewardedDivisions(
  rules: LeagueRules,
  started: number,
  peak: number,
): readonly Division[] {
  const from = divisionOf(rules, started).index;
  const to = divisionOf(rules, peak).index;
  return divisions(rules).filter((division) => division.index > from && division.index <= to);
}

/** A season the player played: where it started and the most laurels held. */
export interface SeasonStanding {
  readonly season: number;
  readonly started: number;
  readonly laurels: number;
  readonly peak: number;
}

/**
 * The league rewards still to claim, oldest first: the divisions reached in each season played,
 * and the end of every season over.
 */
export function pendingLeagueRewards(
  rules: LeagueRules,
  seasons: readonly SeasonStanding[],
  claimed: readonly LeagueRewardKey[],
  currentSeason: number,
): LeagueRewardKey[] {
  const done = new Set(claimed.map((key) => `${key.season}:${key.step}`));
  const pending: LeagueRewardKey[] = [];
  for (const standing of [...seasons].sort((a, b) => a.season - b.season)) {
    const keys = rewardedDivisions(rules, standing.started, standing.peak).map((division) => ({
      season: standing.season,
      step: division.index,
    }));
    if (standing.season < currentSeason) {
      keys.push({ season: standing.season, step: SEASON_END_STEP });
    }
    for (const key of keys) if (!done.has(`${key.season}:${key.step}`)) pending.push(key);
  }
  return pending;
}
