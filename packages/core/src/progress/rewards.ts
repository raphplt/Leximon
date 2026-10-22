/**
 * Level rewards: every level from 2 on gives a free reward, claimed by the player (the
 * "coffret"). Nothing is drawn at random: what a level gives is known in advance.
 *
 * Ordinary levels alternate a bonus booster and a refill of the free stock. Every 5 levels: a
 * "garni" booster (at least one Rare) and, up to level 45, a title. Every 10 levels: a card of the
 * player's choice, a reserve slot (up to level 50), an engraved avatar and a pinned card slot (up
 * to level 30); levels 10 and 20 add an avatar frame. Beyond level 50, only bonus boosters and
 * cosmetics. Cosmetics are named in the rules: what a level gives is known before it is reached.
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
  "frame",
] as const;
export type LevelRewardKind = (typeof LEVEL_REWARD_KINDS)[number];

export type LevelReward =
  | { readonly kind: "title"; readonly title: string }
  /** `avatar` is absent from rewards claimed before avatars were named (2026-10-21). */
  | { readonly kind: "avatar"; readonly avatar?: string }
  | { readonly kind: "frame"; readonly frame: string }
  | { readonly kind: Exclude<LevelRewardKind, "title" | "avatar" | "frame"> };

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
  /** Pinned card slots every player has before any level gives one. */
  readonly pinnedSlotsAtStart: number;
  /** Engraved avatars (card ids) every player can wear from the start. */
  readonly startingAvatars: readonly string[];
  /** The avatar each level giving one gives, by level. */
  readonly avatars: Readonly<Record<number, string>>;
  /** The frame every player wears from the start. */
  readonly startingFrame: string;
  /** Avatar frames given by level. */
  readonly frames: Readonly<Record<number, string>>;
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
      ? [{ kind: "bonus_booster" }, avatarReward(rules, level)]
      : [{ kind: "bonus_booster" }];
  }
  if (level % rules.majorEvery === 0) {
    const rewards: LevelReward[] = [{ kind: "card_choice" }];
    if (level <= rules.reserveSlotsUntil) rewards.push({ kind: "reserve_slot" });
    rewards.push(avatarReward(rules, level));
    const frame = rules.frames[level];
    if (frame !== undefined) rewards.push({ kind: "frame", frame });
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

/** The avatar of a level; unnamed when the rules list none for it (beyond the engraved ones). */
function avatarReward(rules: LevelRewardRules, level: number): LevelReward {
  const avatar = rules.avatars[level];
  return avatar === undefined ? { kind: "avatar" } : { kind: "avatar", avatar };
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

/** Whether a card of this rarity can be taken as a card of the player's choice. */
export function isChoosableRarity(rules: LevelRewardRules, rarity: Rarity): boolean {
  return rarityRank(rarity) <= rarityRank(rules.cardChoiceMaxRarity);
}

/** A claimed level and what its coffret gave, as stored. */
export interface ClaimedReward {
  readonly level: number;
  readonly rewards: readonly LevelReward[];
}

/** What a player may wear: what everyone starts with, and what their claimed coffrets gave. */
export interface Wardrobe {
  readonly avatars: ReadonlySet<string>;
  readonly frames: ReadonlySet<string>;
  readonly titles: ReadonlySet<string>;
  /** Cards the player may pin to their profile. */
  readonly pinnedSlots: number;
}

/**
 * Reads the coffrets as they were given, so that a later change of the rules never takes a
 * cosmetic back. An avatar claimed before avatars were named is the one the rules name now.
 */
export function wardrobe(rules: LevelRewardRules, claimed: readonly ClaimedReward[]): Wardrobe {
  const avatars = new Set(rules.startingAvatars);
  const frames = new Set([rules.startingFrame]);
  const titles = new Set<string>();
  let pinnedSlots = rules.pinnedSlotsAtStart;
  for (const claim of claimed) {
    for (const reward of claim.rewards) {
      if (reward.kind === "title") titles.add(reward.title);
      else if (reward.kind === "frame") frames.add(reward.frame);
      else if (reward.kind === "pinned_slot") pinnedSlots += 1;
      else if (reward.kind === "avatar") {
        const avatar = reward.avatar ?? rules.avatars[claim.level];
        if (avatar !== undefined) avatars.add(avatar);
      }
    }
  }
  return { avatars, frames, titles, pinnedSlots };
}

/**
 * The avatar a player wears until they choose one: a starting avatar picked from their public
 * code, so that two new profiles side by side rarely look the same.
 */
export function defaultAvatar(rules: LevelRewardRules, playerCode: string): string {
  let hash = 0;
  for (const char of playerCode) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const avatar = rules.startingAvatars[hash % rules.startingAvatars.length];
  if (avatar === undefined) throw new Error("No starting avatar");
  return avatar;
}
