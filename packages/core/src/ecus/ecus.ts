/**
 * Écus: the one currency of the game, earned by playing, never bought, never sold, never turned
 * into money. Duplicates are recycled into écus, and écus buy a missing word, drawn among the
 * words of the player's choice they lack. A sachet is never bought with écus.
 *
 * Concurrency: these functions are pure. Callers apply them under the player's wallet lock.
 */

import type { Rarity } from "../booster/rarity";
import type { EpochMs } from "../booster/refill";
import { type RandomSource, randomInt } from "../random";

/** Why écus moved: a recycling gives, a missing word costs. */
export const ECU_MOVEMENT_KINDS = ["recycle", "missing_word"] as const;
export type EcuMovementKind = (typeof ECU_MOVEMENT_KINDS)[number];

export interface EcuRules {
  /** Period start; the rules in force at the time of each recycling or purchase apply. */
  readonly startsAt: EpochMs;
  /** Écus for one recycled copy, by rarity. */
  readonly recycleValue: Readonly<Record<Rarity, number>>;
  /** Price of a missing word, by rarity. */
  readonly missingWordPrice: Readonly<Record<Rarity, number>>;
  /** Rarities the one-touch recycling takes; the others go only card by card. */
  readonly recycledTogether: readonly Rarity[];
  /** Copies the one-touch recycling always leaves of a card: the card and one double. */
  readonly copiesKept: number;
}

export type EcuSchedule = readonly [EcuRules, ...EcuRules[]];

export function ecuRulesAt(schedule: EcuSchedule, time: EpochMs): EcuRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** Copies of a card a player owns, with the card's rarity. */
export interface OwnedCopies {
  readonly cardId: string;
  readonly rarity: Rarity;
  readonly quantity: number;
}

export interface RecycledCard {
  readonly cardId: string;
  readonly copies: number;
  readonly ecus: number;
}

export interface RecyclePlan {
  /** By card id, so that the copies are locked and written in a fixed order. */
  readonly cards: readonly RecycledCard[];
  readonly copies: number;
  readonly ecus: number;
}

/**
 * The one-touch recycling: every copy beyond the ones kept, of the rarities recycled together.
 * Nothing else is touched.
 */
export function recyclePlan(rules: EcuRules, holdings: readonly OwnedCopies[]): RecyclePlan {
  const cards = holdings
    .filter(
      (holding) =>
        rules.recycledTogether.includes(holding.rarity) && holding.quantity > rules.copiesKept,
    )
    .map((holding) => {
      const copies = holding.quantity - rules.copiesKept;
      return { cardId: holding.cardId, copies, ecus: copies * rules.recycleValue[holding.rarity] };
    })
    .sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));
  return {
    cards,
    copies: cards.reduce((sum, card) => sum + card.copies, 0),
    ecus: cards.reduce((sum, card) => sum + card.ecus, 0),
  };
}

/**
 * Recycling one copy of a card, by the player's explicit choice: any rarity, as long as one copy
 * stays. `null` when the player holds a single copy or none.
 */
export function recycleOne(rules: EcuRules, holding: OwnedCopies): RecycledCard | null {
  if (holding.quantity < 2) return null;
  return { cardId: holding.cardId, copies: 1, ecus: rules.recycleValue[holding.rarity] };
}

/** The missing word drawn among the candidates, `null` when none is missing. */
export function drawMissingWord(
  candidates: readonly string[],
  random: RandomSource,
): string | null {
  if (candidates.length === 0) return null;
  return candidates[randomInt(random, candidates.length)] ?? null;
}
