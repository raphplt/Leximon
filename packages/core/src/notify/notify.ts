/**
 * E-mail notifications: news (someone wrote to the player) and reminders (the player stays away
 * while their sachets are full). Few and spaced out: a player who plays every day never gets a
 * reminder, and nobody gets more than one e-mail of each kind per day in Paris.
 */

import { gameDayOf, gameHourOf, gameTimeOn } from "../bonus/bonus";
import type { EpochMs } from "../booster/refill";

export interface NotifyRules {
  /** Period start; the rules in force when an e-mail would leave apply. */
  readonly startsAt: EpochMs;
  /**
   * Days of absence, counted in calendar days in Paris since the last visit, on which a
   * reminder leaves. After the last one, no more reminders until the player comes back.
   */
  readonly reminderDays: readonly [number, ...number[]];
  /** Hour in Paris when reminders leave. */
  readonly reminderHour: number;
  /** A letter waits this long before its e-mail: a player still in the game reads it there. */
  readonly newsDelayMs: number;
  /** Nothing leaves from this hour in Paris… */
  readonly quietFromHour: number;
  /** …until this one, the next morning. */
  readonly quietUntilHour: number;
}

export type NotifySchedule = readonly [NotifyRules, ...NotifyRules[]];

export function notifyRulesAt(schedule: NotifySchedule, time: EpochMs): NotifyRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** Calendar days in Paris from the day of `lastSeenAt` to the day of `now`. */
export function absenceDays(lastSeenAt: EpochMs, now: EpochMs): number {
  const from = gameDayOf(lastSeenAt).key;
  const to = gameDayOf(now).key;
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
}

/** Which reminder is due today, by its days of absence, or `null` if none. */
export function reminderStep(rules: NotifyRules, lastSeenAt: EpochMs, now: EpochMs): number | null {
  const days = absenceDays(lastSeenAt, now);
  return rules.reminderDays.includes(days) ? days : null;
}

/** Whether `step` is the last reminder: the e-mail says no other one follows. */
export function isLastReminder(rules: NotifyRules, step: number): boolean {
  return step >= Math.max(...rules.reminderDays);
}

/** The Paris days on which a player last seen then gets a reminder today, oldest first. */
export function reminderSeenDays(rules: NotifyRules, now: EpochMs): readonly string[] {
  const today = gameDayOf(now).key;
  return [...rules.reminderDays]
    .sort((a, b) => b - a)
    .map((days) => gameDayOf(gameTimeOn(today, 12) - days * 86_400_000).key);
}

/** When an e-mail may leave: now, or the end of the quiet hours. */
export function sendableAt(rules: NotifyRules, now: EpochMs): EpochMs {
  const hour = gameHourOf(now);
  const today = gameDayOf(now).key;
  if (hour >= rules.quietFromHour) {
    const tomorrow = gameDayOf(gameDayOf(now).end).key;
    return gameTimeOn(tomorrow, rules.quietUntilHour);
  }
  if (hour < rules.quietUntilHour) return gameTimeOn(today, rules.quietUntilHour);
  return now;
}
