import type { BoosterSource } from "@leximon/contract";
import {
  createSeededRandom,
  DRAW_SCHEDULE,
  drawBooster,
  drawRulesAt,
  type EpochMs,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq } from "drizzle-orm";
import type { CardPoolLoader } from "./card-pool";
import { generateSeed } from "./seed";

/**
 * Header naming the cards a demonstration open should contain, comma-separated card ids. Read in
 * local development only, to film a given card coming out of a booster.
 */
export const DEMO_WANT_HEADER = "X-Demo-Want";

/** Enough tries to find any card of a collection in the last slot, in well under a second. */
const MAX_TRIES = 500_000;

/**
 * A seed whose draw ends with one of the wanted cards, or `null` if none was found: the last card
 * is the one the reveal builds up to. The draw stays the game's own: same rules, pool and
 * guarantee counters as the open that follows; only the seed is searched instead of random. The
 * counters are read without a lock: a race with another open of the same player only makes the
 * wanted card miss, which a demonstration tolerates.
 */
export async function findDemoSeed(
  db: Database,
  loadCardPool: CardPoolLoader,
  input: {
    readonly userId: string;
    readonly source: BoosterSource;
    readonly wanted: readonly string[];
    readonly now: EpochMs;
  },
): Promise<string | null> {
  const loaded = await loadCardPool(db, input.source, input.now);
  if (loaded === null) return null;
  const [wallet] = await db
    .select({ pityCounters: schema.boosterWallets.pityCounters })
    .from(schema.boosterWallets)
    .where(eq(schema.boosterWallets.userId, input.userId));
  const counters = wallet?.pityCounters ?? {};
  const rules = drawRulesAt(DRAW_SCHEDULE, input.now);
  const wanted = new Set(input.wanted);
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const seed = generateSeed();
    const draw = drawBooster(rules, loaded.pool, counters, createSeededRandom(seed));
    const last = draw.cards[draw.cards.length - 1];
    if (last !== undefined && wanted.has(last.cardId)) return seed;
  }
  return null;
}
