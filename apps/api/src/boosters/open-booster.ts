import type { BoosterSource } from "@leximon/contract";
import {
  type BoosterWallet,
  computeRefill,
  createFullWallet,
  createSeededRandom,
  DRAW_SCHEDULE,
  type DrawnCard,
  drawBooster,
  drawRulesAt,
  type EpochMs,
  REFILL_SCHEDULE,
  takeBooster,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, sql } from "drizzle-orm";
import { type CardPoolLoader, isEmptyPool } from "./card-pool";

export interface OpenBoosterInput {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly source: BoosterSource;
  readonly now: EpochMs;
  /** Fresh cryptographic seed; unused when the request replays an earlier open. */
  readonly seed: string;
}

export interface WalletView {
  readonly stored: number;
  readonly nextRefillAt: EpochMs | null;
  /** Bonus boosters left in the reserve. */
  readonly bonus: number;
}

export type OpenBoosterResult =
  | {
      readonly kind: "opened";
      readonly openId: string;
      readonly cards: readonly DrawnCard[];
      readonly wallet: WalletView;
    }
  | { readonly kind: "stock_empty"; readonly nextRefillAt: EpochMs }
  | { readonly kind: "collection_not_found" }
  | { readonly kind: "catalog_empty" };

const { boosterWallets, boosterOpens, boosterOpenRequests, userCards } = schema;

/**
 * Opens a booster for a player.
 *
 * Runs in one transaction that locks the player's wallet row, so concurrent requests from the
 * same player are applied one after the other. A request repeating an idempotency key returns
 * the booster already opened with that key instead of opening another.
 *
 * The free stock is spent first; once it is empty, a booster comes from the bonus reserve.
 * Lock order: the wallet first, then the copies (as answering a challenge: wallet, then mastery).
 *
 * Latency: each statement is a database round trip, so the open uses as few as possible:
 * BEGIN, lock (and create) the wallet, look up the idempotency key, one combined write, COMMIT.
 */
export async function openBooster(
  db: Database,
  loadCardPool: CardPoolLoader,
  input: OpenBoosterInput,
): Promise<OpenBoosterResult> {
  const { userId, idempotencyKey, source, now } = input;

  // Read outside the transaction: the catalog is shared and must not lengthen the lock.
  const loaded = await loadCardPool(db, source, now);
  if (loaded === null) {
    return { kind: "collection_not_found" };
  }
  const { pool, fingerprint } = loaded;
  if (isEmptyPool(pool)) {
    return { kind: "catalog_empty" };
  }

  return db.transaction(async (tx) => {
    const fresh = createFullWallet(REFILL_SCHEDULE, now);

    // Creates the wallet of a new player, or locks the existing one: on conflict, the no-op update
    // takes the same row lock as SELECT … FOR UPDATE and returns the latest committed row.
    const lockedRows = await tx
      .insert(boosterWallets)
      .values({ userId, ...toRow(fresh), pityCounters: {} })
      .onConflictDoUpdate({ target: boosterWallets.userId, set: { userId: sql`excluded.user_id` } })
      .returning();

    // Runs after the lock is granted, as a separate statement: it sees an open committed by a
    // concurrent request with the same key that held the lock first.
    const previousRows = await tx
      .select({ id: boosterOpens.id, cards: boosterOpens.cards })
      .from(boosterOpenRequests)
      .innerJoin(
        boosterOpens,
        and(
          eq(boosterOpens.id, boosterOpenRequests.openId),
          eq(boosterOpens.openedAt, boosterOpenRequests.openedAt),
        ),
      )
      .where(
        and(
          eq(boosterOpenRequests.userId, userId),
          eq(boosterOpenRequests.idempotencyKey, idempotencyKey),
        ),
      );

    const locked = lockedRows[0];
    if (locked === undefined) {
      throw new Error(`Wallet missing for user ${userId} right after its creation`);
    }
    const wallet = fromRow(locked);

    const previous = previousRows[0];
    if (previous !== undefined) {
      const current = computeRefill(wallet, REFILL_SCHEDULE, now);
      return {
        kind: "opened",
        openId: previous.id,
        cards: previous.cards,
        wallet: {
          stored: current.stored,
          nextRefillAt: current.nextRefillAt,
          bonus: locked.bonusBoosters,
        },
      };
    }

    const consumed = takeBooster(wallet, locked.bonusBoosters, REFILL_SCHEDULE, now);
    if (!consumed.ok) {
      return { kind: "stock_empty", nextRefillAt: consumed.nextRefillAt };
    }

    const draw = drawBooster(
      drawRulesAt(DRAW_SCHEDULE, now),
      pool,
      locked.pityCounters,
      createSeededRandom(input.seed),
    );
    const openId = crypto.randomUUID();
    const openedAt = new Date(now);

    // All writes in one statement (data-modifying CTEs). Foreign keys are checked at the end of
    // the statement, so the request row may reference the open inserted alongside it.
    const cardsUpsert = tx.$with("cards_upsert").as(
      tx
        .insert(userCards)
        .values(
          countCopies(draw.cards).map(([cardId, quantity]) => ({
            userId,
            cardId,
            quantity,
            firstObtainedAt: openedAt,
            lastObtainedAt: openedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [userCards.userId, userCards.cardId, userCards.variant],
          set: {
            quantity: sql`${userCards.quantity} + excluded.quantity`,
            lastObtainedAt: sql`excluded.last_obtained_at`,
          },
        })
        .returning({ cardId: userCards.cardId }),
    );
    const walletUpdate = tx.$with("wallet_update").as(
      tx
        .update(boosterWallets)
        .set({
          ...toRow(consumed.state),
          pityCounters: draw.pityCounters,
          bonusBoosters: consumed.reserve,
        })
        .where(eq(boosterWallets.userId, userId))
        .returning({ userId: boosterWallets.userId }),
    );
    const openInsert = tx.$with("open_insert").as(
      tx
        .insert(boosterOpens)
        .values({
          id: openId,
          userId,
          collectionId: source.kind === "collection" ? source.collectionId : null,
          seed: input.seed,
          poolFingerprint: fingerprint,
          pityCountersBefore: locked.pityCounters,
          cards: draw.cards,
          fromBonus: consumed.fromBonus,
          openedAt,
        })
        .returning({ id: boosterOpens.id }),
    );
    await tx
      .with(cardsUpsert, walletUpdate, openInsert)
      .insert(boosterOpenRequests)
      .values({ userId, idempotencyKey, openId, openedAt });

    return {
      kind: "opened",
      openId,
      cards: draw.cards,
      wallet: {
        stored: consumed.state.stored,
        nextRefillAt: consumed.state.nextRefillAt,
        bonus: consumed.reserve,
      },
    };
  });
}

/** Groups drawn cards into quantities per card, in a stable order (consistent row locking). */
function countCopies(cards: readonly DrawnCard[]): [cardId: string, quantity: number][] {
  const counts = new Map<string, number>();
  for (const { cardId } of cards) {
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function toRow(wallet: BoosterWallet) {
  return { stored: wallet.stored, progressMs: wallet.progressMs, asOf: new Date(wallet.asOf) };
}

function fromRow(row: typeof boosterWallets.$inferSelect): BoosterWallet {
  return { stored: row.stored, progressMs: row.progressMs, asOf: row.asOf.getTime() };
}
