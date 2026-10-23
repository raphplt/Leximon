import { normalizeWord } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, lte } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;

/**
 * Published cards grouped by collection, to pick the wrong choices of a question, and the words
 * of every published card, retired ones included, to grade a typed answer.
 */
export interface CatalogIndex {
  readonly collectionOf: ReadonlyMap<string, string>;
  readonly byCollection: ReadonlyMap<string, readonly string[]>;
  readonly all: readonly string[];
  readonly wordOf: ReadonlyMap<string, string>;
  /** Every word, normalized: a typed slip that spells another card is no slip. */
  readonly words: ReadonlySet<string>;
}

/**
 * Loads the published cards with their collection and word. Cached in the isolate for a minute,
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
      .select({
        id: cards.id,
        collectionId: cards.collectionId,
        lemma: cards.lemma,
        retiredAt: cards.retiredAt,
      })
      .from(cards)
      .innerJoin(collections, eq(collections.id, cards.collectionId))
      .where(lte(collections.publishedAt, new Date(now)))
      .orderBy(cards.id);
    const drawable = rows.filter((row) => row.retiredAt === null);

    const byCollection = new Map<string, string[]>();
    for (const row of drawable) {
      const ids = byCollection.get(row.collectionId) ?? [];
      ids.push(row.id);
      byCollection.set(row.collectionId, ids);
    }
    const index: CatalogIndex = {
      collectionOf: new Map(drawable.map((row) => [row.id, row.collectionId])),
      byCollection,
      all: drawable.map((row) => row.id),
      wordOf: new Map(rows.map((row) => [row.id, row.lemma])),
      words: new Set(rows.map((row) => normalizeWord(row.lemma))),
    };
    cached = { index, expiresAt: now + ttlMs };
    return index;
  };
}

export type CatalogIndexLoader = ReturnType<typeof createCatalogIndexLoader>;
