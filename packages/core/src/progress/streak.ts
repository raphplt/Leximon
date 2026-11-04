/**
 * The streak: days played in a row (Paris time), a day counting as soon as the player opens a
 * sachet, answers a challenge or plays the riddle. It forgives a few missed days each week on its
 * own, so that a weekend away breaks nothing; one more and it starts again. The total of days
 * played never falls back, and comes first.
 */

import type { EpochMs } from "../booster/refill";

export interface StreakRules {
  readonly startsAt: EpochMs;
  /** Missed days forgiven within one week, Monday to Sunday. */
  readonly forgivenPerWeek: number;
}

export type StreakSchedule = readonly [StreakRules, ...StreakRules[]];

export function streakRulesAt(schedule: StreakSchedule, time: EpochMs): StreakRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export interface Streak {
  /** Days played in the current streak. */
  readonly current: number;
  /** Days played since the first. */
  readonly total: number;
  readonly playedToday: boolean;
}

const DAY_MS = 86_400_000;

/**
 * The streak on `today`, from the days played (keys `YYYY-MM-DD`, Paris time). Today is never a
 * missed day: it is not over.
 */
export function streakOf(rules: StreakRules, played: ReadonlySet<string>, today: string): Streak {
  const playedToday = played.has(today);
  let first: string | null = null;
  for (const day of played) if (day <= today && (first === null || day < first)) first = day;
  const total = [...played].filter((day) => day <= today).length;
  if (first === null) return { current: 0, total, playedToday };

  const firstTime = timeOf(first);
  const missed = new Map<number, number>();
  let current = playedToday ? 1 : 0;
  for (let time = timeOf(today) - DAY_MS; time >= firstTime; time -= DAY_MS) {
    if (played.has(keyOf(time))) {
      current++;
      continue;
    }
    const week = mondayOf(time);
    const count = (missed.get(week) ?? 0) + 1;
    if (count > rules.forgivenPerWeek) break;
    missed.set(week, count);
  }
  return { current, total, playedToday };
}

function timeOf(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function keyOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function mondayOf(time: number): number {
  return time - ((new Date(time).getUTCDay() + 6) % 7) * DAY_MS;
}
