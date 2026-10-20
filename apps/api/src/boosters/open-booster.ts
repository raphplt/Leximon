import type { BoosterSource } from "@leximon/contract";
import {
  type BoosterWallet,
  boosterXp,
  computeRefill,
  createFullWallet,
  createSeededRandom,
  DRAW_SCHEDULE,
  type DrawnCard,
  drawBooster,
  drawRulesAt,
  type EpochMs,
  GUEST_SCHEDULE,
  gameDayOf,
  guestBoostersLeft,
  guestRulesAt,
  type ProgressGain,
  progressGain,
  REFILL_SCHEDULE,
  takeBooster,
  XP_SCHEDULE,
  xpRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, inArray, sql } from "drizzle-orm";
import { addXp } from "../progress/progress";
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
      readonly progress: ProgressGain;
    }
  | { readonly kind: "stock_empty"; readonly nextRefillAt: EpochMs }
  | { readonly kind: "collection_not_found" }
  /** The session is a guest archived by a sign-in: the client must use the account's. */
  | { readonly kind: "guest_archived" }
  /** A guest that opened all the boosters it may before creating an account (P37). */
  | { readonly kind: "signup_required" }
  | { readonly kind: "catalog_empty" };

const {
  boosterWallets,
  boosterOpens,
  boosterOpenRequests,
  guestLinks,
  userCards,
  userProgress,
  users,
} = schema;

/**
 * Opens a booster for a player.
 *
 * Runs in one transaction that locks the player's wallet row, so concurrent requests from the
 * same player are applied one after the other. A request repeating an idempotency key returns
 * the booster already opened with that key instead of opening another.
 *
 * The free stock is spent first; once it is empty, a booster comes from the bonus reserve.
 * The open earns XP (P48), more for words the player never owned and for the first open of the day.
 * Lock order: the wallet first, then the copies (as answering a challenge: wallet, then mastery).
 *
 * Latency: each statement is a database round trip, so the open uses as few as possible:
 * BEGIN, lock (and create) the wallet, look up the idempotency key (with whether the guest was
 * archived by a sign-in, how many boosters a guest opened, and which drawn words the player
 * already owns), one combined write, COMMIT.
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

  const guestRules = guestRulesAt(GUEST_SCHEDULE, now);

  return db.transaction(async (tx) => {
    const fresh = createFullWallet(REFILL_SCHEDULE, now);

    // Creates the wallet of a new player, or locks the existing one: on conflict, the no-op update
    // takes the same row lock as SELECT … FOR UPDATE and returns the latest committed row.
    const lockedRows = await tx
      .insert(boosterWallets)
      .values({ userId, ...toRow(fresh), pityCounters: {} })
      .onConflictDoUpdate({ target: boosterWallets.userId, set: { userId: sql`excluded.user_id` } })
      .returning();

    const locked = lockedRows[0];
    if (locked === undefined) {
      throw new Error(`Wallet missing for user ${userId} right after its creation`);
    }
    const wallet = fromRow(locked);

    // Drawn before the lookup, which then tells which drawn words are new to the player. Wasted on
    // a replayed key or an empty stock, which is cheap: no I/O.
    const draw = drawBooster(
      drawRulesAt(DRAW_SCHEDULE, now),
      pool,
      locked.pityCounters,
      createSeededRandom(input.seed),
    );
    const drawnIds = [...new Set(draw.cards.map((card) => card.cardId))];

    // Runs after the lock is granted, as a separate statement: it sees an open committed by a
    // concurrent request with the same key that held the lock first, a sign-in that archived
    // this guest meanwhile (D-030), and the opens of a guest counted against its limit (P37). A trade does not take the wallet lock: a word received by
    // trade in the meantime would count as new once more, a harmless few XP.
    const lookup = await tx.execute<{
      archived: boolean;
      previous_id: string | null;
      previous_cards: DrawnCard[] | null;
      owned: string[];
      xp: number;
      guest_opens: number | null;
    }>(sql`
      select
        exists (select 1 from ${guestLinks} where ${guestLinks.guestId} = ${userId}) as archived,
        ${guestOpensSql(userId, guestRules.boostersBeforeSignup)} as guest_opens,
        previous.id as previous_id, previous.cards as previous_cards,
        array(select distinct ${userCards.cardId} from ${userCards}
          where ${userCards.userId} = ${userId} and ${inArray(userCards.cardId, drawnIds)}) as owned,
        coalesce((select ${userProgress.xp} from ${userProgress}
          where ${userProgress.userId} = ${userId}), 0) as xp
      from (select 1) as one
      left join lateral (
        select ${boosterOpens.id} as id, ${boosterOpens.cards} as cards
        from ${boosterOpenRequests}
        join ${boosterOpens} on ${boosterOpens.id} = ${boosterOpenRequests.openId}
          and ${boosterOpens.openedAt} = ${boosterOpenRequests.openedAt}
        where ${boosterOpenRequests.userId} = ${userId}
          and ${boosterOpenRequests.idempotencyKey} = ${idempotencyKey}
      ) as previous on true
    `);
    const state = lookup.rows[0];
    if (state === undefined) {
      throw new Error("Open lookup returned no row");
    }

    if (state.previous_id !== null && state.previous_cards !== null) {
      const current = computeRefill(wallet, REFILL_SCHEDULE, now);
      return {
        kind: "opened",
        openId: state.previous_id,
        cards: state.previous_cards,
        wallet: {
          stored: current.stored,
          nextRefillAt: current.nextRefillAt,
          bonus: locked.bonusBoosters,
        },
        // The XP was counted by the first request; a retry shows the total without a new gain.
        progress: progressGain(state.xp, 0),
      };
    }

    // A guest whose game went to an account: its old session must not draw anything more. Rolls
    // back the wallet if this request just created it.
    if (state.archived) {
      return { kind: "guest_archived" };
    }

    if (state.guest_opens !== null && guestBoostersLeft(guestRules, state.guest_opens) === 0) {
      return { kind: "signup_required" };
    }

    const consumed = takeBooster(wallet, locked.bonusBoosters, REFILL_SCHEDULE, now);
    if (!consumed.ok) {
      return { kind: "stock_empty", nextRefillAt: consumed.nextRefillAt };
    }

    const day = gameDayOf(now).key;
    const owned = new Set(state.owned);
    const rarities = new Map(draw.cards.map((card) => [card.cardId, card.rarity]));
    const xpGained = boosterXp(xpRulesAt(XP_SCHEDULE, now), {
      newWords: drawnIds.filter((id) => !owned.has(id)).flatMap((id) => rarities.get(id) ?? []),
      firstOfDay: locked.lastOpenedDay !== day,
    });
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
          lastOpenedDay: day,
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
    const requestInsert = tx
      .$with("request_insert")
      .as(
        tx
          .insert(boosterOpenRequests)
          .values({ userId, idempotencyKey, openId, openedAt })
          .returning({ openId: boosterOpenRequests.openId }),
      );
    const progressUpsert = addXp(tx, "progress_upsert", userId, xpGained);
    // Every data-modifying CTE runs, read or not; the statement returns the new XP total.
    const [progress] = await tx
      .with(cardsUpsert, walletUpdate, openInsert, requestInsert, progressUpsert)
      .select({ xp: progressUpsert.xp })
      .from(progressUpsert);
    if (progress === undefined) {
      throw new Error(`XP missing for user ${userId} right after the open`);
    }

    return {
      kind: "opened",
      openId,
      cards: draw.cards,
      wallet: {
        stored: consumed.state.stored,
        nextRefillAt: consumed.state.nextRefillAt,
        bonus: consumed.reserve,
      },
      progress: progressGain(progress.xp, xpGained),
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

/**
 * How many boosters a guest opened, up to `cap` (enough to apply the limit, and the scan stays
 * short); null for a member, who has no limit.
 */
export function guestOpensSql(userId: string, cap: number) {
  return sql<
    number | null
  >`case when (select ${users.isAnonymous} from ${users} where ${users.id} = ${userId})
    then (select count(*)::int from (select 1 from ${boosterOpens}
      where ${boosterOpens.userId} = ${userId} limit ${cap}) as opened)
    end`;
}
