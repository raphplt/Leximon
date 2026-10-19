import { createHash } from "node:crypto";
import {
  type CatalogCollectionFile,
  type CatalogManifest,
  catalogCollectionFileSchema,
  catalogManifestSchema,
} from "@leximon/contract";

/** A catalogue release (D-023), read and checked, ready to publish. */
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
