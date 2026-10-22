/**
 * The clan's weekly goal (P66): new words found together, three tiers. The week is the game week
 * in Paris (`gameWeekOf`); the server counts the words and stores what was claimed.
 */

import { gameWeekOf } from "../bonus/bonus";
import type { EpochMs } from "../booster/refill";

export const GOAL_TIERS = ["bronze", "silver", "gold"] as const;
export type GoalTier = (typeof GOAL_TIERS)[number];

export interface ClanGoalRules {
  /** Period start; the rules in force when the week starts apply to the whole week. */
  readonly startsAt: EpochMs;
  /** New words per active member for each tier. */
  readonly wordsPerActiveMember: Readonly<Record<GoalTier, number>>;
  /** A member who opened a booster within this time before the week counts as active. */
  readonly activeWindowMs: number;
  /** Words a member must bring to share the tier rewards. */
  readonly minContribution: number;
  /** Bonus boosters each contributor may claim per tier. */
  readonly bonusBoosters: Readonly<Record<GoalTier, number>>;
  /** Tiers that unlock one more emblem item for the clan. */
  readonly emblemTiers: readonly GoalTier[];
}

export type ClanGoalSchedule = readonly [ClanGoalRules, ...ClanGoalRules[]];

export function clanGoalRulesAt(schedule: ClanGoalSchedule, time: EpochMs): ClanGoalRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export type GoalTargets = Readonly<Record<GoalTier, number>>;

/** The week's targets, fixed when the week starts from the members active then (at least one). */
export function goalTargets(rules: ClanGoalRules, activeMembers: number): GoalTargets {
  const members = Math.max(1, Math.floor(activeMembers));
  return {
    bronze: rules.wordsPerActiveMember.bronze * members,
    silver: rules.wordsPerActiveMember.silver * members,
    gold: rules.wordsPerActiveMember.gold * members,
  };
}

/** Every tier the clan's words reach, lowest first. */
export function tiersReached(targets: GoalTargets, words: number): readonly GoalTier[] {
  return GOAL_TIERS.filter((tier) => words >= targets[tier]);
}

/** The highest tier reached, `null` before bronze. */
export function highestTier(targets: GoalTargets, words: number): GoalTier | null {
  return tiersReached(targets, words).at(-1) ?? null;
}

/**
 * Tiers a member may claim boosters for: reached by the clan, with a reward, and the member brought
 * enough words. What they already claimed is the server's to subtract.
 */
export function claimableTiers(
  rules: ClanGoalRules,
  reached: readonly GoalTier[],
  contribution: number,
): readonly GoalTier[] {
  if (contribution < rules.minContribution) return [];
  return reached.filter((tier) => rules.bonusBoosters[tier] > 0);
}

/** Rewards of a week stay claimable until the end of the following week. */
export function claimDeadline(weekStart: EpochMs): EpochMs {
  return gameWeekOf(gameWeekOf(weekStart).end).end;
}
