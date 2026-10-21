/**
 * Bonus boosters ("plis bonus") earned through challenges.
 *
 * Two events earn them: reaching the daily goal (enough answers, enough of them right, within one
 * calendar day in Paris) and raising a card to the gilded level. They go to a reserve kept apart
 * from the free stock, with its own cap: a bonus beyond the cap is lost, never queued. The reserve
 * is spent only when the free stock is empty, so a bonus never holds back the free refill.
 *
 * Concurrency: these functions are pure. Callers serialize the updates of a player's reserve by
 * holding the row lock of their wallet.
 */

import {
  type BoosterWallet,
  type ConsumeResult,
  computeRefill,
  consumeBooster,
  type EpochMs,
  type RefillSchedule,
  type RefillState,
} from "../booster/refill";

export const BONUS_KINDS = ["daily", "gilded"] as const;
export type BonusKind = (typeof BONUS_KINDS)[number];

/**
 * Days of the daily goal follow the clock of the players the game is made for. Not part of the
 * dated rules: changing it would shift day boundaries and let a day be counted twice.
 */
export const BONUS_TIME_ZONE = "Europe/Paris";

export interface BonusRules {
  /** Period start; the rules in force at the time of each answer apply. */
  readonly startsAt: EpochMs;
  /** The daily goal: at least this many answers in a day, at least this many of them right. */
  readonly dailyGoal: { readonly answers: number; readonly correct: number };
  /** Bonus boosters for reaching the daily goal, once a day. */
  readonly dailyReward: number;
  /** Bonus boosters for a card reaching the gilded level, once per card. */
  readonly gildedReward: number;
  /** Most bonus boosters a reserve can hold. */
  readonly reserveCap: number;
}

export type BonusSchedule = readonly [BonusRules, ...BonusRules[]];

export function bonusRulesAt(schedule: BonusSchedule, time: EpochMs): BonusRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** A calendar day in Paris. */
export interface GameDay {
  /** "2026-10-20": identifies the day, e.g. for the daily bonus. */
  readonly key: string;
  /** First instant of the day. */
  readonly start: EpochMs;
  /** First instant of the next day. */
  readonly end: EpochMs;
}

/** The calendar day in Paris that contains `time`, daylight saving time included. */
export function gameDayOf(time: EpochMs): GameDay {
  const { year, month, day } = zonedParts(time);
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { key, start: zonedMidnight(year, month, day), end: zonedMidnight(year, month, day + 1) };
}

/** Answers given during the current day, including the one being applied. */
export interface DailyTally {
  readonly answers: number;
  readonly correct: number;
}

export function meetsDailyGoal(rules: BonusRules, tally: DailyTally): boolean {
  return tally.answers >= rules.dailyGoal.answers && tally.correct >= rules.dailyGoal.correct;
}

export interface BonusAward {
  readonly kind: BonusKind;
  /** The day for "daily", the card for "gilded": a player earns each award once. */
  readonly awardKey: string;
  readonly amount: number;
}

export interface AnswerBonusInput {
  readonly day: GameDay;
  /** Today's answers, including this one. */
  readonly tally: DailyTally;
  /** The daily bonus has already been awarded today. */
  readonly dailyAwarded: boolean;
  readonly cardId: string;
  /** This answer raised the card to the gilded level. */
  readonly reachedGilded: boolean;
  /** The gilding bonus of this card has already been awarded. */
  readonly gildedAwarded: boolean;
}

/**
 * Bonus boosters earned by one challenge answer. The daily goal is checked against the whole day
 * so far rather than "this answer is the 5th": if the rules change during the day, or an earlier
 * answer missed the award, the next answer still earns it.
 */
export function answerBonuses(rules: BonusRules, input: AnswerBonusInput): BonusAward[] {
  const awards: BonusAward[] = [];
  if (!input.dailyAwarded && rules.dailyReward > 0 && meetsDailyGoal(rules, input.tally)) {
    awards.push({ kind: "daily", awardKey: input.day.key, amount: rules.dailyReward });
  }
  if (input.reachedGilded && !input.gildedAwarded && rules.gildedReward > 0) {
    awards.push({ kind: "gilded", awardKey: input.cardId, amount: rules.gildedReward });
  }
  return awards;
}

export interface CreditedAward extends BonusAward {
  /** Part of `amount` that fitted in the reserve. */
  readonly credited: number;
}

/** Most bonus boosters a player's reserve holds: the cap, plus slots won by level (P58). */
export function reserveCapacity(rules: BonusRules, extraSlots: number): number {
  return rules.reserveCap + extraSlots;
}

/**
 * Adds awards to a reserve, in order, up to its capacity (`reserveCapacity`). A reserve already
 * above it (the cap was lowered since) keeps what it holds: nothing is confiscated.
 */
export function creditReserve(
  capacity: number,
  reserve: number,
  awards: readonly BonusAward[],
): { readonly reserve: number; readonly awards: CreditedAward[] } {
  let current = reserve;
  const credited = awards.map((award) => {
    const next = Math.max(current, Math.min(capacity, current + award.amount));
    const added = next - current;
    current = next;
    return { ...award, credited: added };
  });
  return { reserve: current, awards: credited };
}

/**
 * The bonus reserve: `bonus` boosters, of which `garni` are garni boosters won by level (P58),
 * which hold at least one card of a given rarity. Garni boosters are spent first.
 */
export interface BonusReserve {
  readonly bonus: number;
  readonly garni: number;
}

export type TakeBoosterResult =
  | {
      readonly ok: true;
      readonly state: RefillState;
      readonly reserve: BonusReserve;
      /** The booster came from the bonus reserve, the free stock being empty. */
      readonly fromBonus: boolean;
      /** It was a garni booster. */
      readonly garni: boolean;
    }
  | Extract<ConsumeResult, { ok: false }>;

/** Spends one booster: from the free stock when it has one, otherwise from the bonus reserve. */
export function takeBooster(
  wallet: BoosterWallet,
  reserve: BonusReserve,
  schedule: RefillSchedule,
  now: EpochMs,
): TakeBoosterResult {
  const consumed = consumeBooster(wallet, schedule, now);
  if (consumed.ok) {
    return { ok: true, state: consumed.state, reserve, fromBonus: false, garni: false };
  }
  if (reserve.bonus > 0) {
    const garni = reserve.garni > 0;
    return {
      ok: true,
      state: computeRefill(wallet, schedule, now),
      reserve: { bonus: reserve.bonus - 1, garni: garni ? reserve.garni - 1 : reserve.garni },
      fromBonus: true,
      garni,
    };
  }
  return consumed;
}

let formatter: Intl.DateTimeFormat | undefined;

/** Wall-clock date and time in Paris. The formatter is built once: building it is costly. */
function zonedParts(time: EpochMs) {
  formatter ??= new Intl.DateTimeFormat("en-US", {
    timeZone: BONUS_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const parts: Record<string, number> = {};
  for (const { type, value } of formatter.formatToParts(new Date(time))) {
    if (type !== "literal") parts[type] = Number(value);
  }
  const part = (name: string) => {
    const value = parts[name];
    if (value === undefined) throw new Error(`Missing ${name} in the formatted date`);
    return value;
  };
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/** Offset of Paris from UTC at `time`, in milliseconds (positive east of Greenwich). */
function zoneOffset(time: EpochMs): number {
  const p = zonedParts(time);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - (time - (((time % 1000) + 1000) % 1000));
}

/**
 * The instant of midnight in Paris on a date (`day` may overflow into the next month). Paris
 * changes its clocks at night but never at midnight, so midnight always exists exactly once.
 */
function zonedMidnight(year: number, month: number, day: number): EpochMs {
  const wall = Date.UTC(year, month - 1, day);
  const guess = wall - zoneOffset(wall);
  return wall - zoneOffset(guess);
}
