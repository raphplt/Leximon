/**
 * Calibrates the Epic and Legendary guarantees (P12) and writes calibration.md.
 *   pnpm --filter @leximon/core exec vitest run --root ../.. rnd/collection-sim/calibrate
 *
 * Setting from the decisions: collections of 500 cards, no duplicate protection (P15), trades.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import type { PityRule } from "../../packages/core/src/index";
import { type Summary, summarize } from "./simulate";

const VARIANTS: { label: string; pity: PityRule[] }[] = [
  { label: "aucune garantie", pity: [] },
  { label: "Épique 30 · Légendaire 100", pity: guarantees(30, 100) },
  { label: "Épique 30 · Légendaire 150", pity: guarantees(30, 150) },
  { label: "Épique 40 · Légendaire 150", pity: guarantees(40, 150) },
  { label: "Épique 40 · Légendaire 200", pity: guarantees(40, 200) },
  { label: "Épique 50 · Légendaire 200", pity: guarantees(50, 200) },
];
const PROFILES = [
  { name: "occasionnel", boostersPerDay: 3 },
  { name: "régulier", boostersPerDay: 8 },
  { name: "assidu", boostersPerDay: 20 },
];

function guarantees(epic: number, legendary: number): PityRule[] {
  return [
    { minRarity: "epic", afterBoosters: epic },
    { minRarity: "legendary", afterBoosters: legendary },
  ];
}

const day = (value: number | null) => (value === null ? "jamais" : `${value} j`);

function row(name: string, s: Summary): string {
  return [
    name,
    `${day(s.firstEpicMedianDay)} / ${day(s.firstEpicP90Day)}`,
    `${day(s.firstLegendaryMedianDay)} / ${day(s.firstLegendaryP90Day)} / ${day(s.firstLegendaryP99Day)}`,
    s.epicPer100.toFixed(2),
    s.legendaryPer100.toFixed(2),
    day(s.tierMedianDay.legendary),
  ].join(" | ");
}

it("calibrates the guarantees", { timeout: 900_000 }, () => {
  const started = performance.now();
  const sections = PROFILES.map((profile) => {
    const rows = VARIANTS.map((variant) =>
      row(
        variant.label,
        summarize({
          label: variant.label,
          catalogSize: 500,
          boostersPerDay: profile.boostersPerDay,
          duplicateProtection: false,
          tradeRate: 0.5,
          days: 730,
          players: 150,
          pity: variant.pity,
        }),
      ),
    );
    return [
      `### Joueur ${profile.name} (${profile.boostersPerDay} boosters par jour)`,
      "",
      "| Garanties | 1re Épique (médiane / 90 %) | 1re Légendaire (médiane / 90 % / 99 %) | Épiques pour 100 boosters | Légendaires pour 100 boosters | Légendaires complètes |",
      "|---|---|---|---|---|---|",
      ...rows.map((r) => `| ${r} |`),
      "",
    ].join("\n");
  });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  writeFileSync(
    new URL("./calibration.md", import.meta.url),
    [
      "# Calibrage des garanties Épique et Légendaire",
      "",
      `Généré par rnd/collection-sim/calibrate.test.ts en ${seconds} s. Collection de 500 cartes, sans anti-doublons, avec échanges, 150 joueurs par ligne, horizon 2 ans.`,
      "",
      ...sections,
    ].join("\n"),
  );
});
