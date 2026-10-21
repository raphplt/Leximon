/**
 * Features opened by the account level (P59). A closed feature stays visible with the level that
 * opens it: the level is a promise, not a wall. Discovery boosters, the album and challenges are
 * never closed.
 *
 * Trade levels live in the trade rules (`TRADE_SCHEDULE`), which the server applies to every
 * offer: they are read from there, so that one setting never has two values.
 */

import type { EpochMs } from "../booster/refill";
import { type TradeSchedule, tradeRulesAt } from "../trade/trade";

export const FEATURES = [
  "choose_collection",
  "trade",
  "public_profile",
  "trade_three",
  "join_clan",
  "create_clan",
  "jousts",
] as const;
export type Feature = (typeof FEATURES)[number];

type OwnFeature = Exclude<Feature, "trade" | "trade_three">;

export interface UnlockRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  readonly levels: Readonly<Record<OwnFeature, number>>;
}

export type UnlockSchedule = readonly [UnlockRules, ...UnlockRules[]];

export function unlockRulesAt(schedule: UnlockSchedule, time: EpochMs): UnlockRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** The level that opens each feature, at `time`. */
export function featureLevels(
  unlocks: UnlockSchedule,
  trades: TradeSchedule,
  time: EpochMs,
): Readonly<Record<Feature, number>> {
  const own = unlockRulesAt(unlocks, time).levels;
  const trade = tradeRulesAt(trades, time);
  // The level of the widest trades: the highest step of the cards-per-side scale.
  const widest = trade.cardsPerSide.reduce((best, step) =>
    step.maxCards > best.maxCards ? step : best,
  );
  return {
    ...own,
    trade: trade.minLevel,
    trade_three: Math.max(trade.minLevel, widest.fromLevel),
  };
}

/** Features opened exactly at `level`, in the order of `FEATURES`. */
export function featuresOpenedAt(
  levels: Readonly<Record<Feature, number>>,
  level: number,
): Feature[] {
  return FEATURES.filter((feature) => levels[feature] === level);
}
