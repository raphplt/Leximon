/**
 * `pnpm catalog:publish [version] [--target <dir>] [--dry-run]`.
 *
 * Validates a release of content/releases (the latest by default), updates the `collections`
 * and `cards` tables, then copies the files where the apps read them. Engravings, audio and
 * collection files go first and the manifest last, so that a reader never sees a manifest
 * pointing at a missing file. Engravings and audio come from the content pipeline's output
 * (git-ignored binaries, never in content/releases): a release referring to a missing one is
 * refused. `engravings.json`, the ink of each card by id, is written from the release beside the
 * manifest. The words found by patrons that this release publishes give each finder their copy,
 * and `finders.json`, the pseudo signing each found card, is written from the base beside the
 * manifest, before it. So is `cabinet.json`, each card's cabinet file, copied from the content
 * pipeline's output when it wrote one (optional, unlike engravings and audio). Collection files listed by neither the new manifest nor the one it replaces are
 * deleted, so that each deployment does not carry every past release.
 */

import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type CatalogManifest,
  cabinetIndexSchema,
  catalogCabinetSchema,
  catalogManifestSchema,
} from "@leximon/contract";
import {
  applyCatalog,
  engravingFiles,
  engravingIndex,
  engravingProblems,
  loadPublishedCards,
  parseRelease,
  planCatalog,
  pronunciationFiles,
  pronunciationProblems,
  publishFinds,
  type Release,
  readFinders,
  staleCollectionFiles,
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
// Written by the pipeline's `cabinet`, with `rendered.json` listing each card's file.
const CABINETS_DIR = join(REPO_ROOT, "content", "pipeline", "data", "cabinet", "out");
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

async function writeAtomically(path: string, content: Uint8Array | string) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, path);
}

async function copyRelease(
  source: string,
  target: string,
  release: Release,
  files: Iterable<string>,
) {
  const collectionFiles = [...files].filter((path) => path !== "manifest.json");
  for (const path of collectionFiles) {
    await mkdir(dirname(join(target, path)), { recursive: true });
    await copyFile(join(source, path), join(target, path));
  }
  await writeAtomically(join(target, "engravings.json"), JSON.stringify(engravingIndex(release)));
  await writeAtomically(
    join(target, "manifest.json"),
    await readFile(join(source, "manifest.json")),
  );
}

/**
 * The cabinets of the release's cards that the pipeline wrote, each checked against the contract.
 * Cabinets are optional: a card without one, or a pipeline that never wrote them, opens none.
 */
async function readCabinets(cardIds: readonly string[]) {
  const listed = await readFile(join(CABINETS_DIR, "rendered.json"), "utf8").catch(() => null);
  const rendered = cabinetIndexSchema.shape.cards.safeParse(
    listed === null ? {} : JSON.parse(listed),
  );
  if (!rendered.success) throw new Error(`${CABINETS_DIR}/rendered.json is not a cabinet index`);
  const files = new Map<string, Uint8Array>();
  const index: Record<string, string> = {};
  for (const cardId of cardIds) {
    const path = rendered.data[cardId];
    if (path === undefined) continue;
    const bytes = await readFile(join(CABINETS_DIR, path));
    if (!catalogCabinetSchema.safeParse(JSON.parse(bytes.toString("utf8"))).success) {
      throw new Error(`${path} does not match the cabinet contract`);
    }
    files.set(path, bytes);
    index[cardId] = path;
  }
  return { files, index };
}

/** Deletes the cabinet files that neither this index nor the one it replaces lists. */
async function pruneCabinets(target: string, kept: ReadonlySet<string>): Promise<number> {
  const names = await readdir(join(target, "cabinet")).catch(() => [] as string[]);
  const stale = names.map((name) => `cabinet/${name}`).filter((path) => !kept.has(path));
  for (const path of stale) await rm(join(target, path));
  return stale.length;
}

async function publishedCabinets(target: string): Promise<string[]> {
  const content = await readFile(join(target, "cabinet.json"), "utf8").catch(() => null);
  if (content === null) return [];
  const parsed = cabinetIndexSchema.safeParse(JSON.parse(content));
  return parsed.success ? Object.values(parsed.data.cards) : [];
}

/** The manifest currently published in the target, if any. */
async function publishedManifest(target: string): Promise<CatalogManifest | null> {
  const content = await readFile(join(target, "manifest.json"), "utf8").catch(() => null);
  if (content === null) return null;
  try {
    const parsed = catalogManifestSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Deletes the collection files of releases older than the previous one. */
async function pruneCollections(target: string, kept: readonly CatalogManifest[]): Promise<number> {
  const names = await readdir(join(target, "collections")).catch(() => [] as string[]);
  const stale = staleCollectionFiles(
    names.map((name) => `collections/${name}`),
    kept,
  );
  for (const path of stale) await rm(join(target, path));
  return stale.length;
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

  const cardIds = parsed.release.collections.flatMap((collection) =>
    collection.cards.map((card) => card.id),
  );
  const cabinets = await readCabinets(cardIds);

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
        `${plan.retire.length} retired, ${engravings.size} engraving files, ${audio.size} audio files, ` +
        `${cabinets.files.size} cabinets`,
    );
    if (values["dry-run"]) return;
    const now = new Date();
    await applyCatalog(db, plan, now);
    const found = await publishFinds(db, cardIds, now);
    const target = values.target ?? DEFAULT_TARGET;
    const previous = await publishedManifest(target);
    await copyAssets(target, engravings);
    await copyAssets(target, audio);
    const cabinetsBefore = await publishedCabinets(target);
    await copyAssets(target, cabinets.files);
    // Before the manifest: a reader of the new catalogue finds its cabinets and finders there.
    await writeAtomically(join(target, "cabinet.json"), JSON.stringify({ cards: cabinets.index }));
    await writeAtomically(join(target, "finders.json"), JSON.stringify(await readFinders(db)));
    await copyRelease(source, target, parsed.release, files.keys());
    const kept = [parsed.release.manifest, ...(previous === null ? [] : [previous])];
    const pruned =
      (await pruneCollections(target, kept)) +
      (await pruneCabinets(target, new Set([...cabinetsBefore, ...cabinets.files.keys()])));
    console.info(
      `Database updated, ${found} found words published, files copied to ${target}, ` +
        `${pruned} old collection and cabinet files deleted`,
    );
  } finally {
    await close();
  }
}

await main();
