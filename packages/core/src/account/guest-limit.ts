/**
 * How far a guest plays before signing up: a few boosters to discover the game, then an
 * account is required to open more. Pure; the server counts the guest's opens under the wallet
 * lock, so concurrent requests cannot open one booster too many.
 */

import type { EpochMs } from "../booster/refill";

export interface GuestRules {
  /** Period start; the rules in force at the time of each open apply. */
  readonly startsAt: EpochMs;
  /** Boosters a guest opens, from any source, before an account is required. */
  readonly boostersBeforeSignup: number;
}

export type GuestSchedule = readonly [GuestRules, ...GuestRules[]];

export function guestRulesAt(schedule: GuestSchedule, time: EpochMs): GuestRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** Boosters the guest may still open before signing up; never negative. */
export function guestBoostersLeft(rules: GuestRules, opened: number): number {
  return Math.max(0, rules.boostersBeforeSignup - opened);
}
