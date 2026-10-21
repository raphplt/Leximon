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
  /**
   * Distinct cards on each side of an offer, one copy each, by account level (P59): each step
   * applies from its level on. An offer is limited by the lower level of its two players.
   */
  readonly cardsPerSide: readonly [CardsPerSideStep, ...CardsPerSideStep[]];
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

export interface CardsPerSideStep {
  readonly fromLevel: number;
  readonly maxCards: number;
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
  return holding.quantity >= 2 && now >= tradeableFrom(rules, holding);
}

/**
 * When a duplicate becomes tradeable: at once, or after the wait of rare cards. Meaningful only
 * for a card held in two copies or more.
 */
export function tradeableFrom(rules: TradeRules, holding: Holding): EpochMs {
  return isAtLeast(holding.rarity, rules.heldRarity)
    ? holding.lastObtainedAt + rules.heldForMs
    : Number.MIN_SAFE_INTEGER;
}

/** Cards each side of an offer may hold for a player of this level (P59). */
export function maxCardsPerSide(rules: TradeRules, level: number): number {
  let max = 0;
  for (const step of rules.cardsPerSide) {
    if (level >= step.fromLevel) max = Math.max(max, step.maxCards);
  }
  return max;
}

/** Cards each side of an offer between these two players may hold: the lower level decides. */
export function maxCardsBetween(rules: TradeRules, xpA: number, xpB: number): number {
  return maxCardsPerSide(rules, Math.min(levelOf(xpA).level, levelOf(xpB).level));
}

/** Shape of an offer, before looking at anyone's collection. */
export function checkOfferShape(
  give: readonly string[],
  want: readonly string[],
  maxCards: number,
): TradeRefusal | null {
  if (give.length === 0 || want.length === 0) return "empty_side";
  if (give.length > maxCards || want.length > maxCards) {
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
  if (
    !isAccountOldEnough(rules, check.proposerCreatedAt, now) ||
    !isAccountOldEnough(rules, check.recipientCreatedAt, now)
  ) {
    return "account_too_recent";
  }
  if (!isLevelHighEnough(rules, check.proposerXp) || !isLevelHighEnough(rules, check.recipientXp)) {
    return "level_too_low";
  }
  // After the level check: below the trade level, the scale allows no card at all.
  const shape = checkOfferShape(
    check.give,
    check.want,
    maxCardsBetween(rules, check.proposerXp, check.recipientXp),
  );
  if (shape !== null) return shape;
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
