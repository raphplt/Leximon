/**
 * R&D: account level pace (docs/rnd/level-sim.md).
 * Throwaway code: never imported by apps/ or packages/.
 *
 * Reuses the real draw rules, XP scale and level rewards of packages/core; the player's habits
 * (boosters a day, challenge answers, trades) are assumptions stated in the report.
 */
import {
  answerXp,
  boosterXp,
  byRarity,
  type CardPool,
  createSeededRandom,
  DRAW_SCHEDULE,
  drawBooster,
  LEVEL_REWARD_SCHEDULE,
  type LevelCurve,
  levelOf,
  levelRewardRulesAt,
  levelRewards,
  type PityCounters,
  type Rarity,
  rewardBoosters,
  XP_SCHEDULE,
  xpRulesAt,
} from "../../packages/core/src/index";

/** Share of each rarity in a collection, as in the published catalogue. */
const PYRAMID: Readonly<Record<Rarity, number>> = {
  common: 0.4,
  uncommon: 0.25,
  rare: 0.17,
  precious: 0.1,
  epic: 0.06,
  legendary: 0.02,
};

export interface Profile {
  readonly name: string;
  readonly boostersPerDay: number;
  /** Days of the week with a challenge session. */
  readonly challengeDaysPerWeek: number;
  readonly correctPerSession: number;
  readonly tradesPerWeek: number;
  /** Opens enough to drain the stock: a refill coffret adds boosters. */
  readonly drainsStock: boolean;
}

export const PROFILES: readonly Profile[] = [
  {
    name: "occasionnel",
    boostersPerDay: 3,
    challengeDaysPerWeek: 3,
    correctPerSession: 4,
    tradesPerWeek: 0,
    drainsStock: false,
  },
  {
    name: "régulier",
    boostersPerDay: 8,
    challengeDaysPerWeek: 7,
    correctPerSession: 8,
    tradesPerWeek: 1,
    drainsStock: false,
  },
  {
    name: "assidu",
    boostersPerDay: 20,
    challengeDaysPerWeek: 7,
    correctPerSession: 20,
    tradesPerWeek: 3,
    drainsStock: true,
  },
];

const LAUNCH_COLLECTIONS = [520, 520, 520];
const NEW_COLLECTION_SIZE = 300;
const NEW_COLLECTION_EVERY_DAYS = 28;
const SHELF_SIZE = 4;
const LAUNCH_WINDOW_DAYS = 28;
const CHOOSE_COLLECTION_LEVEL = 3;
const REFILL_BOOSTERS = 6;
/** No mastery level before a word's memory holds a week. */
const FIRST_MASTERY_DAY = 8;
/** Steady state: about one level (Encre, then Dorure) for every four correct answers. */
const CORRECT_PER_MASTERY_UP = 4;

interface Collection {
  readonly pool: CardPool;
  readonly owned: Set<string>;
  readonly size: number;
  readonly launchDay: number;
}

function makeCollection(index: number, size: number, launchDay: number): Collection {
  const pool = byRarity((rarity) =>
    Array.from(
      { length: Math.max(1, Math.round(size * PYRAMID[rarity])) },
      (_, i) => `${index}:${rarity}:${i}`,
    ),
  );
  return { pool, owned: new Set(), size, launchDay };
}

/** The rotating shelf: the starter, a new collection during its launch, the others by turns. */
function shelf(collections: readonly Collection[], day: number): Collection[] {
  const [starter, ...rest] = collections;
  if (starter === undefined) return [];
  const launching = rest.filter((c) => day - c.launchDay < LAUNCH_WINDOW_DAYS);
  const others = rest.filter((c) => !launching.includes(c));
  const open = [starter, ...launching];
  const week = Math.floor(day / 7);
  for (let i = 0; open.length < SHELF_SIZE && i < others.length; i++) {
    const next = others[(week + i) % others.length];
    if (next !== undefined && !open.includes(next)) open.push(next);
  }
  return open;
}

/** Day (1-based) each level was reached, `null` if never within `days`. */
export function simulatePlayer(
  profile: Profile,
  curve: LevelCurve,
  levels: readonly number[],
  days: number,
  seed: number,
): Map<number, number | null> {
  const random = createSeededRandom(seed.toString(16).padStart(32, "0"));
  const drawRules = DRAW_SCHEDULE[0];
  const xpRules = xpRulesAt(XP_SCHEDULE, Date.UTC(2026, 9, 22));
  const rewardRules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.UTC(2026, 9, 22));
  const collections = LAUNCH_COLLECTIONS.map((size, i) => makeCollection(i, size, -365));
  let pity: PityCounters = {};
  let xp = 0;
  let level = 1;
  let pendingBoosters = 0;
  const reached = new Map<number, number | null>(levels.map((l) => [l, null]));

  const gainXp = (amount: number, day: number) => {
    xp += amount;
    const now = levelOf(xp, curve).level;
    while (level < now) {
      level++;
      const rewards = levelRewards(rewardRules, level);
      pendingBoosters += rewardBoosters(rewards);
      if (profile.drainsStock && rewards.some((r) => r.kind === "refill")) {
        pendingBoosters += REFILL_BOOSTERS;
      }
      if (reached.has(level) && reached.get(level) === null) reached.set(level, day);
    }
  };

  const missing = (c: Collection) => c.size - c.owned.size;

  for (let day = 1; day <= days; day++) {
    if (day % NEW_COLLECTION_EVERY_DAYS === 0) {
      collections.push(makeCollection(collections.length, NEW_COLLECTION_SIZE, day));
    }
    const challengeToday = day % 7 < profile.challengeDaysPerWeek;
    // The daily challenge's bonus booster: five answers, three right.
    const bonusToday = challengeToday && profile.correctPerSession >= 3 ? 1 : 0;
    const boosters = profile.boostersPerDay + bonusToday + pendingBoosters;
    pendingBoosters = 0;

    for (let b = 0; b < boosters; b++) {
      const open =
        level < CHOOSE_COLLECTION_LEVEL ? collections.slice(0, 1) : shelf(collections, day);
      // The player opens the open collection where the most words are missing.
      const target = open.reduce((best, c) => (missing(c) > missing(best) ? c : best));
      const draw = drawBooster(drawRules, target.pool, pity, random);
      pity = draw.pityCounters;
      const newWords: Rarity[] = [];
      for (const card of draw.cards) {
        if (!target.owned.has(card.cardId)) {
          target.owned.add(card.cardId);
          newWords.push(card.rarity);
        }
      }
      gainXp(boosterXp(xpRules, { newWords, firstOfDay: b === 0 }), day);
    }

    if (challengeToday) {
      for (let a = 0; a < profile.correctPerSession; a++) {
        gainXp(answerXp(xpRules, { correct: true, levelUp: false }), day);
      }
      if (day >= FIRST_MASTERY_DAY) {
        const ups = Math.floor(profile.correctPerSession / CORRECT_PER_MASTERY_UP);
        gainXp(ups * xpRules.masteryLevelUp, day);
      }
    }

    // A trade every few days: its XP, and a missing common word.
    const tradesToday =
      Math.floor((day * profile.tradesPerWeek) / 7) -
      Math.floor(((day - 1) * profile.tradesPerWeek) / 7);
    for (let t = 0; t < tradesToday && level >= 5 && day > 3; t++) {
      gainXp(xpRules.tradeCompleted + xpRules.newWord.common, day);
    }
  }
  return reached;
}

export function median(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  // More than half never got there: no median.
  if (known.length * 2 < values.length) return null;
  return known[Math.floor(values.length / 2)] ?? null;
}
