/**
 * R&D: laurels and leagues of ranked jousts (docs/rnd/lauriers.md).
 * Throwaway code: never imported by apps/ or packages/.
 *
 * Reuses the real laurels, floors, season starts and Glicko-2 of packages/core. Players have a
 * hidden strength; the chance to win follows the gap in strength, as in an Elo.
 */
import {
  createSeededRandom,
  freshStanding,
  type GlickoRules,
  joustLaurels,
  type League,
  type LeagueRules,
  leagueOf,
  type Rating,
  rateGlicko,
  type Standing,
} from "../../packages/core/src/index";

export interface Random {
  next(): number;
}

export function seeded(seed: number): Random {
  const source = createSeededRandom(seed.toString(16).padStart(32, "0"));
  return { next: () => source.nextUint32() / 2 ** 32 };
}

/** Draws are rare: two scores and two total times must match. */
const DRAW_CHANCE = 0.03;

export interface Habit {
  readonly name: string;
  /** Chance to joust on a given day, and ranked jousts on such a day. */
  readonly dayChance: number;
  readonly perDay: number;
}

export const HABITS = {
  occasional: { name: "occasionnel", dayChance: 3 / 7, perDay: 1 },
  regular: { name: "régulier", dayChance: 5 / 7, perDay: 3 },
  keen: { name: "assidu", dayChance: 1, perDay: 5 },
  driven: { name: "acharné", dayChance: 1, perDay: 10 },
} as const satisfies Record<string, Habit>;

// --- A lone player at a fixed win rate --------------------------------------------------------

/** One season of a player who wins `winRate` of their jousts against even opponents. */
export function loneSeason(
  rules: LeagueRules,
  winRate: number,
  habit: Habit,
  start: number,
  random: Random,
): Standing {
  let standing: Standing = { laurels: start, peak: start, streak: 0 };
  for (let day = 0; day < rules.seasonDays; day += 1) {
    if (random.next() >= habit.dayChance) continue;
    for (let joust = 0; joust < habit.perDay; joust += 1) {
      const roll = random.next();
      const outcome =
        roll < DRAW_CHANCE
          ? "draw"
          : roll < DRAW_CHANCE + winRate * (1 - DRAW_CHANCE)
            ? "won"
            : "lost";
      standing = joustLaurels(rules, standing, {
        outcome,
        rating: 1500,
        opponentRating: 1500,
      }).after;
    }
  }
  return standing;
}

// --- A population with matchmaking -----------------------------------------------------------

interface Jouster {
  readonly habit: Habit;
  /** Hidden strength, in Elo points: 400 more wins ten times out of eleven. */
  readonly strength: number;
  rating: Rating;
  standing: Standing;
  /** Laurels at the end of each season. */
  readonly ended: number[];
}

export interface PopulationMix {
  readonly name: string;
  readonly size: number;
  readonly habits: readonly [Habit, number][];
}

export const POPULATIONS: readonly PopulationMix[] = [
  {
    name: "Bêta, 30 jouteurs",
    size: 30,
    habits: [
      [HABITS.occasional, 0.4],
      [HABITS.regular, 0.35],
      [HABITS.keen, 0.2],
      [HABITS.driven, 0.05],
    ],
  },
  {
    name: "300 jouteurs",
    size: 300,
    habits: [
      [HABITS.occasional, 0.5],
      [HABITS.regular, 0.3],
      [HABITS.keen, 0.15],
      [HABITS.driven, 0.05],
    ],
  },
];

function normal(random: Random): number {
  const u = Math.max(random.next(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random.next());
}

function pickHabit(mix: PopulationMix, random: Random): Habit {
  let roll = random.next();
  for (const [habit, share] of mix.habits) {
    roll -= share;
    if (roll < 0) return habit;
  }
  return mix.habits[0]?.[0] ?? HABITS.regular;
}

export interface PopulationRun {
  readonly jousters: readonly { readonly habit: string; readonly ended: readonly number[] }[];
}

/**
 * `seasons` seasons of a population. Each day, every player who jousts that day asks for their
 * jousts; the opponent is the closest rating among those who still joust that day, one joust per
 * pair a day, as the game matches them.
 */
export function simulatePopulation(
  rules: LeagueRules,
  glicko: GlickoRules,
  mix: PopulationMix,
  seasons: number,
  seed: number,
): PopulationRun {
  const random = seeded(seed);
  const jousters: Jouster[] = Array.from({ length: mix.size }, () => ({
    habit: pickHabit(mix, random),
    strength: normal(random) * 200,
    rating: glicko.initial,
    standing: { laurels: 0, peak: 0, streak: 0 },
    ended: [],
  }));
  for (let season = 0; season < seasons; season += 1) {
    for (const jouster of jousters) {
      const last =
        season === 0 ? null : { season: season - 1, laurels: jouster.ended[season - 1] ?? 0 };
      jouster.standing = freshStanding(rules, last, season);
    }
    for (let day = 0; day < rules.seasonDays; day += 1) {
      const today = jousters.filter((jouster) => random.next() < jouster.habit.dayChance);
      const left = new Map(today.map((jouster) => [jouster, jouster.habit.perDay]));
      const met = new Set<string>();
      const order = [...today].sort(() => random.next() - 0.5);
      for (let round = 0; round < 10; round += 1) {
        for (const player of order) {
          if ((left.get(player) ?? 0) <= 0) continue;
          const candidates = today.filter(
            (other) =>
              other !== player &&
              !met.has(pairKey(jousters, player, other)) &&
              // An opponent has fewer than 3 jousts to play: the joust waits for them otherwise.
              (left.get(other) ?? 0) > -3,
          );
          const opponent = closest(candidates, player.rating.rating);
          if (opponent === undefined) continue;
          met.add(pairKey(jousters, player, opponent));
          left.set(player, (left.get(player) ?? 0) - 1);
          left.set(opponent, (left.get(opponent) ?? 0) - 1);
          play(rules, glicko, player, opponent, random);
        }
      }
    }
    for (const jouster of jousters) jouster.ended.push(jouster.standing.laurels);
  }
  return {
    jousters: jousters.map((jouster) => ({ habit: jouster.habit.name, ended: jouster.ended })),
  };
}

function pairKey(all: readonly Jouster[], a: Jouster, b: Jouster): string {
  const [x, y] = [all.indexOf(a), all.indexOf(b)].sort((p, q) => p - q);
  return `${x}:${y}`;
}

function closest(candidates: readonly Jouster[], rating: number): Jouster | undefined {
  let best: Jouster | undefined;
  for (const candidate of candidates) {
    if (
      best === undefined ||
      Math.abs(candidate.rating.rating - rating) < Math.abs(best.rating.rating - rating)
    ) {
      best = candidate;
    }
  }
  return best;
}

function play(
  rules: LeagueRules,
  glicko: GlickoRules,
  a: Jouster,
  b: Jouster,
  random: Random,
): void {
  const winA = 1 / (1 + 10 ** ((b.strength - a.strength) / 400));
  const roll = random.next();
  const score: 0 | 0.5 | 1 =
    roll < DRAW_CHANCE ? 0.5 : roll < DRAW_CHANCE + winA * (1 - DRAW_CHANCE) ? 1 : 0;
  const outcomeA = score === 1 ? "won" : score === 0 ? "lost" : "draw";
  const outcomeB = score === 1 ? "lost" : score === 0 ? "won" : "draw";
  const [ratingA, ratingB] = [a.rating, b.rating];
  a.standing = joustLaurels(rules, a.standing, {
    outcome: outcomeA,
    rating: ratingA.rating,
    opponentRating: ratingB.rating,
  }).after;
  b.standing = joustLaurels(rules, b.standing, {
    outcome: outcomeB,
    rating: ratingB.rating,
    opponentRating: ratingA.rating,
  }).after;
  a.rating = rateGlicko(glicko, ratingA, [{ opponent: ratingB, score }]);
  b.rating = rateGlicko(glicko, ratingB, [
    { opponent: ratingA, score: (1 - score) as 0 | 0.5 | 1 },
  ]);
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function leagueShares(rules: LeagueRules, laurels: readonly number[]): Map<League, number> {
  const shares = new Map<League, number>();
  for (const value of laurels) {
    const league = leagueOf(rules, value);
    shares.set(league, (shares.get(league) ?? 0) + 1 / laurels.length);
  }
  return shares;
}
