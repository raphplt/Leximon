/**
 * Practice: a series on a scope the player picks (a collection, a theme, the words they missed).
 * Words due and words never reviewed come first and count as a normal review. The others are free
 * practice: a word seen too early teaches the memory model nothing, so they leave it untouched and
 * earn a little XP, capped by day so that practice stays a pleasure, not the fast way up.
 */

import type { EpochMs } from "../booster/refill";
import { type RandomSource, randomInt } from "../random";

export interface PracticeRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  readonly seriesSize: number;
  /** A multiple choice needs four words; a smaller scope is not offered. */
  readonly minWords: number;
  /** How far back a wrong answer makes a word « missed ». */
  readonly missedWindowMs: number;
  /** How many of the last words obtained make the « recent » scope. */
  readonly recentWords: number;
  readonly xpPerAnswer: number;
  readonly dailyXpCap: number;
}

export type PracticeSchedule = readonly [PracticeRules, ...PracticeRules[]];

export function practiceRulesAt(schedule: PracticeSchedule, time: EpochMs): PracticeRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** Longest list of cards a client may send for a series, from a filter of the album. */
export const PRACTICE_MAX_CARDS = 50;

/**
 * Words of a series: due words first (most overdue first), then words never reviewed, then a
 * random pick among the others, which are the only free practice.
 */
export function planPractice(
  random: RandomSource,
  due: readonly string[],
  neverReviewed: readonly string[],
  others: readonly string[],
  size: number,
): { readonly counted: readonly string[]; readonly free: readonly string[] } {
  const counted = [...due, ...neverReviewed].slice(0, size);
  const pool = [...others];
  const free: string[] = [];
  while (counted.length + free.length < size && pool.length > 0) {
    const [picked] = pool.splice(randomInt(random, pool.length), 1);
    if (picked !== undefined) free.push(picked);
  }
  return { counted, free };
}

/** XP of a free practice answer: what is left of today's cap, at most one answer's worth. */
export function practiceXp(
  rules: PracticeRules,
  input: { readonly correct: boolean; readonly earnedToday: number },
): number {
  if (!input.correct) return 0;
  return Math.max(0, Math.min(rules.xpPerAnswer, rules.dailyXpCap - input.earnedToday));
}
