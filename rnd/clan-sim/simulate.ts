/**
 * R&D: clan goal and clan level pace (docs/rnd/clan-sim.md).
 * Throwaway code: never imported by apps/ or packages/.
 *
 * Reuses the real goal tiers, week XP and clan level of packages/core; the members' habits are the
 * profiles of the level simulation (rnd/level-sim), stated in the report.
 */
import {
  type ClanGoalRules,
  type ClanLevelRules,
  clanLevelOf,
  clanUnlocks,
  createSeededRandom,
  goalTargets,
  type RandomSource,
  tiersReached,
  weekXp,
} from "../../packages/core/src/index";

export interface Profile {
  readonly name: string;
  /** Chance to play on a given day. */
  readonly dayChance: number;
  /** Correct answers in a session, on average. */
  readonly answersPerSession: number;
}

export const PROFILES = {
  occasional: { name: "occasionnel", dayChance: 3 / 7, answersPerSession: 4 },
  regular: { name: "régulier", dayChance: 1, answersPerSession: 8 },
  keen: { name: "assidu", dayChance: 1, answersPerSession: 20 },
} as const satisfies Record<string, Profile>;

export interface ClanMix {
  readonly name: string;
  readonly members: readonly Profile[];
}

function times(count: number, profile: Profile): Profile[] {
  return Array.from({ length: count }, () => profile);
}

export const MIXES: readonly ClanMix[] = [
  {
    name: "3 amis (1 régulier, 2 occasionnels)",
    members: [PROFILES.regular, ...times(2, PROFILES.occasional)],
  },
  { name: "3 réguliers", members: times(3, PROFILES.regular) },
  {
    name: "8 membres (2 assidus, 3 réguliers, 3 occasionnels)",
    members: [
      ...times(2, PROFILES.keen),
      ...times(3, PROFILES.regular),
      ...times(3, PROFILES.occasional),
    ],
  },
  { name: "5 réguliers", members: times(5, PROFILES.regular) },
  {
    name: "30 membres (4 assidus, 10 réguliers, 16 occasionnels)",
    members: [
      ...times(4, PROFILES.keen),
      ...times(10, PROFILES.regular),
      ...times(16, PROFILES.occasional),
    ],
  },
  { name: "30 réguliers", members: times(30, PROFILES.regular) },
];

function uniform(random: RandomSource): number {
  return random.nextUint32() / 2 ** 32;
}

/** A session's correct answers: the profile's mean, give or take half. */
function sessionAnswers(random: RandomSource, mean: number): number {
  return Math.max(0, Math.round(mean * (0.5 + uniform(random))));
}

export interface ClanRun {
  /** Week a level was first reached (1-based), by level. */
  readonly levelWeeks: Map<number, number>;
  /** Weeks reaching each tier. */
  readonly tierWeeks: Map<string, number>;
  /** Weeks a member alone filled gold. */
  readonly soloGold: number;
}

export function simulateClan(
  mix: ClanMix,
  goal: ClanGoalRules,
  level: ClanLevelRules,
  weeks: number,
  seed: number,
): ClanRun {
  const random = createSeededRandom(seed.toString(16).padStart(32, "0"));
  const levelWeeks = new Map<number, number>();
  const tierWeeks = new Map<string, number>();
  let xp = 0;
  let soloGold = 0;
  for (let week = 1; week <= weeks; week++) {
    const answers = mix.members.map((member) => {
      let total = 0;
      for (let day = 0; day < 7; day++) {
        if (uniform(random) < member.dayChance)
          total += sessionAnswers(random, member.answersPerSession);
      }
      return total;
    });
    // Everyone counts as active: occasional players almost always played the week before.
    const current = clanLevelOf(level, xp).level;
    const targets = goalTargets(goal, mix.members.length, clanUnlocks(level, current).illuminated);
    const reached = tiersReached(
      targets,
      answers.reduce((sum, count) => sum + count, 0),
    );
    for (const tier of reached) tierWeeks.set(tier, (tierWeeks.get(tier) ?? 0) + 1);
    if (answers.some((count) => count >= targets.gold)) soloGold++;
    xp += weekXp(goal, answers, reached);
    const after = clanLevelOf(level, xp).level;
    for (let n = current + 1; n <= after; n++) levelWeeks.set(n, week);
  }
  return { levelWeeks, tierWeeks, soloGold };
}

export function median(values: readonly (number | null)[]): number | null {
  const sorted = values.map((value) => value ?? Number.POSITIVE_INFINITY).sort((a, b) => a - b);
  const middle = sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
  return Number.isFinite(middle) ? middle : null;
}
