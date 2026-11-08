/**
 * The patron subscription: the only thing sold, and it never touches progression. Stripe keeps
 * the subscription; these rules read its state to say what the player is given.
 */

import type { EpochMs } from "../booster/refill";

export interface PatronRules {
  /** Period start; the rules in force at the time of each payment apply. */
  readonly startsAt: EpochMs;
  /** Free days before the first payment, once per account. */
  readonly trialDays: number;
  /**
   * The month (in Paris, `YYYY-MM`) whose first payments make founders: the first month of sales.
   * `null` until sales open.
   */
  readonly foundingMonth: string | null;
}

export type PatronSchedule = readonly [PatronRules, ...PatronRules[]];

export function patronRulesAt(schedule: PatronSchedule, time: EpochMs): PatronRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export const PATRON_PLANS = ["monthly", "yearly"] as const;
export type PatronPlan = (typeof PATRON_PLANS)[number];

/** A subscription's status, as Stripe names it. */
export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * - `patron`: paid at least once and still subscribed, payments retried included;
 * - `trial`: subscribed, nothing paid yet: the title and the badge only, so that trials taken one
 *   after the other harvest nothing;
 * - `none`: not or no longer subscribed.
 */
export type PatronStanding = "none" | "trial" | "patron";

export function patronStanding(
  status: SubscriptionStatus | null,
  firstPaidAt: EpochMs | null,
): PatronStanding {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
    case "past_due":
      // A first payment that fails at the end of the trial is retried: still a trial meanwhile.
      return firstPaidAt === null ? "trial" : "patron";
    default:
      return "none";
  }
}

/** Patron days follow the clock of the players the game is made for, like the other days. */
export const PATRON_TIME_ZONE = "Europe/Paris";

const monthFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: PATRON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

/** The month of a time in Paris, as `YYYY-MM`. */
export function parisMonthOf(time: EpochMs): string {
  const parts = monthFormat.formatToParts(time);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

/** A first payment within the founding month makes a founder, for life. */
export function isFoundingPayment(rules: PatronRules, paidAt: EpochMs): boolean {
  return rules.foundingMonth !== null && parisMonthOf(paidAt) === rules.foundingMonth;
}
