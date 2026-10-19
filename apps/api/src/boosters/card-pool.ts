import { byRarity, type CardPool, canonicalizePool, describePool, RARITIES } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { isNull } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;

export interface LoadedPool {
  /** Canonical pool: the same set of cards always gives the same draws for a given seed. */
  readonly pool: CardPool;
  /** SHA-256 (hex) of the canonical pool, stored with each open to verify replays. */
  readonly fingerprint: string;
}

/**
 * Loads the cards that boosters can contain.
 *
 * The result is cached in the Worker isolate for a minute. This is not player state: the
 * catalog changes rarely, is the same for everyone, and a stale minute is harmless.
 */
export function createCardPoolLoader(ttlMs = CACHE_TTL_MS) {
  let cached: { loaded: LoadedPool; expiresAt: number } | undefined;

  return async (db: Database, now: number): Promise<LoadedPool> => {
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.loaded;
    }
    const rows = await db
      .select({ id: schema.cards.id, rarity: schema.cards.rarity })
      .from(schema.cards)
      .where(isNull(schema.cards.retiredAt));

    const loaded = await fingerprintPool(
      byRarity((rarity) => rows.filter((row) => row.rarity === rarity).map((row) => row.id)),
    );
    cached = { loaded, expiresAt: now + ttlMs };
    return loaded;
  };
}

export type CardPoolLoader = ReturnType<typeof createCardPoolLoader>;

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
