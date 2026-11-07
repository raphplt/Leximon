/**
 * R&D: weekly tournaments of ranked jousts (docs/rnd/tournois.md).
 * Throwaway code: never imported by apps/ or packages/.
 *
 * Reuses the real groups, automatons, moves and Glicko-2 of packages/core. Players have a hidden
 * strength; the chance to win follows the gap in strength, as in an Elo.
 */
import {
  createSeededRandom,
  type GlickoRules,
  gameTimeOn,
  groupStandings,
  type League,
  type LeagueRules,
  leagueAfter,
  leagueRank,
  type Rating,
  rateGlicko,
  weekAt,
} from "../../packages/core/src/index";

export interface Random {
  next(): number;
}

export function seeded(seed: number): Random {
  const source = createSeededRandom(seed.toString(16).padStart(32, "0"));
  return { next: () => source.nextUint32() / 2 ** 32 };
}

function hexSeed(random: Random): string {
  return Array.from({ length: 4 }, () =>
    Math.floor(random.next() * 2 ** 32)
      .toString(16)
      .padStart(8, "0"),
  ).join("");
}

const DRAW_CHANCE = 0.03;
const DAY_MS = 86_400_000;

export interface Habit {
  readonly name: string;
  readonly dayChance: number;
  /** Ranked jousts the player would play on such a day, before the daily cap. */
  readonly perDay: number;
}

export const HABITS = {
  occasional: { name: "occasionnel", dayChance: 3 / 7, perDay: 1 },
  regular: { name: "régulier", dayChance: 5 / 7, perDay: 3 },
  keen: { name: "assidu", dayChance: 1, perDay: 5 },
} as const satisfies Record<string, Habit>;

// --- A lone player among automatons ---------------------------------------------------------------

/**
 * Weeks of a player alone in their groups, winning `winRate` of their jousts: the beta, where
 * the groups are nearly all automatons. Returns the league of each week.
 */
export function loneWeeks(
  rules: LeagueRules,
  winRate: number,
  habit: Habit,
  weeks: number,
  random: Random,
): League[] {
  let league: League = "page";
  const played: League[] = [];
  for (let week = 0; week < weeks; week += 1) {
    played.push(league);
    const first = weekAt(rules, week).firstDay;
    let points = 0;
    let scoredAt = gameTimeOn(first, 0);
    for (let day = 0; day < 7; day += 1) {
      if (random.next() >= habit.dayChance) continue;
      const jousts = Math.min(habit.perDay, rules.rankedPerDay);
      for (let joust = 0; joust < jousts; joust += 1) {
        const roll = random.next();
        const gained =
          roll < DRAW_CHANCE
            ? rules.points.draw
            : roll < DRAW_CHANCE + winRate * (1 - DRAW_CHANCE)
              ? rules.points.won
              : rules.points.lost;
        if (gained > 0) {
          points += gained;
          scoredAt = gameTimeOn(first, 0) + day * DAY_MS + (12 + joust) * 3_600_000;
        }
      }
    }
    if (points === 0 && scoredAt === gameTimeOn(first, 0)) {
      // Never jousted: no tournament this week.
      continue;
    }
    const lines = groupStandings(
      rules,
      { league, week, seed: hexSeed(random) },
      [{ userId: "me", points, scoredAt }],
      gameTimeOn(first, 0) + 7 * DAY_MS - 1,
    );
    const mine = lines.find((line) => line.kind === "player");
    league = leagueAfter(league, mine?.move ?? "stay");
  }
  return played;
}

// --- A population ---------------------------------------------------------------------------------

interface Jouster {
  readonly id: string;
  readonly habit: Habit;
  readonly strength: number;
  rating: Rating;
  league: League;
  readonly leagues: League[];
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
      [HABITS.occasional, 0.45],
      [HABITS.regular, 0.35],
      [HABITS.keen, 0.2],
    ],
  },
  {
    name: "300 jouteurs",
    size: 300,
    habits: [
      [HABITS.occasional, 0.55],
      [HABITS.regular, 0.3],
      [HABITS.keen, 0.15],
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
  readonly jousters: readonly {
    readonly habit: string;
    readonly strength: number;
    readonly leagues: readonly League[];
  }[];
}

/**
 * `weeks` weeks of a population. Each day, the players who joust ask for their ranked jousts; the
 * opponent is someone of the same league if possible, then the closest rating, among those who
 * joust that day and have jousts left, once per pair a day. Groups of a league fill in the order
 * players enter the week.
 */
export function simulatePopulation(
  rules: LeagueRules,
  glicko: GlickoRules,
  mix: PopulationMix,
  weeks: number,
  seed: number,
): PopulationRun {
  const random = seeded(seed);
  const jousters: Jouster[] = Array.from({ length: mix.size }, (_, index) => ({
    id: `j${index}`,
    habit: pickHabit(mix, random),
    strength: normal(random) * 200,
    rating: glicko.initial,
    league: "page",
    leagues: [],
  }));
  for (let week = 0; week < weeks; week += 1) {
    const first = weekAt(rules, week).firstDay;
    const start = gameTimeOn(first, 0);
    const points = new Map<Jouster, { points: number; scoredAt: number }>();
    const entered: Jouster[] = [];
    const enter = (jouster: Jouster, at: number) => {
      if (points.has(jouster)) return;
      points.set(jouster, { points: 0, scoredAt: at });
      entered.push(jouster);
    };
    for (let day = 0; day < 7; day += 1) {
      const today = jousters.filter((jouster) => random.next() < jouster.habit.dayChance);
      const wants = new Map(
        today.map((jouster) => [jouster, Math.min(jouster.habit.perDay, rules.rankedPerDay)]),
      );
      const played = new Map(today.map((jouster) => [jouster, 0]));
      const met = new Set<string>();
      const order = [...today].sort(() => random.next() - 0.5);
      for (let round = 0; round < rules.rankedPerDay; round += 1) {
        for (const player of order) {
          if ((played.get(player) ?? 0) >= (wants.get(player) ?? 0)) continue;
          const candidates = today.filter(
            (other) =>
              other !== player &&
              (played.get(other) ?? 0) < rules.rankedPerDay &&
              !met.has(pairKey(player, other)),
          );
          const opponent = best(candidates, player);
          if (opponent === undefined) continue;
          met.add(pairKey(player, opponent));
          played.set(player, (played.get(player) ?? 0) + 1);
          played.set(opponent, (played.get(opponent) ?? 0) + 1);
          const at = start + day * DAY_MS + (9 + round) * 3_600_000;
          enter(player, at);
          enter(opponent, at);
          play(rules, glicko, player, opponent, points, at, random);
        }
      }
    }
    // Groups of 30 by league, in the order players entered.
    const groups = new Map<League, Jouster[][]>();
    for (const jouster of entered) {
      const ofLeague = groups.get(jouster.league) ?? [];
      const open = ofLeague.find((group) => group.length < rules.groupSize);
      if (open === undefined) ofLeague.push([jouster]);
      else open.push(jouster);
      groups.set(jouster.league, ofLeague);
    }
    const next = new Map<Jouster, League>();
    for (const [league, ofLeague] of groups) {
      for (const members of ofLeague) {
        const lines = groupStandings(
          rules,
          { league, week, seed: hexSeed(random) },
          members.map((member) => ({ userId: member.id, ...(points.get(member) ?? zero(start)) })),
          start + 7 * DAY_MS - 1,
        );
        for (const line of lines) {
          if (line.kind !== "player") continue;
          const member = members.find((candidate) => candidate.id === line.userId);
          if (member !== undefined) next.set(member, leagueAfter(league, line.move));
        }
      }
    }
    for (const jouster of jousters) {
      jouster.leagues.push(jouster.league);
      jouster.league = next.get(jouster) ?? jouster.league;
    }
  }
  return {
    jousters: jousters.map((jouster) => ({
      habit: jouster.habit.name,
      strength: jouster.strength,
      leagues: jouster.leagues,
    })),
  };
}

const zero = (start: number) => ({ points: 0, scoredAt: start });

function pairKey(a: Jouster, b: Jouster): string {
  return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
}

function best(candidates: readonly Jouster[], player: Jouster): Jouster | undefined {
  let chosen: Jouster | undefined;
  const cost = (other: Jouster) => [
    Math.abs(leagueRank(other.league) - leagueRank(player.league)),
    Math.abs(other.rating.rating - player.rating.rating),
  ];
  for (const candidate of candidates) {
    if (chosen === undefined) {
      chosen = candidate;
      continue;
    }
    const [leagueGap, ratingGap] = cost(candidate);
    const [bestLeague, bestRating] = cost(chosen);
    if (
      (leagueGap ?? 0) < (bestLeague ?? 0) ||
      (leagueGap === bestLeague && (ratingGap ?? 0) < (bestRating ?? 0))
    ) {
      chosen = candidate;
    }
  }
  return chosen;
}

function play(
  rules: LeagueRules,
  glicko: GlickoRules,
  a: Jouster,
  b: Jouster,
  points: Map<Jouster, { points: number; scoredAt: number }>,
  at: number,
  random: Random,
): void {
  const winA = 1 / (1 + 10 ** ((b.strength - a.strength) / 400));
  const roll = random.next();
  const score: 0 | 0.5 | 1 =
    roll < DRAW_CHANCE ? 0.5 : roll < DRAW_CHANCE + winA * (1 - DRAW_CHANCE) ? 1 : 0;
  const gain = (who: Jouster, result: 0 | 0.5 | 1) => {
    const won = result === 1 ? rules.points.won : result === 0.5 ? rules.points.draw : 0;
    if (won === 0) return;
    const current = points.get(who) ?? { points: 0, scoredAt: at };
    points.set(who, { points: current.points + won, scoredAt: at });
  };
  gain(a, score);
  gain(b, (1 - score) as 0 | 0.5 | 1);
  const [ratingA, ratingB] = [a.rating, b.rating];
  a.rating = rateGlicko(glicko, ratingA, [{ opponent: ratingB, score }]);
  b.rating = rateGlicko(glicko, ratingB, [
    { opponent: ratingA, score: (1 - score) as 0 | 0.5 | 1 },
  ]);
}
