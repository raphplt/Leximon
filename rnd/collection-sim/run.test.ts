/**
 * Runs every scenario and writes results.md next to this file.
 *   pnpm --filter @leximon/core exec vitest run --root ../.. rnd/collection-sim
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { RARITIES, type Rarity } from "../../packages/core/src/index";
import { type Scenario, type Summary, summarize } from "./simulate";

/** Rules of the first simulation, pinned so that results.md stays reproducible. */
const FIRST_RUN_PITY = [{ minRarity: "precious", afterBoosters: 10 }] as const;

const LABELS: Record<Rarity, string> = {
  common: "Courant",
  uncommon: "Peu courant",
  rare: "Rare",
  precious: "Précieux",
  epic: "Épique",
  legendary: "Légendaire",
};
const PROFILES = [
  { name: "occasionnel", boostersPerDay: 3 },
  { name: "régulier", boostersPerDay: 8 },
  { name: "assidu", boostersPerDay: 20 },
];

function scenarios(catalogSize: number, days: number, players: number): Scenario[] {
  return PROFILES.flatMap((profile) =>
    [false, true].flatMap((duplicateProtection) =>
      [0, 0.5].map((tradeRate) => ({
        label: `${profile.name} · ${duplicateProtection ? "anti-doublons" : "actuel"} · ${tradeRate > 0 ? "échanges" : "sans échanges"}`,
        catalogSize,
        boostersPerDay: profile.boostersPerDay,
        duplicateProtection,
        tradeRate,
        days,
        players,
        pity: FIRST_RUN_PITY,
      })),
    ),
  );
}

const day = (value: number | null) => (value === null ? "jamais" : `${value} j`);
const pct = (value: number | undefined) =>
  value === undefined ? "—" : `${(value * 100).toFixed(0)} %`;

function table(title: string, summaries: Summary[], checkpoints: number[]): string {
  const head = `| Scénario | 1re Épique | 1re Légendaire (médiane / 90 %) | ${RARITIES.map((r) => `${LABELS[r]} complets`).join(" | ")} | ${checkpoints.map((d) => `Possédé à ${d} j`).join(" | ")} | Doublons (30 premiers jours) |`;
  const sep = `|${"---|".repeat(3 + RARITIES.length + checkpoints.length + 1)}`;
  const rows = summaries.map((s) =>
    [
      s.scenario.label,
      day(s.firstEpicMedianDay),
      `${day(s.firstLegendaryMedianDay)} / ${day(s.firstLegendaryP90Day)}`,
      ...RARITIES.map((r) => day(s.tierMedianDay[r])),
      ...checkpoints.map((d) => pct(s.ownedShareMedianAt[d])),
      pct(s.duplicateShareMedian),
    ].join(" | "),
  );
  return [`### ${title}`, "", head, sep, ...rows.map((r) => `| ${r} |`), ""].join("\n");
}

it("runs the collection scenarios", { timeout: 600_000 }, () => {
  const started = performance.now();
  const whole = scenarios(10_000, 1095, 40).map(summarize);
  const set = scenarios(150, 365, 200).map(summarize);
  const sweep = [150, 300, 500, 1000].flatMap((catalogSize) =>
    [false, true].map((duplicateProtection) =>
      summarize({
        label: `${catalogSize} cartes · ${duplicateProtection ? "anti-doublons" : "actuel"} · échanges`,
        catalogSize,
        boostersPerDay: 8,
        duplicateProtection,
        tradeRate: 0.5,
        days: 365,
        players: 100,
        pity: FIRST_RUN_PITY,
      }),
    ),
  );
  const fiveHundred = PROFILES.map((profile) =>
    summarize({
      label: `${profile.name} · 500 cartes · anti-doublons · échanges`,
      catalogSize: 500,
      boostersPerDay: profile.boostersPerDay,
      duplicateProtection: true,
      tradeRate: 0.5,
      days: 730,
      players: 100,
      pity: FIRST_RUN_PITY,
    }),
  );
  const seconds = ((performance.now() - started) / 1000).toFixed(1);

  const report = [
    "# Résultats bruts de la simulation",
    "",
    `Généré par rnd/collection-sim/run.test.ts en ${seconds} s. Médianes sur 40 joueurs (catalogue entier) et 200 joueurs (collection).`,
    "",
    table(
      "Boosters généraux, catalogue de 10 000 cartes, horizon 3 ans",
      whole,
      [30, 180, 365, 1095],
    ),
    table("Boosters par collection, collection de 150 cartes, horizon 1 an", set, [7, 30, 90, 365]),
    table(
      "Taille de collection, joueur régulier (8 boosters/jour) avec échanges, horizon 1 an",
      sweep,
      [7, 30, 90, 365],
    ),
    table(
      "Collection de 500 cartes, anti-doublons et échanges, tous profils, horizon 2 ans",
      fiveHundred,
      [30, 90, 180, 365],
    ),
  ].join("\n");
  writeFileSync(new URL("./results.md", import.meta.url), report);
});
