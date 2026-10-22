/**
 * The clan's weekly goal: correct challenge answers given together, up to four tiers. The week is
 * the game week in Paris (`gameWeekOf`); the server counts the answers and stores what was claimed.
 */

import { gameWeekOf } from "../bonus/bonus";
import type { EpochMs } from "../booster/refill";
import type { ClanXpRules } from "./level";

export const GOAL_TIERS = ["bronze", "silver", "gold", "illuminated"] as const;
export type GoalTier = (typeof GOAL_TIERS)[number];

export interface ClanGoalRules extends ClanXpRules {
  /** Period start; the rules in force when the week starts apply to the whole week. */
  readonly startsAt: EpochMs;
  /** Correct answers per active member for each tier. */
  readonly answersPerActiveMember: Readonly<Record<GoalTier, number>>;
  /** A member who opened a booster or answered a challenge within this time before the week is active. */
  readonly activeWindowMs: number;
  /** Correct answers a member must give to share the tier rewards. */
  readonly minContribution: number;
  /** Bonus boosters each contributor may claim per tier. */
  readonly bonusBoosters: Readonly<Record<GoalTier, number>>;
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

/** The week's targets; `illuminated` is `null` when the clan's level did not open it. */
export interface GoalTargets {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly illuminated: number | null;
}

/**
 * The week's targets, fixed when the week starts from the members active then (at least one),
 * with the fourth tier only if the clan's level opened it by then.
 */
export function goalTargets(
  rules: ClanGoalRules,
  activeMembers: number,
  illuminated: boolean,
): GoalTargets {
  const members = Math.max(1, Math.floor(activeMembers));
  const per = rules.answersPerActiveMember;
  return {
    bronze: per.bronze * members,
    silver: per.silver * members,
    gold: per.gold * members,
    illuminated: illuminated ? per.illuminated * members : null,
  };
}

/** The tiers of a week, lowest first: the fourth only when it is open. */
export function goalTiers(targets: GoalTargets): readonly GoalTier[] {
  return GOAL_TIERS.filter((tier) => targets[tier] !== null);
}

/** Every tier the clan's answers reach, lowest first. */
export function tiersReached(targets: GoalTargets, answers: number): readonly GoalTier[] {
  return goalTiers(targets).filter(
    (tier) => answers >= (targets[tier] ?? Number.POSITIVE_INFINITY),
  );
}

/** The highest tier reached, `null` before bronze. */
export function highestTier(targets: GoalTargets, answers: number): GoalTier | null {
  return tiersReached(targets, answers).at(-1) ?? null;
}

/** The first tier not reached yet, `null` once the last one is. */
export function nextTier(targets: GoalTargets, answers: number): GoalTier | null {
  return goalTiers(targets).find((tier) => answers < (targets[tier] ?? 0)) ?? null;
}

/**
 * Tiers a member may claim boosters for: reached by the clan, with a reward, and the member gave
 * enough correct answers. What they already claimed is the server's to subtract.
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
