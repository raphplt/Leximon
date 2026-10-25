import type { Rarity } from "@leximon/core";
import {
  type CatalogCard,
  type CatalogCollectionFile,
  type CatalogManifest,
  catalogCollectionFileSchema,
  catalogEngravingIndexSchema,
  catalogManifestSchema,
} from "../catalog";

/**
 * The published catalogue, read by the web and the app from where each serves it: the manifest
 * first (short cache), then every collection file it lists (immutable, cached for good). Both
 * are validated with the contract, like any external input.
 */

/** URL of a file published with the catalogue (an engraving), from its path in a collection file. */
export function catalogFileUrl(path: string, baseUrl: string): string {
  return `${baseUrl}/${path}`;
}

export interface Catalog {
  readonly version: string;
  readonly collections: readonly CatalogCollectionFile[];
  readonly cardsById: ReadonlyMap<string, CatalogCard>;
}

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new CatalogError("network_error");
  }
  if (!response.ok) throw new CatalogError(`catalog_unavailable_${response.status}`);
  return response.json().catch(() => null);
}

/** The manifest, read again on each call: it is the only file that changes in place. */
export async function fetchManifest(baseUrl: string): Promise<CatalogManifest> {
  const manifest = catalogManifestSchema.safeParse(
    await fetchJson(`${baseUrl}/manifest.json`, { cache: "no-cache" }),
  );
  if (!manifest.success) throw new CatalogError("invalid_manifest");
  return manifest.data;
}

/** The collection files a manifest lists, immutable, so taken from the cache when there. */
export function fetchCollections(
  manifest: CatalogManifest,
  baseUrl: string,
): Promise<CatalogCollectionFile[]> {
  return Promise.all(
    manifest.collections.map(async (entry) => {
      const file = catalogCollectionFileSchema.safeParse(
        await fetchJson(`${baseUrl}/${entry.file}`, { cache: "force-cache" }),
      );
      if (!file.success) throw new CatalogError(`invalid_collection_${entry.id}`);
      return file.data;
    }),
  );
}

export async function fetchCatalog(baseUrl: string): Promise<Catalog> {
  const manifest = await fetchManifest(baseUrl);
  const collections = await fetchCollections(manifest, baseUrl);
  const cardsById = new Map(
    collections.flatMap((collection) => collection.cards.map((card) => [card.id, card] as const)),
  );
  return { version: manifest.version, collections, cardsById };
}

/** The ink of each engraved card, by id: a fraction of the catalogue, for avatars and emblems. */
export async function fetchEngravingInks(baseUrl: string): Promise<ReadonlyMap<string, string>> {
  const index = catalogEngravingIndexSchema.safeParse(
    await fetchJson(`${baseUrl}/engravings.json`, { cache: "no-cache" }),
  );
  if (!index.success) throw new CatalogError("invalid_engravings");
  return new Map(Object.entries(index.data.inks));
}

export function collectionName(catalog: Catalog, collectionId: string): string {
  return catalog.collections.find((c) => c.id === collectionId)?.name ?? collectionId;
}

/**
 * The card to show for a drawn or owned id. An id missing from the catalogue (a card retired
 * before this release, or a newer release than the one loaded) still gets a card.
 */
export function cardOrPlaceholder(catalog: Catalog, id: string, rarity: Rarity): CatalogCard {
  return (
    catalog.cardsById.get(id) ?? {
      id,
      word: id,
      partOfSpeech: "mot",
      era: null,
      definition: "Ce mot n'est pas dans le catalogue chargé.",
      etymology: null,
      quote: null,
      rarity,
      collectionId: "inconnue",
      themes: [],
      perBillion: null,
    }
  );
}
