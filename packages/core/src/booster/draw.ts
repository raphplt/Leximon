/**
 * Booster draw: which cards a booster contains.
 *
 * Pure: the caller provides the rules in force, the card pool, the player's pity counters and a
 * seeded random source (see `random.ts`). The same inputs always give the same booster, provided
 * the pool is canonical (`canonicalizePool`).
 */

import { type RandomSource, randomInt } from "../random";
import { byRarity, isAtLeast, RARITIES, type Rarity, rarityRank } from "./rarity";
import type { EpochMs } from "./refill";

export interface DrawRules {
  /** When these rules start. The first rules of a schedule also cover any earlier time. */
  readonly startsAt: EpochMs;
  readonly cardsPerBooster: number;
  /** Relative weight of each rarity for a regular card. Non-negative integers. */
  readonly weights: Readonly<Record<Rarity, number>>;
  /** One card per booster is at least this rare. */
  readonly guaranteedMinRarity: Rarity;
  /** Guarantees against bad luck, each with its own counter. Never shown to players. */
  readonly pity: readonly PityRule[];
}

/** After `afterBoosters - 1` boosters in a row without `minRarity` or better, the next has one. */
export interface PityRule {
  readonly minRarity: Rarity;
  readonly afterBoosters: number;
}

/**
 * Boosters opened in a row without each guaranteed rarity, keyed by the rule's `minRarity`.
 * A missing entry counts as 0.
 */
export type PityCounters = Readonly<Partial<Record<Rarity, number>>>;

/** Draw rules over time, sorted by strictly increasing `startsAt`. */
export type DrawSchedule = readonly [DrawRules, ...DrawRules[]];

/** Card ids available in boosters, grouped by rarity. */
export type CardPool = Readonly<Record<Rarity, readonly string[]>>;

export interface DrawnCard {
  readonly cardId: string;
  readonly rarity: Rarity;
}

export interface BoosterDraw {
  readonly cards: readonly DrawnCard[];
  /** The player's pity counters after this booster, for the guarantees of these rules only. */
  readonly pityCounters: PityCounters;
}

/**
 * Sorts and deduplicates card ids. Draws depend on the order of the pool, so a pool must be
 * canonical for a stored seed to reproduce a booster exactly.
 */
export function canonicalizePool(pool: CardPool): CardPool {
  return byRarity((rarity) => [...new Set(pool[rarity])].sort(compareCodeUnits));
}

/** Stable text form of a canonical pool, meant to be hashed into a fingerprint. */
export function describePool(pool: CardPool): string {
  return JSON.stringify(RARITIES.map((rarity) => [rarity, pool[rarity]]));
}

/** Locale-independent ordering, identical on every runtime and database. */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Rules in force at `time`. */
export function drawRulesAt(schedule: DrawSchedule, time: EpochMs): DrawRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/**
 * Draws one booster.
 *
 * All cards but the last follow `weights`. The last one is at least `guaranteedMinRarity`, or at
 * least the rarest guarantee that is due. A guarantee is met, and its counter reset, by any card
 * of the booster at least that rare: a Legendary also resets the Epic counter. If the pool has no
 * card of the drawn rarity, the nearest more common rarity is used, then the nearest rarer one.
 *
 * @throws {RangeError} on invalid rules, pool or counters: a programming error, not a game outcome.
 */
export function drawBooster(
  rules: DrawRules,
  pool: CardPool,
  pityCounters: PityCounters,
  random: RandomSource,
): BoosterDraw {
  assertValidRules(rules);
  assertValidPool(pool);
  assertValidCounters(pityCounters);

  let lastSlotMinimum = rules.guaranteedMinRarity;
  for (const { minRarity, afterBoosters } of rules.pity) {
    const due = (pityCounters[minRarity] ?? 0) + 1 >= afterBoosters;
    if (due && isAtLeast(minRarity, lastSlotMinimum)) {
      lastSlotMinimum = minRarity;
    }
  }

  const cards: DrawnCard[] = [];
  for (let slot = 0; slot < rules.cardsPerBooster; slot++) {
    const isLastSlot = slot === rules.cardsPerBooster - 1;
    const rarity = pickRarity(rules.weights, isLastSlot ? lastSlotMinimum : RARITIES[0], random);
    cards.push(pickCard(pool, rarity, random));
  }

  const nextCounters: Partial<Record<Rarity, number>> = {};
  for (const { minRarity } of rules.pity) {
    const met = cards.some((card) => isAtLeast(card.rarity, minRarity));
    nextCounters[minRarity] = met ? 0 : (pityCounters[minRarity] ?? 0) + 1;
  }
  return { cards, pityCounters: nextCounters };
}

/** Weighted pick among rarities at least as rare as `minimum`. */
function pickRarity(
  weights: Readonly<Record<Rarity, number>>,
  minimum: Rarity,
  random: RandomSource,
): Rarity {
  const eligible = RARITIES.filter((rarity) => isAtLeast(rarity, minimum));
  const total = eligible.reduce((sum, rarity) => sum + weights[rarity], 0);
  if (total === 0) {
    return minimum;
  }

  let roll = randomInt(random, total);
  for (const rarity of eligible) {
    roll -= weights[rarity];
    if (roll < 0) {
      return rarity;
    }
  }
  // Unreachable: `roll` is below the sum of the eligible weights.
  throw new Error("Invariant violated: weighted pick out of range");
}

/** Uniform pick of a card of `rarity`, falling back to the nearest rarity that has cards. */
function pickCard(pool: CardPool, rarity: Rarity, random: RandomSource): DrawnCard {
  for (const candidate of fallbackOrder(rarity)) {
    const ids = pool[candidate];
    if (ids.length > 0) {
      const cardId = ids[randomInt(random, ids.length)];
      if (cardId !== undefined) {
        return { cardId, rarity: candidate };
      }
    }
  }
  // Unreachable: the pool was checked to contain at least one card.
  throw new Error("Invariant violated: empty card pool");
}

/** `rarity`, then more common rarities from nearest to farthest, then rarer ones. */
function fallbackOrder(rarity: Rarity): Rarity[] {
  const rank = rarityRank(rarity);
  return [...RARITIES.slice(0, rank + 1).reverse(), ...RARITIES.slice(rank + 1)];
}

function assertValidRules(rules: DrawRules): void {
  if (!Number.isSafeInteger(rules.cardsPerBooster) || rules.cardsPerBooster < 1) {
    throw new RangeError(
      `cardsPerBooster must be a positive integer, got ${rules.cardsPerBooster}`,
    );
  }
  let total = 0;
  for (const rarity of RARITIES) {
    const weight = rules.weights[rarity];
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new RangeError(`weight of ${rarity} must be a non-negative integer, got ${weight}`);
    }
    total += weight;
  }
  if (total === 0) {
    throw new RangeError("at least one rarity must have a positive weight");
  }
  const seen = new Set<Rarity>();
  for (const { minRarity, afterBoosters } of rules.pity) {
    if (seen.has(minRarity)) {
      throw new RangeError(`two guarantees for the same rarity: ${minRarity}`);
    }
    seen.add(minRarity);
    if (!Number.isSafeInteger(afterBoosters) || afterBoosters < 1) {
      throw new RangeError(`pity afterBoosters must be a positive integer, got ${afterBoosters}`);
    }
  }
}

function assertValidCounters(counters: PityCounters): void {
  for (const [rarity, value] of Object.entries(counters)) {
    if (!Number.isSafeInteger(value) || (value ?? 0) < 0) {
      throw new RangeError(
        `pity counter for ${rarity} must be a non-negative integer, got ${value}`,
      );
    }
  }
}

function assertValidPool(pool: CardPool): void {
  if (RARITIES.every((rarity) => pool[rarity].length === 0)) {
    throw new RangeError("the card pool is empty");
  }
}
