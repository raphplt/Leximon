/**
 * Runs every curve for every profile and writes results.md next to this file.
 *   pnpm --filter @leximon/core exec vitest run --root ../.. rnd/level-sim
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import type { LevelCurve } from "../../packages/core/src/index";
import { median, PROFILES, simulatePlayer } from "./simulate";

const CURVES: readonly LevelCurve[] = [
  { base: 100, step: 20 },
  { base: 100, step: 30 },
  { base: 100, step: 35 },
  { base: 100, step: 40 },
  { base: 150, step: 35 },
  { base: 150, step: 40 },
  { base: 100, step: 45 },
  { base: 125, step: 45 },
];
const LEVELS = [5, 10, 15, 20, 30, 50, 75, 100];
const DAYS = 730;
const PLAYERS = 40;

function days(value: number | null): string {
  if (value === null) return `> ${DAYS} j`;
  if (value < 60) return `${value} j`;
  return `${value} j (${(value / 30.4).toFixed(1)} mois)`;
}

it("simulates the level pace", { timeout: 600_000 }, () => {
  const lines = [
    "# Rythme des niveaux : résultats",
    "",
    `Généré par \`rnd/level-sim/run.test.ts\`. Médiane sur ${PLAYERS} joueurs simulés, ${DAYS} jours. Courbe : passer du niveau n au suivant demande base + pas × (n − 1) XP.`,
    "",
  ];
  for (const profile of PROFILES) {
    lines.push(`## Joueur ${profile.name}`, "");
    lines.push(`| Courbe | ${LEVELS.map((l) => `Niv. ${l}`).join(" | ")} |`);
    lines.push(`|---|${LEVELS.map(() => "---").join("|")}|`);
    for (const curve of CURVES) {
      const runs = Array.from({ length: PLAYERS }, (_, seed) =>
        simulatePlayer(profile, curve, LEVELS, DAYS, seed + 1),
      );
      const cells = LEVELS.map((level) => days(median(runs.map((run) => run.get(level) ?? null))));
      lines.push(`| ${curve.base} + ${curve.step} × (n − 1) | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  writeFileSync(new URL("./results.md", import.meta.url), lines.join("\n"));
});
