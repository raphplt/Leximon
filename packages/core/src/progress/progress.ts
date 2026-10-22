/**
 * Account level: useful actions earn experience (XP), and XP raises the level.
 *
 * Only the total XP is stored; the level is always derived from it. Concurrency: these functions
 * are pure. Callers add XP with an atomic increment, in the transaction of the action that earns it.
 */

import type { Rarity } from "../booster/rarity";
import type { EpochMs } from "../booster/refill";

export interface XpRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  /** Every booster opened, from the free stock or the bonus reserve. */
  readonly boosterOpened: number;
  /** The first booster opened in a calendar day in Paris (on top of `boosterOpened`). */
  readonly firstBoosterOfDay: number;
  /** A word the player never owned before, by rarity: the collection grows, not the duplicates. */
  readonly newWord: Readonly<Record<Rarity, number>>;
  /** A right answer to a challenge. Answers are only taken on due words: they cap themselves. */
  readonly correctAnswer: number;
  /** A word reaching a higher mastery level (ink, then gilded). */
  readonly masteryLevelUp: number;
  /** A trade concluded, for each of the two players. */
  readonly tradeCompleted: number;
}

export type XpSchedule = readonly [XpRules, ...XpRules[]];

export function xpRulesAt(schedule: XpSchedule, time: EpochMs): XpRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export interface BoosterXpInput {
  /** Rarities of the drawn words the player owned no copy of before this booster. */
  readonly newWords: readonly Rarity[];
  readonly firstOfDay: boolean;
}

export function boosterXp(rules: XpRules, input: BoosterXpInput): number {
  const words = input.newWords.reduce((sum, rarity) => sum + rules.newWord[rarity], 0);
  return rules.boosterOpened + (input.firstOfDay ? rules.firstBoosterOfDay : 0) + words;
}

export function answerXp(rules: XpRules, input: { correct: boolean; levelUp: boolean }): number {
  return (input.correct ? rules.correctAnswer : 0) + (input.levelUp ? rules.masteryLevelUp : 0);
}

/**
 * XP needed to go from level n to n + 1: `base + step × (n − 1)`.
 *
 * Not dated like the other settings: the level is derived from the stored XP, so a change would
 * move players who already reached a level. The curve may only be lengthened beyond the highest
 * level anyone can reach, never changed below it.
 */
export const LEVEL_CURVE = { base: 100, step: 45 } as const;

export interface LevelCurve {
  readonly base: number;
  readonly step: number;
}

/** Total XP at which a level is reached. Level 1 is where everyone starts, at 0 XP. */
export function xpToReach(level: number, curve: LevelCurve = LEVEL_CURVE): number {
  const steps = Math.max(0, level - 1);
  // Sum of base + step × (n − 1) for n = 1 … steps.
  return curve.base * steps + (curve.step * steps * (steps - 1)) / 2;
}

export interface Level {
  readonly level: number;
  /** XP earned since the current level was reached. */
  readonly xpIntoLevel: number;
  /** XP the current level takes in all, from its start to the next one. */
  readonly xpForNextLevel: number;
}

export function levelOf(xp: number, curve: LevelCurve = LEVEL_CURVE): Level {
  const earned = Math.max(0, Math.floor(xp));
  // A few hundred steps at most for years of play: simpler than solving the quadratic exactly.
  let level = 1;
  while (xpToReach(level + 1, curve) <= earned) level++;
  const start = xpToReach(level, curve);
  return {
    level,
    xpIntoLevel: earned - start,
    xpForNextLevel: xpToReach(level + 1, curve) - start,
  };
}

export interface ProgressGain extends Level {
  readonly xp: number;
  readonly xpGained: number;
  readonly levelUp: boolean;
}

/** Progress once `gained` XP is in the total `xp`, and whether that gain raised the level. */
export function progressGain(xp: number, gained: number): ProgressGain {
  const after = levelOf(xp);
  return {
    ...after,
    xp,
    xpGained: gained,
    levelUp: after.level > levelOf(xp - gained).level,
  };
}
