import type { CatalogCard } from "@leximon/contract";
import { cache } from "react";
import { fetchCollections, fetchManifest } from "./catalog";

/**
 * The published catalogue, read by the server for a card's public page and its shared image.
 * The server needs an absolute address: `CATALOG_URL`, else the public one when it is absolute
 * (the CDN), else the web app's own `/catalog` in local development.
 */
const PUBLIC_CATALOG_URL = process.env.NEXT_PUBLIC_CATALOG_URL ?? "";
const SERVER_CATALOG_URL =
  process.env.CATALOG_URL ??
  (/^https?:\/\//.test(PUBLIC_CATALOG_URL)
    ? PUBLIC_CATALOG_URL
    : `http://localhost:${process.env.PORT ?? "3000"}/catalog`);

export interface PublicCard {
  readonly card: CatalogCard;
  readonly collectionName: string;
  /** Cards in the whole catalogue, for the page's pitch. */
  readonly catalogSize: number;
}

interface ServerCatalog {
  readonly version: string;
  readonly cards: ReadonlyMap<string, PublicCard>;
}

/**
 * The last version parsed, kept by the instance between requests: a release never changes once
 * published, so parsing and validating its 2 MB again for each shared card would only cost time.
 * Only the resolved value is kept, never a pending promise, which a Worker may not share between
 * requests.
 */
let parsed: ServerCatalog | null = null;

/**
 * The catalogue for this request. Only the small manifest is read each time, so a new release
 * shows at once; the page and its metadata share one read.
 */
const serverCatalog = cache(async (): Promise<ServerCatalog> => {
  const manifest = await fetchManifest(SERVER_CATALOG_URL);
  if (parsed?.version === manifest.version) return parsed;
  const collections = await fetchCollections(manifest, SERVER_CATALOG_URL);
  const catalogSize = collections.reduce((sum, collection) => sum + collection.cards.length, 0);
  const cards = new Map(
    collections.flatMap((collection) =>
      collection.cards.map(
        (card) => [card.id, { card, collectionName: collection.name, catalogSize }] as const,
      ),
    ),
  );
  parsed = { version: manifest.version, cards };
  return parsed;
});

/** A card and what its page says around it; `null` when no published card has this id. */
export async function readCatalogCard(cardId: string): Promise<PublicCard | null> {
  return (await serverCatalog()).cards.get(cardId) ?? null;
}
