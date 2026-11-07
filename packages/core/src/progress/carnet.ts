/**
 * The carnet: a lifelong reward for coming back, after the welcome week. Time is cut into periods
 * of a fixed number of days (Paris time), one carnet each; every day played in a period fills one
 * case, days need not follow each other. What each case gives is known in advance. Nothing is
 * lost: a case earned and not claimed is still claimed after its period ends.
 *
 * Concurrency: these functions are pure. Callers apply a claim under the player's wallet lock.
 */

import type { EpochMs } from "../booster/refill";
import type { LevelReward } from "./rewards";

export interface CarnetRules {
  /** Period start; the rules in force when a case is claimed apply. */
  readonly startsAt: EpochMs;
  /** First day (Paris, "2026-11-09") of period 0; the periods before have negative numbers. */
  readonly firstPeriodDay: string;
  readonly periodDays: number;
  /** What each case gives, case 1 first; as many cases as days in a period. */
  readonly cases: readonly (readonly LevelReward[])[];
}

export type CarnetSchedule = readonly [CarnetRules, ...CarnetRules[]];

export function carnetRulesAt(schedule: CarnetSchedule, time: EpochMs): CarnetRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

const DAY_MS = 86_400_000;

function timeOf(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function keyOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export interface CarnetPeriod {
  readonly index: number;
  /** First and last day of the period, Paris time. */
  readonly firstDay: string;
  readonly lastDay: string;
}

/** A calendar of periods of a fixed number of days: the carnet's, and the jousts' seasons. */
export type PeriodCalendar = Pick<CarnetRules, "firstPeriodDay" | "periodDays">;

export function carnetPeriodOf(rules: PeriodCalendar, day: string): CarnetPeriod {
  const index = Math.floor(
    Math.round((timeOf(day) - timeOf(rules.firstPeriodDay)) / DAY_MS) / rules.periodDays,
  );
  return periodAt(rules, index);
}

export function periodAt(rules: PeriodCalendar, index: number): CarnetPeriod {
  const first = timeOf(rules.firstPeriodDay) + index * rules.periodDays * DAY_MS;
  return {
    index,
    firstDay: keyOf(first),
    lastDay: keyOf(first + (rules.periodDays - 1) * DAY_MS),
  };
}

/** A case claimed: its period and its number. */
export interface CarnetClaim {
  readonly period: number;
  readonly case: number;
}

/** Of a period: the cases earned by days played, and the ones claimed. */
export interface CarnetPage {
  readonly period: CarnetPeriod;
  readonly earned: number;
  readonly claimed: number;
}

/**
 * The pages of a player's carnet, oldest first: every period with a case earned. The carnet
 * starts the first day played after `startsAfter`, the day the welcome week ended; `null` while it
 * goes on. Cases are claimed in order within a page.
 */
export function carnetPages(
  rules: CarnetRules,
  startsAfter: string | null,
  played: ReadonlySet<string>,
  claims: readonly CarnetClaim[],
  today: string,
): CarnetPage[] {
  if (startsAfter === null) return [];
  const earned = new Map<number, number>();
  for (const day of played) {
    if (day <= startsAfter || day > today) continue;
    const { index } = carnetPeriodOf(rules, day);
    earned.set(index, Math.min(rules.cases.length, (earned.get(index) ?? 0) + 1));
  }
  return [...earned.keys()]
    .sort((a, b) => a - b)
    .map((index) => ({
      period: periodAt(rules, index),
      earned: earned.get(index) ?? 0,
      claimed: claims.filter((claim) => claim.period === index).length,
    }));
}

/** The next case to claim, oldest page first; `null` when every case earned is claimed. */
export function nextCarnetCase(pages: readonly CarnetPage[]): CarnetClaim | null {
  const page = pages.find((candidate) => candidate.claimed < candidate.earned);
  return page === undefined ? null : { period: page.period.index, case: page.claimed + 1 };
}

/** What a case gives; empty outside the carnet. */
export function carnetRewards(rules: CarnetRules, caseNumber: number): readonly LevelReward[] {
  return Number.isSafeInteger(caseNumber) && caseNumber >= 1
    ? (rules.cases[caseNumber - 1] ?? [])
    : [];
}
