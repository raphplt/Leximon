/**
 * Card-for-card trades (D-026): one player offers some of their duplicates to another player in
 * exchange for some of theirs. Nothing is reserved while an offer waits: everything is checked
 * again when it is accepted, and an offer that can no longer be honoured simply fails.
 */

import type { Rarity } from "../booster/rarity";
import { isAtLeast } from "../booster/rarity";
import type { EpochMs } from "../booster/refill";
import { levelOf } from "../progress/progress";

export interface TradeRules {
  /** Period start; the rules in force when an offer is made or accepted apply. */
  readonly startsAt: EpochMs;
  /** An offer not answered within this delay expires. */
  readonly offerTtlMs: number;
  /** Distinct cards on each side of an offer, one copy each. */
  readonly maxCardsPerSide: number;
  /** Offers a player may send over a rolling 24 hours. */
  readonly offersPerDay: number;
  /** Accounts younger than this cannot trade: limits throwaway accounts feeding a main one. */
  readonly minAccountAgeMs: number;
  /** Account level needed to trade (P48), for the same reason. */
  readonly minLevel: number;
  /** Cards at least this rare… */
  readonly heldRarity: Rarity;
  /** …can be traded only this long after the player last obtained a copy. */
  readonly heldForMs: number;
}

export type TradeSchedule = readonly [TradeRules, ...TradeRules[]];

/** What a player holds of one card, as seen by the trade rules. */
export interface Holding {
  readonly cardId: string;
  readonly rarity: Rarity;
  readonly quantity: number;
  readonly lastObtainedAt: EpochMs;
}

export type TradeRefusal =
  | "self_trade"
  | "empty_side"
  | "too_many_cards"
  | "duplicate_card"
  | "account_too_recent"
  | "level_too_low"
  | "daily_limit_reached"
  | "card_not_tradeable";

export function tradeRulesAt(schedule: TradeSchedule, time: EpochMs): TradeRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/**
 * Whether one copy of this card can leave the player's collection now: the player keeps at least
 * one copy (only duplicates are traded), and rare cards must have been held for a while.
 */
export function isTradeable(rules: TradeRules, holding: Holding, now: EpochMs): boolean {
  if (holding.quantity < 2) return false;
  if (isAtLeast(holding.rarity, rules.heldRarity)) {
    return now - holding.lastObtainedAt >= rules.heldForMs;
  }
  return true;
}

/** Shape of an offer, before looking at anyone's collection. */
export function checkOfferShape(
  rules: TradeRules,
  give: readonly string[],
  want: readonly string[],
): TradeRefusal | null {
  if (give.length === 0 || want.length === 0) return "empty_side";
  if (give.length > rules.maxCardsPerSide || want.length > rules.maxCardsPerSide) {
    return "too_many_cards";
  }
  if (new Set(give).size !== give.length || new Set(want).size !== want.length) {
    return "duplicate_card";
  }
  return null;
}

export function isAccountOldEnough(rules: TradeRules, createdAt: EpochMs, now: EpochMs): boolean {
  return now - createdAt >= rules.minAccountAgeMs;
}

export function isLevelHighEnough(rules: TradeRules, xp: number): boolean {
  return levelOf(xp).level >= rules.minLevel;
}

/**
 * Whether a player can give these cards now. `holdings` holds the player's rows for these cards;
 * a missing card is not owned.
 */
export function canGive(
  rules: TradeRules,
  cardIds: readonly string[],
  holdings: ReadonlyMap<string, Holding>,
  now: EpochMs,
): boolean {
  return cardIds.every((cardId) => {
    const holding = holdings.get(cardId);
    return holding !== undefined && isTradeable(rules, holding, now);
  });
}

export interface OfferCheck {
  readonly rules: TradeRules;
  readonly proposerId: string;
  readonly recipientId: string;
  readonly give: readonly string[];
  readonly want: readonly string[];
  readonly proposerCreatedAt: EpochMs;
  readonly recipientCreatedAt: EpochMs;
  readonly proposerXp: number;
  readonly recipientXp: number;
  /** Offers the proposer sent over the last 24 hours. */
  readonly offersSentToday: number;
  readonly proposerHoldings: ReadonlyMap<string, Holding>;
  readonly recipientHoldings: ReadonlyMap<string, Holding>;
  readonly now: EpochMs;
}

/**
 * Checks a new offer. The recipient's side is checked too, so that an offer which cannot be
 * accepted is never sent; it is checked again on acceptance.
 */
export function checkOffer(check: OfferCheck): TradeRefusal | null {
  const { rules, now } = check;
  if (check.proposerId === check.recipientId) return "self_trade";
  const shape = checkOfferShape(rules, check.give, check.want);
  if (shape !== null) return shape;
  if (
    !isAccountOldEnough(rules, check.proposerCreatedAt, now) ||
    !isAccountOldEnough(rules, check.recipientCreatedAt, now)
  ) {
    return "account_too_recent";
  }
  if (!isLevelHighEnough(rules, check.proposerXp) || !isLevelHighEnough(rules, check.recipientXp)) {
    return "level_too_low";
  }
  if (check.offersSentToday >= rules.offersPerDay) return "daily_limit_reached";
  if (
    !canGive(rules, check.give, check.proposerHoldings, now) ||
    !canGive(rules, check.want, check.recipientHoldings, now)
  ) {
    return "card_not_tradeable";
  }
  return null;
}

/** An offer still waiting expires once its delay has passed, without any scheduled task. */
export function isExpired(expiresAt: EpochMs, now: EpochMs): boolean {
  return now >= expiresAt;
}
