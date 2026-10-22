/**
 * `pnpm catalog:publish [version] [--target <dir>] [--dry-run]`.
 *
 * Validates a release of content/releases (the latest by default), updates the `collections`
 * and `cards` tables, then copies the files where the apps read them. Engravings, audio and
 * collection files go first and the manifest last, so that a reader never sees a manifest
 * pointing at a missing file. Engravings and audio come from the content pipeline's output
 * (git-ignored binaries, never in content/releases): a release referring to a missing one is
 * refused.
 */

import { copyFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  applyCatalog,
  engravingFiles,
  engravingProblems,
  loadPublishedCards,
  parseRelease,
  planCatalog,
  pronunciationFiles,
  pronunciationProblems,
} from "../src/catalog/index";
import { createDb } from "../src/client";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RELEASES_DIR = join(REPO_ROOT, "content", "releases");
// R2 is added with the production hosting; until then the web app serves the files.
const DEFAULT_TARGET = join(REPO_ROOT, "apps", "web", "public", "catalog");
// Written by `gravures-render`; paths in the catalogue are relative to this folder.
const ENGRAVINGS_DIR = join(REPO_ROOT, "content", "pipeline", "data", "gravures", "out");
// Written by `prononciation-audio`, likewise.
const PRONUNCIATIONS_DIR = join(REPO_ROOT, "content", "pipeline", "data", "prononciation", "out");
const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}\.\d+$/;

function versionKey(version: string): [string, number] {
  const [day = "", number = "0"] = version.split(".");
  return [day, Number(number)];
}

async function latestVersion(): Promise<string> {
  const versions = (await readdir(RELEASES_DIR)).filter((name) => VERSION_PATTERN.test(name));
  versions.sort((a, b) => {
    const [dayA, numberA] = versionKey(a);
    const [dayB, numberB] = versionKey(b);
    return dayA === dayB ? numberA - numberB : dayA < dayB ? -1 : 1;
  });
  const latest = versions.at(-1);
  if (latest === undefined) throw new Error(`No release in ${RELEASES_DIR}`);
  return latest;
}

async function readFiles(root: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(relative(root, path).split("\\").join("/"), await readFile(path));
  }
  return files;
}

async function readAssets(root: string, paths: readonly string[]) {
  const files = new Map<string, Uint8Array | undefined>();
  for (const path of paths) {
    files.set(
      path,
      await readFile(join(root, path)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      }),
    );
  }
  return files;
}

async function copyAssets(target: string, files: ReadonlyMap<string, Uint8Array | undefined>) {
  for (const [path, bytes] of files) {
    if (bytes === undefined) continue;
    await mkdir(dirname(join(target, path)), { recursive: true });
    await writeFile(join(target, path), bytes);
  }
}

async function copyRelease(source: string, target: string, files: Iterable<string>) {
  const collectionFiles = [...files].filter((path) => path !== "manifest.json");
  for (const path of collectionFiles) {
    await mkdir(dirname(join(target, path)), { recursive: true });
    await copyFile(join(source, path), join(target, path));
  }
  const temporary = join(target, "manifest.json.tmp");
  await writeFile(temporary, await readFile(join(source, "manifest.json")));
  await rename(temporary, join(target, "manifest.json"));
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { target: { type: "string" }, "dry-run": { type: "boolean" } },
  });
  const version = positionals[0] ?? (await latestVersion());
  const source = join(RELEASES_DIR, version);
  const files = await readFiles(source);

  const parsed = parseRelease(files);
  if (!parsed.ok) {
    console.error(`Release ${version} refused:\n- ${parsed.problems.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }

  const engravings = await readAssets(ENGRAVINGS_DIR, engravingFiles(parsed.release));
  const engravingIssues = engravingProblems(engravings);
  if (engravingIssues.length > 0) {
    console.error(
      `Release ${version} refused: engravings in ${ENGRAVINGS_DIR}\n- ${engravingIssues.join("\n- ")}`,
    );
    process.exitCode = 1;
    return;
  }
  const audio = await readAssets(PRONUNCIATIONS_DIR, pronunciationFiles(parsed.release));
  const audioIssues = pronunciationProblems(audio);
  if (audioIssues.length > 0) {
    console.error(
      `Release ${version} refused: audio in ${PRONUNCIATIONS_DIR}\n- ${audioIssues.join("\n- ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const { db, close } = createDb(url, { maxConnections: 1 });
  try {
    const plan = planCatalog(parsed.release, await loadPublishedCards(db));
    if (plan.rarityConflicts.length > 0) {
      const lines = plan.rarityConflicts.map((c) => `${c.id}: ${c.published} → ${c.release}`);
      console.error(`Release ${version} refused: published rarities never change.`);
      console.error(`Publish these words as new cards instead:\n- ${lines.join("\n- ")}`);
      process.exitCode = 1;
      return;
    }
    console.info(
      `Release ${version}: ${plan.collections.length} collections, ${plan.cards.length} cards, ` +
        `${plan.retire.length} retired, ${engravings.size} engraving files, ${audio.size} audio files`,
    );
    if (values["dry-run"]) return;
    await applyCatalog(db, plan, new Date());
    const target = values.target ?? DEFAULT_TARGET;
    await copyAssets(target, engravings);
    await copyAssets(target, audio);
    await copyRelease(source, target, files.keys());
    console.info(`Database updated, files copied to ${target}`);
  } finally {
    await close();
  }
}

await main();
