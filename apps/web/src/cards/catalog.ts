import {
  type CatalogCard,
  type CatalogCollectionFile,
  catalogCollectionFileSchema,
  catalogManifestSchema,
} from "@leximon/contract";
import type { Rarity } from "@leximon/core";

/**
 * The published catalogue (D-023), read in the browser: the manifest first (short cache), then
 * every collection file it lists (immutable, cached for good). Both are validated with the
 * shared contract, like any external input.
 */

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const CATALOG_URL = process.env.NEXT_PUBLIC_CATALOG_URL ?? "/catalog";

/** URL of a file published with the catalogue (an engraving), from its path in a collection file. */
export function catalogFileUrl(path: string, baseUrl: string = CATALOG_URL): string {
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

export async function fetchCatalog(baseUrl: string = CATALOG_URL): Promise<Catalog> {
  const manifest = catalogManifestSchema.safeParse(
    await fetchJson(`${baseUrl}/manifest.json`, { cache: "no-cache" }),
  );
  if (!manifest.success) throw new CatalogError("invalid_manifest");
  const collections = await Promise.all(
    manifest.data.collections.map(async (entry) => {
      const file = catalogCollectionFileSchema.safeParse(
        await fetchJson(`${baseUrl}/${entry.file}`, { cache: "force-cache" }),
      );
      if (!file.success) throw new CatalogError(`invalid_collection_${entry.id}`);
      return file.data;
    }),
  );
  const cardsById = new Map(
    collections.flatMap((collection) => collection.cards.map((card) => [card.id, card] as const)),
  );
  return { version: manifest.data.version, collections, cardsById };
}

let loading: Promise<Catalog> | null = null;

/** The catalogue, fetched once per page load and shared by every screen. */
export function loadCatalog(): Promise<Catalog> {
  loading ??= fetchCatalog().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
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
      definition: "Ce mot n'est pas dans le catalogue chargé. Recharge la page pour le voir.",
      etymology: null,
      quote: null,
      rarity,
      collectionId: "inconnue",
      themes: [],
      perBillion: null,
    }
  );
}
