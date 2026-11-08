/**
 * `pnpm reserve:publish [--dry-run]`: loads `content/reserve/reserve.json`, written by the content
 * pipeline's `reserve` command, into the words patrons may find. Words it no longer lists leave
 * the reserve; a word already found stays found.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { reserveFileSchema } from "@leximon/contract";
import { publishReserve } from "../src/catalog/index";
import { createDb } from "../src/client";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RESERVE_FILE = join(REPO_ROOT, "content", "reserve", "reserve.json");

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });

const parsed = reserveFileSchema.safeParse(JSON.parse(await readFile(RESERVE_FILE, "utf8")));
if (!parsed.success) {
  console.error(`Reserve refused:\n${parsed.error.message}`);
  process.exit(1);
}
const ids = new Set(parsed.data.words.map((word) => word.id));
if (ids.size !== parsed.data.words.length) {
  console.error("Reserve refused: a word id appears twice.");
  process.exit(1);
}
console.info(`Reserve ${parsed.data.version}: ${parsed.data.words.length} words`);
if (!values["dry-run"]) {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const { db, close } = createDb(url, { maxConnections: 1 });
  try {
    const result = await publishReserve(db, parsed.data, new Date());
    console.info(`Database updated, ${result.removed} words left the reserve`);
  } finally {
    await close();
  }
}
