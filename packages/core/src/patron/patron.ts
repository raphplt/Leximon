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
   * What each plan costs, in cents of euro, as shown to players. Stripe charges its own prices:
   * the two are changed together.
   */
  readonly prices: Readonly<Record<PatronPlan, number>>;
  /**
   * The month (in Paris, `YYYY-MM`) whose first payments make founders: the first month of sales.
   * `null` until sales open.
   */
  readonly foundingMonth: string | null;
  /** Month (in Paris, `YYYY-MM`) → the cosmetic every patron who paid for it receives. */
  readonly cosmetics: Readonly<Record<string, PatronCosmetic>>;
  /**
   * Paid months per word to find: a monthly patron earns one with every such run of payments, a
   * yearly one at its payment and at the start of each such stretch of the year.
   */
  readonly monthsPerFind: number;
}

/** What a patron wears: the same kinds of cosmetics as the level rewards, always named. */
export type PatronCosmetic =
  | { readonly kind: "frame"; readonly frame: string }
  | { readonly kind: "avatar"; readonly avatar: string }
  | { readonly kind: "title"; readonly title: string };

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

/** Titles a subscriber may wear while subscribed, trial included. */
export const PATRON_TITLE = "Mécène";
export const FOUNDER_TITLE = "Mécène fondateur";

/**
 * The mark shown on a profile: a founder keeps it for life, a patron while subscribed (trial
 * included).
 */
export type PatronMark = "founder" | "patron" | null;

export function patronMark(standing: PatronStanding, founder: boolean): PatronMark {
  if (founder) return "founder";
  return standing === "none" ? null : "patron";
}

export function patronTitle(standing: PatronStanding, founder: boolean): string | null {
  if (standing === "none") return null;
  return founder ? FOUNDER_TITLE : PATRON_TITLE;
}

/** A period paid with money; a refunded one gives nothing more. */
export interface PaidPeriod {
  readonly startsAt: EpochMs;
  readonly endsAt: EpochMs;
  readonly refunded: boolean;
  /** Absent where only the months covered matter (cosmetics). */
  readonly plan?: PatronPlan;
}

function nextMonth(month: string): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, "0")}`;
}

/**
 * The months a patron paid for, up to the current one: a month counts when a paid period covers
 * at least one of its days. A yearly subscriber receives each month's cosmetic when it comes.
 */
export function paidMonths(periods: readonly PaidPeriod[], now: EpochMs): Set<string> {
  const months = new Set<string>();
  const current = parisMonthOf(now);
  for (const period of periods) {
    if (period.refunded || period.endsAt <= period.startsAt) continue;
    const last = parisMonthOf(period.endsAt - 1);
    for (let month = parisMonthOf(period.startsAt); month <= last && month <= current; ) {
      months.add(month);
      month = nextMonth(month);
    }
  }
  return months;
}

export interface MonthCosmetic {
  readonly month: string;
  readonly cosmetic: PatronCosmetic;
}

/** The cosmetic of the current month, shown to everyone from the 1st; never one ahead. */
export function monthCosmetic(rules: PatronRules, now: EpochMs): MonthCosmetic | null {
  const month = parisMonthOf(now);
  const cosmetic = rules.cosmetics[month];
  return cosmetic === undefined ? null : { month, cosmetic };
}

/** The cosmetics of the months paid for, not claimed yet, oldest first. */
export function claimableCosmetics(
  rules: PatronRules,
  periods: readonly PaidPeriod[],
  claimed: ReadonlySet<string>,
  now: EpochMs,
): MonthCosmetic[] {
  return [...paidMonths(periods, now)]
    .filter((month) => !claimed.has(month))
    .sort()
    .flatMap((month) => {
      const cosmetic = rules.cosmetics[month];
      return cosmetic === undefined ? [] : [{ month, cosmetic }];
    });
}

/** `months` calendar months after `time`, in UTC: close enough for a quarter of a paid year. */
function addMonths(time: EpochMs, months: number): EpochMs {
  const date = new Date(time);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
}

/**
 * The words a patron earned the right to find, up to now. A yearly payment gives one at once,
 * then one at the start of each stretch of `monthsPerFind` months it covers; monthly payments
 * give one with every `monthsPerFind`-th. Refunded periods give nothing; a trial is no period.
 */
export function earnedFinds(
  rules: Pick<PatronRules, "monthsPerFind">,
  periods: readonly PaidPeriod[],
  now: EpochMs,
): number {
  const paid = periods.filter((period) => !period.refunded && period.startsAt <= now);
  let earned = 0;
  for (const period of paid.filter((period) => period.plan === "yearly")) {
    for (let at = period.startsAt; at < period.endsAt && at <= now; ) {
      earned += 1;
      at = addMonths(at, rules.monthsPerFind);
    }
  }
  const monthly = paid.filter((period) => period.plan === "monthly").length;
  return earned + Math.floor(monthly / rules.monthsPerFind);
}

/**
 * The words a patron may still find. A word found counts against the rights unless the quality
 * check set it aside, which gives the right back. Rights left unused are lost when the
 * subscription stops, except those given back: that word was paid for.
 */
export function findsLeft(input: {
  readonly earned: number;
  /** Words found and kept, waiting or published. */
  readonly used: number;
  /** Words found then set aside by the quality check. */
  readonly returned: number;
  readonly subscribed: boolean;
}): number {
  const left = Math.max(0, input.earned - input.used);
  return input.subscribed ? left : Math.min(left, input.returned);
}

/** A word as the reserve searches it: lower case, without accents nor ligatures. */
export function reserveSearchKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
