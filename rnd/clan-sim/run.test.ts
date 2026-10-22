/**
 * Runs every setting for every clan mix and writes results.md next to this file.
 *   pnpm --filter @leximon/core exec vitest run --root ../.. rnd/clan-sim
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import {
  CLAN_GOAL_SCHEDULE,
  CLAN_LEVEL,
  type ClanGoalRules,
  type ClanLevelRules,
} from "../../packages/core/src/index";
import { MIXES, median, simulateClan } from "./simulate";

const GOAL = CLAN_GOAL_SCHEDULE[0];
const SETTINGS: readonly { name: string; goal: ClanGoalRules; level: ClanLevelRules }[] = [
  { name: "500 + 250", goal: GOAL, level: CLAN_LEVEL },
  { name: "500 + 150", goal: GOAL, level: { ...CLAN_LEVEL, curve: { base: 500, step: 150 } } },
  { name: "300 + 200", goal: GOAL, level: { ...CLAN_LEVEL, curve: { base: 300, step: 200 } } },
  { name: "500 + 400", goal: GOAL, level: { ...CLAN_LEVEL, curve: { base: 500, step: 400 } } },
];
const LEVELS = [2, 5, 10, 15, 20, 30];
const WEEKS = 156;
const CLANS = 40;

function weeks(value: number | null): string {
  if (value === null) return `> ${WEEKS} sem.`;
  if (value < 9) return `${value} sem.`;
  return `${(value / 4.35).toFixed(1)} mois`;
}

function share(count: number): string {
  return `${Math.round((count / WEEKS) * 100)} %`;
}

it("simulates the clan pace", { timeout: 600_000 }, () => {
  const lines = [
    "# Rythme des clans : résultats",
    "",
    `Généré par \`rnd/clan-sim/run.test.ts\`. Médiane sur ${CLANS} clans simulés, ${WEEKS} semaines.`,
    "",
    "## Paliers atteints (part des semaines)",
    "",
    "| Clan | Bronze | Argent | Or | Enluminure | Or rempli par un seul membre |",
    "|---|---|---|---|---|---|",
  ];
  for (const mix of MIXES) {
    const runs = Array.from({ length: CLANS }, (_, seed) =>
      simulateClan(mix, GOAL, CLAN_LEVEL, WEEKS, seed + 1),
    );
    const tier = (name: string) =>
      share(median(runs.map((run) => run.tierWeeks.get(name) ?? 0)) ?? 0);
    lines.push(
      `| ${mix.name} | ${tier("bronze")} | ${tier("silver")} | ${tier("gold")} | ${tier("illuminated")} | ${share(median(runs.map((run) => run.soloGold)) ?? 0)} |`,
    );
  }
  lines.push("");
  for (const setting of SETTINGS) {
    lines.push(`## Courbe ${setting.name} × (n − 1)`, "");
    lines.push(`| Clan | ${LEVELS.map((l) => `Niv. ${l}`).join(" | ")} |`);
    lines.push(`|---|${LEVELS.map(() => "---").join("|")}|`);
    for (const mix of MIXES) {
      const runs = Array.from({ length: CLANS }, (_, seed) =>
        simulateClan(mix, setting.goal, setting.level, WEEKS, seed + 1),
      );
      const cells = LEVELS.map((level) =>
        weeks(median(runs.map((run) => run.levelWeeks.get(level) ?? null))),
      );
      lines.push(`| ${mix.name} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  writeFileSync(new URL("./results.md", import.meta.url), lines.join("\n"));
});
