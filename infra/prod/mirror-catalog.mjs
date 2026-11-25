// Copies the catalogue served by leximon.fr into apps/web/public/catalog, file for file. The web
// deployment ships that folder whole: a front-only deployment from a computer without the content
// pipeline's data must ship exactly what is online, never an empty or partial catalogue.
//
// The catalogue describes itself: the manifest and the indexes beside it name the collection files,
// and those name every engraving, pronunciation and cabinet file.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = process.env.CATALOG_ORIGIN ?? "https://leximon.fr";
const BASE = `${ORIGIN}/catalog/`;
const TARGET = join(dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/catalog");
const INDEXES = ["manifest.json", "engravings.json", "cabinet.json", "finders.json"];
// A file of the catalogue, as the JSON files name it: `gravures/abajoue.98dfd294fb7f.ink.webp`.
const FILE_PATH = /^(?:collections|gravures|prononciation|cabinet)\/[\w.-]+\.[a-z0-9]+$/;
const PARALLEL = 16;

const ATTEMPTS = 5;

// A connection can drop among thousands of requests: each file gets a few tries, further apart.
async function download(path) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(BASE + path, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      if (response.status === 404) throw new Error(`${path}: introuvable en ligne (404)`);
      if (attempt === ATTEMPTS)
        throw new Error(`${path}: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (attempt === ATTEMPTS || String(error).includes("404")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
}

function pathsIn(value, found) {
  if (typeof value === "string") {
    if (FILE_PATH.test(value)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) pathsIn(item, found);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) pathsIn(item, found);
  }
  return found;
}

async function save(path, bytes) {
  await mkdir(dirname(join(TARGET, path)), { recursive: true });
  await writeFile(join(TARGET, path), bytes);
}

const files = new Map();
const queued = new Set();
let pending = [...INDEXES];
for (const path of pending) queued.add(path);

while (pending.length > 0) {
  const next = [];
  for (let i = 0; i < pending.length; i += PARALLEL) {
    await Promise.all(
      pending.slice(i, i + PARALLEL).map(async (path) => {
        const bytes = await download(path);
        files.set(path, bytes);
        if (!path.endsWith(".json")) return;
        for (const named of pathsIn(JSON.parse(new TextDecoder().decode(bytes)), new Set())) {
          if (queued.has(named)) continue;
          queued.add(named);
          next.push(named);
        }
      }),
    );
  }
  pending = next;
  process.stdout.write(`\r${files.size} fichiers`);
}

// Everything is downloaded before the folder is touched: a failure leaves it as it was.
await rm(TARGET, { recursive: true, force: true });
for (const [path, bytes] of files) await save(path, bytes);
const manifest = JSON.parse(new TextDecoder().decode(files.get("manifest.json")));
process.stdout.write(
  `\nCatalogue ${manifest.version} recopié depuis ${ORIGIN} : ${files.size} fichiers.\n`,
);
