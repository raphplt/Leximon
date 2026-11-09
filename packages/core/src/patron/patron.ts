/**
 * The patron subscription: the only thing sold, and it never touches progression. Stripe keeps
 * the subscription; these rules read its state to say what the player is given.
 */

import type { EpochMs } from "../booster/refill";

export interface PatronRules {
  /** Period start; the rules in force at the time of each payment apply. */
  readonly startsAt: EpochMs;
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
  /**
   * Month (in Paris, `YYYY-MM`) → the cosmetics every patron who paid for it receives: a matching
   * pair, claimed together.
   */
  readonly cosmetics: Readonly<Record<string, readonly PatronCosmetic[]>>;
  /**
   * Paid months per word to find: a monthly patron earns one with every such run of payments, a
   * yearly one at its payment and at the start of each such stretch of the year.
   */
  readonly monthsPerFind: number;
  /** Pinned cards a paying patron shows beyond those of their levels; gone when they stop. */
  readonly extraPinnedSlots: number;
  /** The library editions every patron owns from their first payment. */
  readonly launchEditions: readonly string[];
  /** Month (in Paris, `YYYY-MM`) → the edition every patron who paid for it owns. */
  readonly editions: Readonly<Record<string, string>>;
  /** Themes the owner offers to the patrons' vote, and the days it stays open. */
  readonly pollThemes: number;
  readonly pollDays: number;
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
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * - `patron`: paid at least once and still subscribed, payments retried included;
 * - `none`: not or no longer subscribed, or the first payment not recorded yet.
 */
export type PatronStanding = "none" | "patron";

export function patronStanding(
  status: SubscriptionStatus | null,
  firstPaidAt: EpochMs | null,
): PatronStanding {
  const subscribed = status === "active" || status === "past_due";
  return subscribed && firstPaidAt !== null ? "patron" : "none";
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

/** Titles a subscriber may wear while subscribed. */
export const PATRON_TITLE = "Mécène";
export const FOUNDER_TITLE = "Mécène fondateur";

/** The mark shown on a profile: a founder keeps it for life, a patron while subscribed. */
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
  readonly cosmetics: readonly PatronCosmetic[];
}

function monthOf(rules: PatronRules, month: string): MonthCosmetic | null {
  const cosmetics = rules.cosmetics[month] ?? [];
  return cosmetics.length === 0 ? null : { month, cosmetics };
}

/** The cosmetics of the current month, shown to everyone from the 1st; never ahead. */
export function monthCosmetic(rules: PatronRules, now: EpochMs): MonthCosmetic | null {
  return monthOf(rules, parisMonthOf(now));
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
    .flatMap((month) => monthOf(rules, month) ?? []);
}

/** `months` calendar months after `time`, in UTC: close enough for a quarter of a paid year. */
function addMonths(time: EpochMs, months: number): EpochMs {
  const date = new Date(time);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
}

/**
 * The words a patron earned the right to find, up to now. A yearly payment gives one at once,
 * then one at the start of each stretch of `monthsPerFind` months it covers. Monthly payments
 * give one with the first, then one every `monthsPerFind` payments: a patron finds a word from
 * the first month. Payments are counted over the whole account, so stopping and coming back
 * does not give a word again. Refunded periods give nothing.
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
  return earned + Math.ceil(monthly / rules.monthsPerFind);
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

/**
 * The library editions a player owns, for life: those of the launch from a first payment, then
 * each month's for the months paid. Nothing to claim, and a refunded period gives nothing.
 */
export function ownedEditions(
  rules: Pick<PatronRules, "launchEditions" | "editions">,
  periods: readonly PaidPeriod[],
  now: EpochMs,
): string[] {
  const months = paidMonths(periods, now);
  if (months.size === 0) return [];
  const owned = new Set(rules.launchEditions);
  for (const month of [...months].sort()) {
    const edition = rules.editions[month];
    if (edition !== undefined) owned.add(edition);
  }
  return [...owned];
}

/**
 * The edition a card is printed in: the card's own choice when there is one, `null` meaning the
 * ordinary print, else the album's. An edition no longer owned prints nothing.
 */
export function cardEditionOf(
  choice: { readonly album: string | null; readonly card: string | null | undefined },
  owned: ReadonlySet<string>,
): string | null {
  const edition = choice.card === undefined ? choice.album : choice.card;
  return edition !== null && owned.has(edition) ? edition : null;
}

/**
 * The theme a vote chose: the one with the most voices. `null` without a voice, or when two
 * themes tie for first: the owner then decides.
 */
export function pollWinner(votes: readonly number[]): number | null {
  const most = Math.max(0, ...votes);
  if (most === 0) return null;
  const first = votes.indexOf(most);
  return votes.indexOf(most, first + 1) === -1 ? first : null;
}
