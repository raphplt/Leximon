/**
 * `pnpm experiments:report [key] [--since YYYY-MM-DD]` (D-030).
 *
 * Prints the figures of an A/B test per variant, read from the event log, and compares each
 * variant with the control: share of openings finished with « Tout révéler », return on day 1
 * and on day 7. A p-value under 0.05 means the gap is unlikely to be chance.
 */

import { parseArgs } from "node:util";
import { compareProportions, EXPERIMENTS, type Proportion } from "@leximon/core";
import { experimentFigures, type VariantFigures } from "../src/analytics/report";
import { createDb } from "../src/client";

/** French decimals: a comma, not a point. */
function decimal(value: number, digits: number): string {
  return value.toFixed(digits).replace(".", ",");
}

function percent(value: number): string {
  return `${decimal(value * 100, 1)} %`;
}

function pValue(value: number | null): string {
  return value === null ? "—" : value < 0.001 ? "< 0,001" : decimal(value, 3);
}

const MEASURES: readonly {
  readonly label: string;
  readonly of: (figures: VariantFigures) => Proportion;
}[] = [
  { label: "Ouvertures écourtées", of: (f) => ({ successes: f.skipped, total: f.finished }) },
  { label: "Retour à J1", of: (f) => ({ successes: f.day1Returned, total: f.day1Eligible }) },
  { label: "Retour à J7", of: (f) => ({ successes: f.day7Returned, total: f.day7Eligible }) },
];

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { since: { type: "string" } },
  });
  const key = positionals[0] ?? "pack-shape";
  const experiment = EXPERIMENTS.find((candidate) => candidate.key === key);
  if (experiment === undefined) {
    console.error(
      `Unknown experiment "${key}". Known: ${EXPERIMENTS.map((e) => e.key).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }
  const since = values.since === undefined ? new Date(experiment.startsAt) : new Date(values.since);
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const { db, close } = createDb(url, { maxConnections: 1 });
  try {
    const figures = await experimentFigures(db, key, since, new Date());
    console.info(`Expérience ${key}, depuis le ${since.toISOString().slice(0, 10)}\n`);
    for (const f of figures) {
      const perDay = f.activeDays > 0 ? decimal(f.openings / f.activeDays, 2) : "—";
      const measures = MEASURES.map(({ label, of }) => {
        const { successes, total } = of(f);
        return `${label} ${total > 0 ? `${percent(successes / total)} (${successes}/${total})` : "—"}`;
      });
      console.info(
        [
          `${f.variant} : ${f.players} joueurs`,
          `${perDay} ouvertures par jour actif`,
          ...measures,
        ].join(" · "),
      );
    }
    const control = figures.find((f) => f.variant === experiment.variants[0]);
    for (const challenger of figures.filter((f) => f !== control)) {
      if (control === undefined) break;
      console.info(`\n${challenger.variant} comparé à ${control.variant} :`);
      for (const { label, of } of MEASURES) {
        const result = compareProportions(of(control), of(challenger));
        const gap = `${result.difference >= 0 ? "+" : ""}${decimal(result.difference * 100, 1)} points`;
        console.info(`- ${label} : ${gap}, p = ${pValue(result.pValue)}`);
      }
    }
  } finally {
    await close();
  }
}

await main();
