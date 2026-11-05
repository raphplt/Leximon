/**
 * The welcome week: seven days of gifts for a player with an account, one a day they come back.
 * Days need not follow each other and nothing is lost by skipping one: the next day simply waits.
 * What each day gives is known in advance, and stored as given when claimed.
 *
 * Concurrency: these functions are pure. Callers apply a claim under the player's wallet lock.
 */

import type { EpochMs } from "../booster/refill";
import type { LevelReward } from "./rewards";

export interface WelcomeRules {
  /** Period start; the rules in force when a day is claimed apply. */
  readonly startsAt: EpochMs;
  /** What each day gives, day 1 first. */
  readonly days: readonly (readonly LevelReward[])[];
}

export type WelcomeSchedule = readonly [WelcomeRules, ...WelcomeRules[]];

export function welcomeRulesAt(schedule: WelcomeSchedule, time: EpochMs): WelcomeRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** A day claimed: its number and the Paris day ("2026-11-05") it was claimed on. */
export interface WelcomeClaim {
  readonly day: number;
  readonly on: string;
}

/**
 * Where a player stands: the next day to claim, `open` today or once tomorrow comes (one day
 * claimed a calendar day), or the week `done`.
 */
export type WelcomeState =
  | { readonly kind: "open"; readonly day: number }
  | { readonly kind: "tomorrow"; readonly day: number }
  | { readonly kind: "done" };

/** Days are claimed in order, so the next one follows the highest claimed. */
export function welcomeState(
  rules: WelcomeRules,
  claims: readonly WelcomeClaim[],
  today: string,
): WelcomeState {
  const day = claims.reduce((highest, claim) => Math.max(highest, claim.day), 0) + 1;
  if (day > rules.days.length) return { kind: "done" };
  return claims.some((claim) => claim.on === today)
    ? { kind: "tomorrow", day }
    : { kind: "open", day };
}

/** What a day gives; empty outside the week. */
export function welcomeRewards(rules: WelcomeRules, day: number): readonly LevelReward[] {
  return Number.isSafeInteger(day) && day >= 1 ? (rules.days[day - 1] ?? []) : [];
}
