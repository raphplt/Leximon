import type { CatalogCard } from "@leximon/contract";
import { fetchCollections, fetchManifest } from "@leximon/contract/client";
import { cache } from "react";
import { type PackCollection, packOf } from "@/booster/pack-looks";

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
  /** Its collection's sachet, for the seal beside the name. */
  readonly seal: PackCollection;
  /** Cards in the whole catalogue, for the page's pitch. */
  readonly catalogSize: number;
  /** The cards around it in its collection: the links search engines follow from card to card. */
  readonly neighbours: readonly CardLink[];
}

export interface CardLink {
  readonly id: string;
  readonly word: string;
}

const NEIGHBOURS_EACH_SIDE = 3;

/** The cards before and after this one in its collection, which is read as a ring. */
function neighboursOf(cards: readonly CatalogCard[], at: number): CardLink[] {
  const links = new Map<string, CardLink>();
  for (let step = -NEIGHBOURS_EACH_SIDE; step <= NEIGHBOURS_EACH_SIDE; step++) {
    const card = cards[(at + step + cards.length) % cards.length];
    if (step !== 0 && card !== undefined) links.set(card.id, { id: card.id, word: card.word });
  }
  links.delete(cards[at]?.id ?? "");
  return [...links.values()];
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
        (card, at) =>
          [
            card.id,
            {
              card,
              collectionName: collection.name,
              seal: packOf(collection),
              catalogSize,
              neighbours: neighboursOf(collection.cards, at),
            },
          ] as const,
      ),
    ),
  );
  parsed = { version: manifest.version, cards };
  return parsed;
});

/** Every published card id, for the sitemap. */
export async function readCatalogCardIds(): Promise<readonly string[]> {
  return [...(await serverCatalog()).cards.keys()];
}

/** A card and what its page says around it; `null` when no published card has this id. */
export async function readCatalogCard(cardId: string): Promise<PublicCard | null> {
  return (await serverCatalog()).cards.get(cardId) ?? null;
}
