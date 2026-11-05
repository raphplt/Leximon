import { type ChoiceCard, normalizeWord } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, lte } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;

/**
 * Published cards grouped by collection, to pick the wrong choices of a question, the words of
 * every published card, retired ones included, to grade a typed answer, and the themes of a card.
 */
export interface CatalogIndex {
  readonly collectionOf: ReadonlyMap<string, string>;
  readonly byCollection: ReadonlyMap<string, readonly string[]>;
  readonly all: readonly string[];
  readonly wordOf: ReadonlyMap<string, string>;
  readonly themesOf: ReadonlyMap<string, readonly string[]>;
  /** Drawable cards of each theme: the close wrong choices of a demanding question. */
  readonly byTheme: ReadonlyMap<string, readonly string[]>;
  /** Every word, normalized: a typed slip that spells another card is no slip. */
  readonly words: ReadonlySet<string>;
  /** Drawable cards with their rarity, to pick the choices of a joust question. */
  readonly choiceCards: readonly ChoiceCard[];
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
    const { cardThemes, cards, collections } = schema;
    const rows = await db
      .select({
        id: cards.id,
        collectionId: cards.collectionId,
        lemma: cards.lemma,
        rarity: cards.rarity,
        retiredAt: cards.retiredAt,
      })
      .from(cards)
      .innerJoin(collections, eq(collections.id, cards.collectionId))
      .where(lte(collections.publishedAt, new Date(now)))
      .orderBy(cards.id);
    const drawable = rows.filter((row) => row.retiredAt === null);
    const themes = await db
      .select({ cardId: cardThemes.cardId, themeId: cardThemes.themeId })
      .from(cardThemes);
    const themesOf = new Map<string, string[]>();
    for (const { cardId, themeId } of themes) {
      themesOf.set(cardId, [...(themesOf.get(cardId) ?? []), themeId]);
    }

    const byCollection = new Map<string, string[]>();
    for (const row of drawable) {
      const ids = byCollection.get(row.collectionId) ?? [];
      ids.push(row.id);
      byCollection.set(row.collectionId, ids);
    }
    const drawableIds = new Set(drawable.map((row) => row.id));
    const byTheme = new Map<string, string[]>();
    for (const { cardId, themeId } of themes) {
      if (!drawableIds.has(cardId)) continue;
      const ids = byTheme.get(themeId) ?? [];
      ids.push(cardId);
      byTheme.set(themeId, ids);
    }
    const index: CatalogIndex = {
      collectionOf: new Map(drawable.map((row) => [row.id, row.collectionId])),
      byCollection,
      all: drawable.map((row) => row.id),
      wordOf: new Map(rows.map((row) => [row.id, row.lemma])),
      themesOf,
      byTheme,
      words: new Set(rows.map((row) => normalizeWord(row.lemma))),
      choiceCards: drawable.map((row) => ({
        id: row.id,
        collectionId: row.collectionId,
        rarity: row.rarity,
      })),
    };
    cached = { index, expiresAt: now + ttlMs };
    return index;
  };
}

export type CatalogIndexLoader = ReturnType<typeof createCatalogIndexLoader>;
