import type { Rarity } from "@leximon/core";
import { inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { cards, collections } from "../schema/index";
import type { Release } from "./release";

export interface PublishedCard {
  readonly id: string;
  readonly rarity: Rarity;
  readonly retiredAt: Date | null;
}

/** What publishing a release changes in the game database. */
export interface CatalogPlan {
  readonly collections: readonly { readonly id: string; readonly name: string }[];
  readonly cards: readonly {
    readonly id: string;
    readonly lemma: string;
    readonly rarity: Rarity;
    readonly collectionId: string;
  }[];
  /** Published cards missing from the release: they leave the boosters, owned copies stay. */
  readonly retire: readonly string[];
  /** A published card's rarity never changes (D-020): any of these blocks the publication. */
  readonly rarityConflicts: readonly {
    readonly id: string;
    readonly published: Rarity;
    readonly release: Rarity;
  }[];
}

/** Pure: compares a release with the cards already in the database. */
export function planCatalog(release: Release, published: readonly PublishedCard[]): CatalogPlan {
  const releaseCards = release.collections.flatMap((collection) => collection.cards);
  const inRelease = new Set(releaseCards.map((card) => card.id));
  const publishedById = new Map(published.map((card) => [card.id, card]));
  return {
    collections: release.collections.map(({ id, name }) => ({ id, name })),
    cards: releaseCards.map((card) => ({
      id: card.id,
      lemma: card.word,
      rarity: card.rarity,
      collectionId: card.collectionId,
    })),
    retire: published
      .filter((card) => card.retiredAt === null && !inRelease.has(card.id))
      .map((card) => card.id),
    rarityConflicts: releaseCards.flatMap((card) => {
      const before = publishedById.get(card.id);
      return before !== undefined && before.rarity !== card.rarity
        ? [{ id: card.id, published: before.rarity, release: card.rarity }]
        : [];
    }),
  };
}

export async function loadPublishedCards(db: Database): Promise<PublishedCard[]> {
  return db.select({ id: cards.id, rarity: cards.rarity, retiredAt: cards.retiredAt }).from(cards);
}

/** Bounds the size of one statement; a launch catalogue holds a few thousand cards. */
const BATCH_SIZE = 500;

function batches<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    result.push(items.slice(start, start + BATCH_SIZE));
  }
  return result;
}

/**
 * Applies a plan in one transaction. A collection is published the first time it appears; a card
 * back in a release leaves retirement. Refuses a plan with rarity conflicts.
 */
export async function applyCatalog(db: Database, plan: CatalogPlan, now: Date): Promise<void> {
  if (plan.rarityConflicts.length > 0) {
    throw new Error("The plan changes the rarity of published cards");
  }
  await db.transaction(async (tx) => {
    if (plan.collections.length > 0) {
      await tx
        .insert(collections)
        .values(plan.collections.map((collection) => ({ ...collection, publishedAt: now })))
        .onConflictDoUpdate({
          target: collections.id,
          set: {
            name: sql`excluded.name`,
            publishedAt: sql`coalesce(${collections.publishedAt}, excluded.published_at)`,
          },
        });
    }
    for (const batch of batches(plan.cards)) {
      await tx
        .insert(cards)
        .values(batch)
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            lemma: sql`excluded.lemma`,
            collectionId: sql`excluded.collection_id`,
            retiredAt: null,
          },
        });
    }
    for (const batch of batches(plan.retire)) {
      await tx.update(cards).set({ retiredAt: now }).where(inArray(cards.id, batch));
    }
  });
}
