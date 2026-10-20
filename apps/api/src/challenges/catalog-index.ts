import { type Database, schema } from "@leximon/db";
import { and, eq, isNull, lte } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;

/** Published cards grouped by collection, to pick the wrong choices of a question. */
export interface CatalogIndex {
  readonly collectionOf: ReadonlyMap<string, string>;
  readonly byCollection: ReadonlyMap<string, readonly string[]>;
  readonly all: readonly string[];
}

/**
 * Loads the published, drawable cards with their collection. Cached in the isolate for a minute,
 * like the booster pools: shared catalog data, never player state.
 */
export function createCatalogIndexLoader(ttlMs = CACHE_TTL_MS) {
  let cached: { index: CatalogIndex; expiresAt: number } | null = null;

  return async (db: Database, now: number): Promise<CatalogIndex> => {
    if (cached !== null && cached.expiresAt > now) {
      return cached.index;
    }
    const { cards, collections } = schema;
    const rows = await db
      .select({ id: cards.id, collectionId: cards.collectionId })
      .from(cards)
      .innerJoin(collections, eq(collections.id, cards.collectionId))
      .where(and(isNull(cards.retiredAt), lte(collections.publishedAt, new Date(now))))
      .orderBy(cards.id);

    const byCollection = new Map<string, string[]>();
    for (const row of rows) {
      const ids = byCollection.get(row.collectionId) ?? [];
      ids.push(row.id);
      byCollection.set(row.collectionId, ids);
    }
    const index: CatalogIndex = {
      collectionOf: new Map(rows.map((row) => [row.id, row.collectionId])),
      byCollection,
      all: rows.map((row) => row.id),
    };
    cached = { index, expiresAt: now + ttlMs };
    return index;
  };
}

export type CatalogIndexLoader = ReturnType<typeof createCatalogIndexLoader>;
