/**
 * Runs the laurels simulation for each setting and writes results.md next to this file.
 *   pnpm --filter @leximon/core exec vitest run --root ../.. rnd/laurels-sim
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import {
  divisionOf,
  JOUST_SCHEDULE,
  LEAGUE_SCHEDULE,
  LEAGUES,
  type LeagueRules,
} from "../../packages/core/src/index";
import {
  HABITS,
  leagueShares,
  loneSeason,
  median,
  POPULATIONS,
  seeded,
  simulatePopulation,
} from "./simulate";

const BASE = LEAGUE_SCHEDULE[0];
const GLICKO = JOUST_SCHEDULE[0].glicko;
const FLAT_LOSS = { base: 15, min: 5, max: 25 };
const FIXED: LeagueRules = {
  ...BASE,
  loss: {
    page: FLAT_LOSS,
    ecuyer: FLAT_LOSS,
    chevalier: FLAT_LOSS,
    banneret: FLAT_LOSS,
    champion: FLAT_LOSS,
  },
};
const SETTINGS: readonly { readonly name: string; readonly rules: LeagueRules }[] = [
  { name: "cahier : 25 / 15, série doublée dès la 3e", rules: { ...FIXED, streakBonus: 25 } },
  { name: "sans série", rules: { ...FIXED, streakBonus: 0 } },
  { name: "série à +10", rules: { ...FIXED, streakBonus: 10 } },
  { name: "série à +10, défaite de 15 à 30 selon la ligue (retenu)", rules: BASE },
];
const WIN_RATES = [0.4, 0.5, 0.55, 0.6, 0.7];
const LONE_RUNS = 200;
const POPULATION_RUNS = 10;
const SEASONS = 4;

const NAMES: Record<string, string> = {
  page: "Page",
  ecuyer: "Écuyer",
  chevalier: "Chevalier",
  banneret: "Banneret",
  champion: "Champion",
};
const ROMAN = ["", "I", "II", "III"];

function divisionName(rules: LeagueRules, laurels: number): string {
  const division = divisionOf(rules, laurels);
  return `${NAMES[division.league]}${division.rank === null ? "" : ` ${ROMAN[division.rank]}`}`;
}

const percent = (value: number) => `${Math.round(value * 100)} %`;

it("simulates the laurels", { timeout: 600_000 }, () => {
  const lines = [
    "# Lauriers et ligues : résultats",
    "",
    "Généré par `rnd/laurels-sim/run.test.ts`. Tirages par graine fixe.",
    "",
  ];
  for (const setting of SETTINGS) {
    const { rules } = setting;
    lines.push(`## Réglage : ${setting.name}`, "");
    lines.push(
      `### Un joueur seul, contre des adversaires de sa force, première saison (médiane sur ${LONE_RUNS} saisons)`,
      "",
    );
    const habits = Object.values(HABITS);
    lines.push(
      `| Victoires | ${habits.map((h) => `${h.name} (${h.perDay}/jour, ${Math.round(h.dayChance * 7)} j/7)`).join(" | ")} |`,
    );
    lines.push(`|---|${habits.map(() => "---").join("|")}|`);
    for (const winRate of WIN_RATES) {
      const cells = habits.map((habit) => {
        const random = seeded(Math.round(winRate * 1000) + habit.perDay);
        const ends = Array.from(
          { length: LONE_RUNS },
          () => loneSeason(rules, winRate, habit, 0, random).laurels,
        );
        const value = median(ends);
        return `${divisionName(rules, value)} (${value})`;
      });
      lines.push(`| ${percent(winRate)} | ${cells.join(" | ")} |`);
    }
    lines.push("");

    for (const mix of POPULATIONS) {
      lines.push(
        `### ${mix.name}, adversaires choisis par la cote (part des joueurs par ligue en fin de saison, ${POPULATION_RUNS} tirages)`,
        "",
      );
      lines.push(`| Saison | Habitude | ${LEAGUES.map((league) => NAMES[league]).join(" | ")} |`);
      lines.push(`|---|---|${LEAGUES.map(() => "---").join("|")}|`);
      const runs = Array.from({ length: POPULATION_RUNS }, (_, seed) =>
        simulatePopulation(rules, GLICKO, mix, SEASONS, seed + 1),
      );
      for (let season = 0; season < SEASONS; season += 1) {
        const groups: [string, (habit: string) => boolean][] = [
          ["tous", () => true],
          ...Object.values(HABITS).map(
            (habit) =>
              [habit.name, (name: string) => name === habit.name] as [
                string,
                (h: string) => boolean,
              ],
          ),
        ];
        for (const [label, keep] of groups) {
          const laurels = runs.flatMap((run) =>
            run.jousters.filter((j) => keep(j.habit)).map((j) => j.ended[season] ?? 0),
          );
          if (laurels.length === 0) continue;
          const shares = leagueShares(rules, laurels);
          lines.push(
            `| ${season + 1} | ${label} | ${LEAGUES.map((league) => percent(shares.get(league) ?? 0)).join(" | ")} |`,
          );
        }
      }
      lines.push("");
    }
  }
  writeFileSync(new URL("./results.md", import.meta.url), lines.join("\n"));
});
