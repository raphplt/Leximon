import type { BoosterSource } from "@leximon/contract";
import { byRarity, type CardPool, canonicalizePool, describePool, RARITIES } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, isNull, lte } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;
/** Bounds memory: unknown collection ids sent by clients must not grow the cache forever. */
const CACHE_MAX_ENTRIES = 256;

export interface LoadedPool {
  /** Canonical pool: the same set of cards always gives the same draws for a given seed. */
  readonly pool: CardPool;
  /** SHA-256 (hex) of the canonical pool, stored with each open to verify replays. */
  readonly fingerprint: string;
}

/**
 * Loads the cards a collection's booster can contain. Returns `null` when the collection does not
 * exist or is not published.
 *
 * Results are cached in the Worker isolate for a minute. This is not player state: the catalog
 * changes rarely, is the same for everyone, and a stale minute is harmless.
 */
export function createCardPoolLoader(ttlMs = CACHE_TTL_MS) {
  const cache = new Map<string, { loaded: LoadedPool | null; expiresAt: number }>();

  return async (db: Database, source: BoosterSource, now: number): Promise<LoadedPool | null> => {
    const key = source.collectionId;
    const hit = cache.get(key);
    if (hit !== undefined && hit.expiresAt > now) {
      return hit.loaded;
    }

    const loaded = await loadPool(db, source, new Date(now));
    cache.delete(key);
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { loaded, expiresAt: now + ttlMs });
    return loaded;
  };
}

export type CardPoolLoader = ReturnType<typeof createCardPoolLoader>;

async function loadPool(
  db: Database,
  source: BoosterSource,
  now: Date,
): Promise<LoadedPool | null> {
  const { cards, collections } = schema;
  const published = lte(collections.publishedAt, now);

  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, source.collectionId), published));
  if (collection === undefined) {
    return null;
  }

  const rows = await db
    .select({ id: cards.id, rarity: cards.rarity })
    .from(cards)
    .innerJoin(collections, eq(collections.id, cards.collectionId))
    .where(and(isNull(cards.retiredAt), published, eq(cards.collectionId, source.collectionId)));

  return fingerprintPool(
    byRarity((rarity) => rows.filter((row) => row.rarity === rarity).map((row) => row.id)),
  );
}

export async function fingerprintPool(pool: CardPool): Promise<LoadedPool> {
  const canonical = canonicalizePool(pool);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(describePool(canonical)),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { pool: canonical, fingerprint };
}

export function isEmptyPool(pool: CardPool): boolean {
  return RARITIES.every((rarity) => pool[rarity].length === 0);
}
