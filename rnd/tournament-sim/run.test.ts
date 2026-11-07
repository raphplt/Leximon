/**
 * Runs the tournament simulation and writes results.md next to this file.
 *   pnpm --filter @leximon/core exec vitest run --root ../.. rnd/tournament-sim
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import {
  JOUST_SCHEDULE,
  LEAGUE_SCHEDULE,
  LEAGUES,
  type League,
} from "../../packages/core/src/index";
import { HABITS, loneWeeks, POPULATIONS, seeded, simulatePopulation } from "./simulate";

const RULES = LEAGUE_SCHEDULE[0];
const GLICKO = JOUST_SCHEDULE[0].glicko;
const WIN_RATES = [0.4, 0.5, 0.6, 0.7];
const LONE_RUNS = 100;
const LONE_WEEKS = 12;
const POPULATION_RUNS = 10;
const WEEKS = 12;
const SHOWN_WEEKS = [1, 4, 8, 12];

const NAMES: Record<League, string> = {
  page: "Page",
  ecuyer: "Écuyer",
  chevalier: "Chevalier",
  banneret: "Banneret",
  marechal: "Maréchal",
  connetable: "Connétable",
  champion: "Champion",
};

const percent = (value: number) => `${Math.round(value * 100)} %`;

function shares(leagues: readonly League[]): string {
  return LEAGUES.map((league) =>
    percent(leagues.filter((each) => each === league).length / leagues.length),
  ).join(" | ");
}

function median(leagues: League[]): League {
  const sorted = [...leagues].sort((a, b) => LEAGUES.indexOf(a) - LEAGUES.indexOf(b));
  return sorted[Math.floor(sorted.length / 2)] ?? "page";
}

it("simulates the tournaments", { timeout: 900_000 }, () => {
  const lines = [
    "# Tournois de la semaine : résultats",
    "",
    "Généré par `rnd/tournament-sim/run.test.ts`. Tirages par graine fixe.",
    "",
    `## Un joueur seul parmi les automates (ligue médiane sur ${LONE_RUNS} tirages)`,
    "",
    `| Habitude | Victoires | ${[2, 4, 8, 12].map((w) => `Semaine ${w}`).join(" | ")} |`,
    "|---|---|---|---|---|---|",
  ];
  for (const habit of Object.values(HABITS)) {
    for (const winRate of WIN_RATES) {
      const random = seeded(Math.round(winRate * 100) + habit.perDay * 1000);
      const runs = Array.from({ length: LONE_RUNS }, () =>
        loneWeeks(RULES, winRate, habit, LONE_WEEKS, random),
      );
      const cells = [2, 4, 8, 12].map(
        (week) => NAMES[median(runs.map((run) => run[week - 1] ?? "page"))],
      );
      lines.push(`| ${habit.name} | ${percent(winRate)} | ${cells.join(" | ")} |`);
    }
  }
  lines.push("");

  for (const mix of POPULATIONS) {
    lines.push(
      `## ${mix.name} (part des joueurs par ligue en début de semaine, ${POPULATION_RUNS} tirages)`,
      "",
      `| Semaine | Joueurs | ${LEAGUES.map((league) => NAMES[league]).join(" | ")} |`,
      `|---|---|${LEAGUES.map(() => "---").join("|")}|`,
    );
    const runs = Array.from({ length: POPULATION_RUNS }, (_, seed) =>
      simulatePopulation(RULES, GLICKO, mix, WEEKS, seed + 1),
    );
    const all = runs.flatMap((run) => run.jousters);
    for (const week of SHOWN_WEEKS) {
      const at = (keep: (j: (typeof all)[number]) => boolean) =>
        shares(all.filter(keep).map((j) => j.leagues[week - 1] ?? "page"));
      lines.push(`| ${week} | tous | ${at(() => true)} |`);
      for (const habit of Object.values(HABITS)) {
        lines.push(`| ${week} | ${habit.name} | ${at((j) => j.habit === habit.name)} |`);
      }
      const keen = all.filter((j) => j.habit === HABITS.keen.name);
      const sorted = [...keen].sort((a, b) => a.strength - b.strength);
      const third = Math.floor(sorted.length / 3);
      const weak = new Set(sorted.slice(0, third));
      const strong = new Set(sorted.slice(-third));
      lines.push(`| ${week} | assidu, tiers le plus faible | ${at((j) => weak.has(j))} |`);
      lines.push(`| ${week} | assidu, tiers le plus fort | ${at((j) => strong.has(j))} |`);
    }
    lines.push("");
  }
  writeFileSync(new URL("./results.md", import.meta.url), lines.join("\n"));
});
