import type { CatalogCard, CatalogCollectionFile } from "@leximon/contract";
import { fetchCatalog } from "./catalog";

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

/**
 * The collections for a card page. Collection files are immutable and fetched with
 * `force-cache`: only the small manifest is read on each request, so a new release shows at once.
 */
async function serverCollections(): Promise<readonly CatalogCollectionFile[]> {
  return (await fetchCatalog(SERVER_CATALOG_URL)).collections;
}

/** A card and what its page says around it; `null` when no published card has this id. */
export async function readCatalogCard(cardId: string): Promise<PublicCard | null> {
  const collections = await serverCollections();
  let catalogSize = 0;
  let found: PublicCard | null = null;
  for (const collection of collections) {
    catalogSize += collection.cards.length;
    const card = collection.cards.find((candidate) => candidate.id === cardId);
    if (card !== undefined) found = { card, collectionName: collection.name, catalogSize: 0 };
  }
  return found === null ? null : { ...found, catalogSize };
}
