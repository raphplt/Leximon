/**
 * The words found by patrons, between the base and the content pipeline:
 * - `pnpm finds:export` writes `content/pipeline/data/finds.json`, the words waiting for their
 *   collection, which `select` places first;
 * - `pnpm finds:reject <word id>` sets aside a word the quality check refused: its patron gets
 *   the right back.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rejectFind, reservedFinds } from "../src/catalog/index";
import { createDb } from "../src/client";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FINDS_FILE = join(REPO_ROOT, "content", "pipeline", "data", "finds.json");

const [command, wordId] = process.argv.slice(2);
if (command !== "export" && !(command === "reject" && wordId !== undefined)) {
  console.error("Usage : pnpm finds:export | pnpm finds:reject <id du mot>");
  process.exit(1);
}

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
const { db, close } = createDb(url, { maxConnections: 1 });
try {
  if (command === "export") {
    const words = await reservedFinds(db);
    await mkdir(dirname(FINDS_FILE), { recursive: true });
    await writeFile(FINDS_FILE, `${JSON.stringify({ words }, null, 2)}\n`);
    console.info(`${words.length} mots dénichés écrits dans ${FINDS_FILE}`);
  } else if (await rejectFind(db, wordId ?? "", new Date())) {
    console.info(`${wordId} écarté : son mécène retrouve son droit de dénicher.`);
  } else {
    console.error(`Aucun mot déniché en attente sous l'id ${wordId}.`);
    process.exitCode = 1;
  }
} finally {
  await close();
}
