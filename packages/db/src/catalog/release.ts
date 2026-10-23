import { createHash } from "node:crypto";
import {
  type CatalogCollectionFile,
  type CatalogEngravingIndex,
  type CatalogManifest,
  catalogCollectionFileSchema,
  catalogManifestSchema,
} from "@leximon/contract";

/** A catalogue release, read and checked, ready to publish. */
export interface Release {
  readonly manifest: CatalogManifest;
  readonly collections: readonly CatalogCollectionFile[];
}

export type ParsedRelease =
  | { readonly ok: true; readonly release: Release }
  | { readonly ok: false; readonly problems: readonly string[] };

/** Length of the content hash in a collection file name. */
const HASH_LENGTH = 12;

function json(bytes: Uint8Array | undefined): unknown {
  if (bytes === undefined) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/**
 * Validates every file of a release against the contract, and the rules that cross files: the
 * hash in each file name, the card counts, and a card id used only once in the whole catalogue.
 *
 * @param files contents keyed by path relative to the release folder
 */
export function parseRelease(files: ReadonlyMap<string, Uint8Array>): ParsedRelease {
  const manifest = catalogManifestSchema.safeParse(json(files.get("manifest.json")));
  if (!manifest.success) {
    return { ok: false, problems: ["manifest.json is missing or does not follow the contract"] };
  }

  const problems: string[] = [];
  const collections: CatalogCollectionFile[] = [];
  const owners = new Map<string, string>();
  for (const entry of manifest.data.collections) {
    const bytes = files.get(entry.file);
    if (bytes === undefined) {
      problems.push(`${entry.file} is listed in the manifest but missing`);
      continue;
    }
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LENGTH);
    if (!entry.file.endsWith(`.${hash}.json`)) {
      problems.push(`${entry.file} does not match its content (hash ${hash})`);
    }
    const parsed = catalogCollectionFileSchema.safeParse(json(bytes));
    if (!parsed.success) {
      problems.push(`${entry.file} does not follow the contract`);
      continue;
    }
    const file = parsed.data;
    if (file.id !== entry.id || file.name !== entry.name) {
      problems.push(`${entry.file} is not the collection the manifest announces (${entry.id})`);
    }
    if (file.cards.length !== entry.cardCount) {
      problems.push(
        `${entry.file} holds ${file.cards.length} cards, the manifest says ${entry.cardCount}`,
      );
    }
    for (const card of file.cards) {
      if (card.collectionId !== file.id) {
        problems.push(`${card.id} is in ${file.id} but claims ${card.collectionId}`);
      }
      const owner = owners.get(card.id);
      if (owner !== undefined) problems.push(`${card.id} appears in both ${owner} and ${file.id}`);
      owners.set(card.id, file.id);
    }
    collections.push(file);
  }
  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, release: { manifest: manifest.data, collections } };
}

/** Engraving files the release refers to, relative to the catalogue root, each once, sorted. */
export function engravingFiles(release: Release): string[] {
  const paths = new Set<string>();
  for (const collection of release.collections) {
    if (collection.engraving) paths.add(collection.engraving.ink);
    for (const card of collection.cards) {
      if (!card.engraving) continue;
      paths.add(card.engraving.ink);
      paths.add(card.engraving.fill);
    }
  }
  return [...paths].sort();
}

/** The ink of every engraved card of the release, by card id: `engravings.json`. */
export function engravingIndex(release: Release): CatalogEngravingIndex {
  const inks: Record<string, string> = {};
  for (const collection of release.collections) {
    for (const card of collection.cards) {
      if (card.engraving) inks[card.id] = card.engraving.ink;
    }
  }
  return { version: release.manifest.version, inks };
}

/**
 * Collection files, relative to the catalogue root, that none of the given manifests lists. The
 * previous manifest is kept among them: a page opened before the publication may still ask for its
 * files.
 */
export function staleCollectionFiles(
  present: readonly string[],
  kept: readonly CatalogManifest[],
): string[] {
  const listed = new Set(kept.flatMap((manifest) => manifest.collections.map((c) => c.file)));
  return present.filter((path) => !listed.has(path)).sort();
}

/** Audio files the release refers to, relative to the catalogue root, each once, sorted. */
export function pronunciationFiles(release: Release): string[] {
  const paths = new Set<string>();
  for (const collection of release.collections) {
    for (const card of collection.cards) {
      if (card.pronunciation) paths.add(card.pronunciation.audio);
    }
  }
  return [...paths].sort();
}

/**
 * Checks files the release refers to: each must exist and, like the collection files, match the
 * content hash in its name, since it is cached for good once published.
 *
 * @param files contents keyed by path, `undefined` for a file that could not be found
 * @param step the pipeline command that writes them, named when one is missing
 */
function assetProblems(files: ReadonlyMap<string, Uint8Array | undefined>, step: string): string[] {
  const problems: string[] = [];
  for (const [path, bytes] of files) {
    if (bytes === undefined) {
      problems.push(`${path} is referenced by a card but missing (run ${step})`);
      continue;
    }
    const named = /\.([0-9a-f]{12})(?:\.[a-z]+)?\.(?:webp|mp3)$/.exec(path)?.[1];
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LENGTH);
    if (named !== undefined && named !== hash) {
      problems.push(`${path} does not match its content (hash ${hash})`);
    }
  }
  return problems;
}

/** Engraving files: `gravures/<card>.<hash12>.<kind>.webp`. */
export function engravingProblems(files: ReadonlyMap<string, Uint8Array | undefined>): string[] {
  return assetProblems(files, "gravures-render");
}

/** Audio files: `prononciation/<card>.<hash12>.mp3`. */
export function pronunciationProblems(
  files: ReadonlyMap<string, Uint8Array | undefined>,
): string[] {
  return assetProblems(files, "prononciation-audio");
}
