/**
 * The level pace of the beta's real players, before and after the slower clock of 2026-11-07,
 * on the curve in force. Writes results-beta.md next to this file.
 *   pnpm --filter @leximon/core exec vitest run --root ../.. rnd/level-sim/run-beta
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { LEVEL_CURVE } from "../../packages/core/src/index";
import { median, type Profile, simulatePlayer } from "./simulate";

// From the beta's figures of 2026-11-05 (docs/cahiers-des-charges/economie.md): free sachets
// opened a day, the bonus ones being added by the simulation; about 69 % of answers are right.
const BETA_PROFILES: readonly Profile[] = [
  {
    name: "médian de la bêta (12 sachets par jour)",
    boostersPerDay: 11,
    challengeDaysPerWeek: 7,
    correctPerSession: 5,
    tradesPerWeek: 1,
  },
  {
    name: "trois passages par jour, 30 min et 6 en stock",
    boostersPerDay: 18,
    challengeDaysPerWeek: 7,
    correctPerSession: 8,
    tradesPerWeek: 2,
  },
  {
    name: "trois passages par jour, 1 h et 8 en stock",
    boostersPerDay: 19,
    challengeDaysPerWeek: 7,
    correctPerSession: 8,
    tradesPerWeek: 2,
  },
  {
    name: "le plus assidu, 30 min et 6 en stock",
    boostersPerDay: 28,
    challengeDaysPerWeek: 7,
    correctPerSession: 20,
    tradesPerWeek: 3,
  },
  {
    name: "le plus assidu, 1 h et 8 en stock",
    boostersPerDay: 24,
    challengeDaysPerWeek: 7,
    correctPerSession: 20,
    tradesPerWeek: 3,
  },
];
const LEVELS = [5, 8, 10, 15, 20, 30, 50];
const DAYS = 365;
const PLAYERS = 40;

function days(value: number | null): string {
  if (value === null) return `> ${DAYS} j`;
  if (value < 60) return `${value} j`;
  return `${value} j (${(value / 30.4).toFixed(1)} mois)`;
}

it("simulates the level pace of the beta's players", { timeout: 600_000 }, () => {
  const lines = [
    "# Rythme des niveaux : profils de la bêta",
    "",
    `Généré par \`rnd/level-sim/run-beta.test.ts\`. Médiane sur ${PLAYERS} joueurs simulés, ${DAYS} jours, courbe en vigueur (${LEVEL_CURVE.base} + ${LEVEL_CURVE.step} × (n − 1)). Sachets gratuits par jour ; les sachets bonus (défi du jour, niveaux) s'y ajoutent.`,
    "",
    `| Profil | ${LEVELS.map((l) => `Niv. ${l}`).join(" | ")} |`,
    `|---|${LEVELS.map(() => "---").join("|")}|`,
  ];
  for (const profile of BETA_PROFILES) {
    const runs = Array.from({ length: PLAYERS }, (_, seed) =>
      simulatePlayer(profile, LEVEL_CURVE, LEVELS, DAYS, seed + 1),
    );
    const cells = LEVELS.map((level) => days(median(runs.map((run) => run.get(level) ?? null))));
    lines.push(`| ${profile.name} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  writeFileSync(new URL("./results-beta.md", import.meta.url), lines.join("\n"));
});
