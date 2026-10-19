/**
 * R&D: collection progress simulation (docs/rnd/collection-sim.md).
 * Throwaway code: never imported by apps/ or packages/.
 *
 * Reuses the real draw rules from packages/core for rarities and pity, then picks the card
 * itself here, so that a duplicate-protection variant can be compared with the current rule.
 */
import {
  byRarity,
  type CardPool,
  createSeededRandom,
  DRAW_SCHEDULE,
  drawBooster,
  type PityCounters,
  type PityRule,
  RARITIES,
  type RandomSource,
  type Rarity,
  randomInt,
} from "../../packages/core/src/index";

export const PYRAMID: Readonly<Record<Rarity, number>> = {
  common: 0.4,
  uncommon: 0.25,
  rare: 0.17,
  precious: 0.1,
  epic: 0.06,
  legendary: 0.02,
};

export interface Scenario {
  readonly label: string;
  readonly catalogSize: number;
  readonly boostersPerDay: number;
  readonly duplicateProtection: boolean;
  /** Share of duplicates that eventually find a trade for a missing card of the same rarity. */
  readonly tradeRate: number;
  readonly days: number;
  readonly players: number;
  /** Guarantees to simulate; defaults to the launch rules of packages/core. */
  readonly pity?: readonly PityRule[];
}

export interface PlayerResult {
  firstEpicDay: number | null;
  firstLegendaryDay: number | null;
  /** Day each rarity tier was completed, or null. */
  tierCompletedDay: Record<Rarity, number | null>;
  /** Share of distinct cards owned at checkpoints (days). */
  ownedShareAt: Map<number, number>;
  /** Share of cards received during the first 30 days that were duplicates (before trades). */
  duplicateShare: number;
  epicPer100Boosters: number;
  legendaryPer100Boosters: number;
}

const CHECKPOINTS = [7, 30, 90, 180, 365, 730, 1095];
/** Duplicates are measured over the first month, when they matter to a new player. */
const DUPLICATE_WINDOW_DAYS = 30;
const PROTECTED_FROM: Rarity = "precious";

export function catalogCounts(size: number): Record<Rarity, number> {
  return byRarity((rarity) => Math.max(1, Math.round(size * PYRAMID[rarity])));
}

function hexSeed(n: number): string {
  return n.toString(16).padStart(32, "0");
}

export function simulatePlayer(scenario: Scenario, seed: number): PlayerResult {
  const counts = catalogCounts(scenario.catalogSize);
  // Card ids only matter by index here: the pool holds one placeholder per card.
  const pool: CardPool = byRarity((rarity) =>
    Array.from({ length: counts[rarity] }, (_, i) => `${rarity}:${i}`),
  );
  const owned = byRarity((rarity) => new Uint32Array(counts[rarity]));
  const ownedDistinct = byRarity(() => 0);
  const missing = byRarity((rarity) => Array.from({ length: counts[rarity] }, (_, i) => i));
  const random = createSeededRandom(hexSeed(seed + 1));
  const rules = { ...DRAW_SCHEDULE[0], pity: scenario.pity ?? DRAW_SCHEDULE[0].pity };

  const result: PlayerResult = {
    firstEpicDay: null,
    firstLegendaryDay: null,
    tierCompletedDay: byRarity(() => null),
    ownedShareAt: new Map(),
    duplicateShare: 0,
    epicPer100Boosters: 0,
    legendaryPer100Boosters: 0,
  };
  const catalogTotal = RARITIES.reduce((sum, r) => sum + counts[r], 0);
  let pity: PityCounters = {};
  let boostersOpened = 0;
  let epics = 0;
  let legendaries = 0;
  let cardsReceived = 0;
  let duplicates = 0;
  const tradeCredit = byRarity(() => 0);

  const gain = (rarity: Rarity, index: number, day: number) => {
    const copies = owned[rarity];
    if (copies[index] === 0) {
      ownedDistinct[rarity]++;
      removeMissing(missing[rarity], index);
      if (ownedDistinct[rarity] === counts[rarity] && result.tierCompletedDay[rarity] === null) {
        result.tierCompletedDay[rarity] = day;
      }
    } else {
      duplicates++;
      tradeCredit[rarity] += scenario.tradeRate;
    }
    copies[index] = (copies[index] ?? 0) + 1;
  };

  for (let day = 1; day <= scenario.days; day++) {
    for (let b = 0; b < scenario.boostersPerDay; b++) {
      const draw = drawBooster(rules, pool, pity, random);
      pity = draw.pityCounters;
      boostersOpened++;
      for (const card of draw.cards) {
        cardsReceived++;
        const rarity = card.rarity;
        const index = pickIndex(scenario, rarity, counts[rarity], missing[rarity], random);
        gain(rarity, index, day);
        if (rarity === "epic") {
          epics++;
          if (result.firstEpicDay === null) result.firstEpicDay = day;
        }
        if (rarity === "legendary") {
          legendaries++;
          if (result.firstLegendaryDay === null) result.firstLegendaryDay = day;
        }
      }
    }
    // Trades: accumulated credit turns duplicates into missing cards of the same rarity.
    for (const rarity of RARITIES) {
      while (tradeCredit[rarity] >= 1 && missing[rarity].length > 0) {
        tradeCredit[rarity] -= 1;
        const pick = missing[rarity][randomInt(random, missing[rarity].length)] ?? 0;
        gain(rarity, pick, day);
        duplicates--; // the traded-away copy leaves the collection
      }
    }
    if (CHECKPOINTS.includes(day)) {
      const total = RARITIES.reduce((sum, r) => sum + ownedDistinct[r], 0);
      result.ownedShareAt.set(day, total / catalogTotal);
    }
    if (day === DUPLICATE_WINDOW_DAYS) {
      result.duplicateShare = cardsReceived === 0 ? 0 : duplicates / cardsReceived;
    }
  }
  result.epicPer100Boosters = (100 * epics) / Math.max(1, boostersOpened);
  result.legendaryPer100Boosters = (100 * legendaries) / Math.max(1, boostersOpened);
  return result;
}

function pickIndex(
  scenario: Scenario,
  rarity: Rarity,
  count: number,
  missingOfRarity: number[],
  random: RandomSource,
): number {
  const protectedTier = RARITIES.indexOf(rarity) >= RARITIES.indexOf(PROTECTED_FROM);
  if (scenario.duplicateProtection && protectedTier && missingOfRarity.length > 0) {
    return missingOfRarity[randomInt(random, missingOfRarity.length)] ?? 0;
  }
  return randomInt(random, count);
}

/** O(n) removal is fine: only happens once per distinct card. */
function removeMissing(list: number[], index: number): void {
  const position = list.indexOf(index);
  if (position >= 0) {
    list[position] = list[list.length - 1] ?? index;
    list.pop();
  }
}

export interface Summary {
  readonly scenario: Scenario;
  readonly firstEpicMedianDay: number | null;
  readonly firstEpicP90Day: number | null;
  readonly firstLegendaryP99Day: number | null;
  readonly epicPer100: number;
  readonly legendaryPer100: number;
  readonly firstLegendaryMedianDay: number | null;
  readonly firstLegendaryP90Day: number | null;
  readonly tierMedianDay: Record<Rarity, number | null>;
  readonly ownedShareMedianAt: Record<number, number>;
  readonly duplicateShareMedian: number;
}

export function summarize(scenario: Scenario): Summary {
  const results = Array.from({ length: scenario.players }, (_, i) => simulatePlayer(scenario, i));
  return {
    scenario,
    firstEpicP90Day: quantile(
      results.map((r) => r.firstEpicDay),
      0.9,
    ),
    firstLegendaryP99Day: quantile(
      results.map((r) => r.firstLegendaryDay),
      0.99,
    ),
    epicPer100: mean(results.map((r) => r.epicPer100Boosters)),
    legendaryPer100: mean(results.map((r) => r.legendaryPer100Boosters)),
    firstEpicMedianDay: quantile(
      results.map((r) => r.firstEpicDay),
      0.5,
    ),
    firstLegendaryMedianDay: quantile(
      results.map((r) => r.firstLegendaryDay),
      0.5,
    ),
    firstLegendaryP90Day: quantile(
      results.map((r) => r.firstLegendaryDay),
      0.9,
    ),
    tierMedianDay: byRarity((rarity) =>
      quantile(
        results.map((r) => r.tierCompletedDay[rarity]),
        0.5,
      ),
    ),
    ownedShareMedianAt: Object.fromEntries(
      CHECKPOINTS.filter((d) => d <= scenario.days).map((d) => [
        d,
        quantile(
          results.map((r) => r.ownedShareAt.get(d) ?? 0),
          0.5,
        ) ?? 0,
      ]),
    ),
    duplicateShareMedian:
      quantile(
        results.map((r) => r.duplicateShare),
        0.5,
      ) ?? 0,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

/** Quantile where `null` (never happened within the horizon) counts as +infinity. */
function quantile(values: (number | null)[], q: number): number | null {
  const sorted = values.map((v) => v ?? Number.POSITIVE_INFINITY).sort((a, b) => a - b);
  const value = sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return value === undefined || !Number.isFinite(value) ? null : value;
}
