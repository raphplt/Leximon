/**
 * Level rewards (P58): every level from 2 on gives a free reward, claimed by the player (the
 * "coffret"). Nothing is drawn at random: what a level gives is known in advance.
 *
 * Ordinary levels alternate a bonus booster and a refill of the free stock. Every 5 levels: a
 * "garni" booster (at least one Rare) and, up to level 45, a title. Every 10 levels: a card of the
 * player's choice, a reserve slot (up to level 50), an engraved avatar and a pinned card slot (up
 * to level 30). Beyond level 50, only bonus boosters and cosmetics.
 *
 * Concurrency: these functions are pure. Callers apply a claim under the player's wallet lock.
 */

import { type Rarity, rarityRank } from "../booster/rarity";
import type { EpochMs } from "../booster/refill";

export const LEVEL_REWARD_KINDS = [
  "bonus_booster",
  "refill",
  "garni_booster",
  "title",
  "card_choice",
  "reserve_slot",
  "avatar",
  "pinned_slot",
] as const;
export type LevelRewardKind = (typeof LEVEL_REWARD_KINDS)[number];

export type LevelReward =
  | { readonly kind: "title"; readonly title: string }
  | { readonly kind: Exclude<LevelRewardKind, "title"> };

export interface LevelRewardRules {
  /** Period start; the rules in force when a reward is claimed apply. */
  readonly startsAt: EpochMs;
  /** Levels giving a garni booster and, when listed in `titles`, a title. */
  readonly milestoneEvery: number;
  /** Levels giving a card of the player's choice, a reserve slot, an avatar and a pinned slot. */
  readonly majorEvery: number;
  /** Titles by level. */
  readonly titles: Readonly<Record<number, string>>;
  /** Reserve slots are given up to this level. */
  readonly reserveSlotsUntil: number;
  /** Pinned card slots are given up to this level. */
  readonly pinnedSlotsUntil: number;
  /** Beyond this level, a bonus booster each level, and an avatar every `avatarEveryBeyond`. */
  readonly cosmeticsOnlyAbove: number;
  readonly avatarEveryBeyond: number;
  /** A garni booster holds at least one card this rare. */
  readonly garniMinRarity: Rarity;
  /** The chosen card is at most this rare. */
  readonly cardChoiceMaxRarity: Rarity;
}

export type LevelRewardSchedule = readonly [LevelRewardRules, ...LevelRewardRules[]];

export function levelRewardRulesAt(schedule: LevelRewardSchedule, time: EpochMs): LevelRewardRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** The first level that gives a reward: level 1 is where everyone starts. */
export const FIRST_REWARDED_LEVEL = 2;

/** What a level gives, in the order the coffret shows it. Empty for level 1. */
export function levelRewards(rules: LevelRewardRules, level: number): LevelReward[] {
  if (!Number.isSafeInteger(level) || level < FIRST_REWARDED_LEVEL) return [];
  if (level > rules.cosmeticsOnlyAbove) {
    return level % rules.avatarEveryBeyond === 0
      ? [{ kind: "bonus_booster" }, { kind: "avatar" }]
      : [{ kind: "bonus_booster" }];
  }
  if (level % rules.majorEvery === 0) {
    const rewards: LevelReward[] = [{ kind: "card_choice" }];
    if (level <= rules.reserveSlotsUntil) rewards.push({ kind: "reserve_slot" });
    rewards.push({ kind: "avatar" });
    if (level <= rules.pinnedSlotsUntil) rewards.push({ kind: "pinned_slot" });
    return rewards;
  }
  if (level % rules.milestoneEvery === 0) {
    const title = rules.titles[level];
    return title === undefined
      ? [{ kind: "garni_booster" }]
      : [{ kind: "garni_booster" }, { kind: "title", title }];
  }
  // Odd levels a bonus booster, even levels a refill: level 2 refills what the first opens spent.
  return level % 2 === 1 ? [{ kind: "bonus_booster" }] : [{ kind: "refill" }];
}

/** Boosters a reward adds to the bonus reserve. */
export function rewardBoosters(rewards: readonly LevelReward[]): number {
  return rewards.filter((r) => r.kind === "bonus_booster" || r.kind === "garni_booster").length;
}

/** Levels reached but not claimed yet, lowest first. */
export function unclaimedLevels(level: number, claimed: Iterable<number>): number[] {
  const done = new Set(claimed);
  const levels: number[] = [];
  for (let n = FIRST_REWARDED_LEVEL; n <= level; n++) if (!done.has(n)) levels.push(n);
  return levels;
}

/** The title a player carries: the one of the highest milestone they claimed, if any. */
export function currentTitle(rules: LevelRewardRules, claimed: Iterable<number>): string | null {
  let best: number | null = null;
  for (const level of claimed) {
    if (rules.titles[level] !== undefined && (best === null || level > best)) best = level;
  }
  return best === null ? null : (rules.titles[best] ?? null);
}

/** Whether a card of this rarity can be taken as a card of the player's choice (P58). */
export function isChoosableRarity(rules: LevelRewardRules, rarity: Rarity): boolean {
  return rarityRank(rarity) <= rarityRank(rules.cardChoiceMaxRarity);
}
