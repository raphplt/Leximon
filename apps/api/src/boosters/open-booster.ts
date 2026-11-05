import type { BoosterSource } from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  type BoosterWallet,
  bonusRulesAt,
  boosterXp,
  canOpenCollection,
  computeRefill,
  createFullWallet,
  createSeededRandom,
  DRAW_SCHEDULE,
  type DrawnCard,
  type DrawRules,
  drawBooster,
  drawRulesAt,
  type EpochMs,
  GUEST_SCHEDULE,
  gameDayOf,
  guestBoostersLeft,
  guestRulesAt,
  isAtLeast,
  LEVEL_REWARD_SCHEDULE,
  type LevelRewardRules,
  levelOf,
  levelRewardRulesAt,
  type ProgressGain,
  progressGain,
  REFILL_SCHEDULE,
  reserveCapacity,
  restrictionsAt,
  takeBooster,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
  XP_SCHEDULE,
  xpRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, inArray, sql } from "drizzle-orm";
import { addXp } from "../progress/progress";
import {
  completionsJson,
  completionXpOf,
  type RarityCompletion,
  rarityCompletions,
} from "../progress/rarity-completions";
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
  /** Of `bonus`, the garni boosters. */
  readonly garni: number;
  /** Most bonus boosters the reserve holds. */
  readonly bonusCap: number;
  readonly ecus: number;
}

export type OpenBoosterResult =
  | {
      readonly kind: "opened";
      readonly openId: string;
      readonly cards: readonly DrawnCard[];
      readonly wallet: WalletView;
      readonly progress: ProgressGain;
      /** Rarities of a collection this booster completed: none when a retry replays it. */
      readonly completions: readonly RarityCompletion[];
    }
  | { readonly kind: "stock_empty"; readonly nextRefillAt: EpochMs }
  /** A suspended or closed account: the game's writes are refused. */
  | { readonly kind: "account_locked" }
  | { readonly kind: "collection_not_found" }
  /** Choosing the collection of a booster opens at a level: the starter collection does not. */
  | { readonly kind: "level_required"; readonly level: number }
  /** The session is a guest archived by a sign-in: the client must use the account's. */
  | { readonly kind: "guest_archived" }
  /** A guest that opened all the boosters it may before creating an account. */
  | { readonly kind: "signup_required" }
  | { readonly kind: "catalog_empty" };

const {
  boosterWallets,
  boosterOpens,
  boosterOpenRequests,
  guestLinks,
  sanctions,
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
 * The free stock is spent first; once it is empty, a booster comes from the bonus reserve, garni
 * boosters first. A collection's booster needs its level; the starter collection's never.
 * The open earns XP, more for words the player never owned, for the first open of the day and for
 * a rarity of the collection the new words complete.
 * Lock order: the wallet first, then the copies (as answering a challenge: wallet, then mastery).
 *
 * Latency: each statement is a database round trip, so the open uses as few as possible:
 * BEGIN, lock (and create) the wallet, look up the idempotency key (with the standing sanctions,
 * whether the guest was archived by a sign-in, how many boosters a guest opened, and which drawn
 * words the player already owns), one combined write, COMMIT. Nothing is read before BEGIN but
 * the card pool, cached.
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
  const bonusRules = bonusRulesAt(BONUS_SCHEDULE, now);
  const drawRules = drawRulesAt(DRAW_SCHEDULE, now);
  const unlockRules = unlockRulesAt(UNLOCK_SCHEDULE, now);

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
    const bonusCap = reserveCapacity(bonusRules, locked.reserveSlots);
    const reserve = {
      bonus: locked.bonusBoosters,
      garni: locked.garniBoosters,
      precious: locked.preciousBoosters,
    };

    // Which booster would be spent decides the draw: a garni booster guarantees its rarity.
    // Pure, so computed before the checks below; applied only if they pass.
    const consumed = takeBooster(wallet, reserve, REFILL_SCHEDULE, now);
    const garni = consumed.ok && consumed.garni;
    const precious = consumed.ok && consumed.precious;

    // Drawn before the lookup, which then tells which drawn words are new to the player. Wasted on
    // a replayed key or an empty stock, which is cheap: no I/O.
    const draw = drawBooster(
      garni
        ? garniRules(drawRules, levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now), precious)
        : drawRules,
      pool,
      locked.pityCounters,
      createSeededRandom(input.seed),
    );
    const drawnIds = [...new Set(draw.cards.map((card) => card.cardId))];

    // Runs after the lock is granted, as a separate statement: it sees an open committed by a
    // concurrent request with the same key that held the lock first, a sign-in that archived
    // this guest meanwhile, and the opens of a guest counted against its limit. A trade does not take the wallet lock: a word received by
    // trade in the meantime would count as new once more, a harmless few XP.
    const lookup = await tx.execute<{
      sanctions: { kind: "suspend" | "close"; until: string | null }[];
      archived: boolean;
      previous_id: string | null;
      previous_cards: DrawnCard[] | null;
      owned: string[];
      xp: number;
      guest_opens: number | null;
    }>(sql`
      select
        coalesce((select json_agg(json_build_object('kind', ${sanctions.kind},
            'until', ${sanctions.until}))
          from ${sanctions} where ${sanctions.userId} = ${userId}
            and ${sanctions.revokedAt} is null
            and (${sanctions.kind} = 'close' or ${sanctions.until} > ${new Date(now)})),
          '[]'::json) as sanctions,
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

    // Checked here rather than before the transaction: one round trip less on every open.
    const standing = state.sanctions.map((row) => ({
      kind: row.kind,
      until: row.until === null ? null : Date.parse(row.until),
      revokedAt: null,
    }));
    if (restrictionsAt(standing, now).locked) {
      return { kind: "account_locked" };
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
          garni: locked.garniBoosters,
          bonusCap,
          ecus: locked.ecus,
        },
        // The XP was counted by the first request; a retry shows the total without a new gain.
        progress: progressGain(state.xp, 0),
        completions: [],
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

    if (!canOpenCollection(unlockRules, source.collectionId, levelOf(state.xp).level)) {
      return { kind: "level_required", level: unlockRules.levels.choose_collection };
    }

    if (!consumed.ok) {
      return { kind: "stock_empty", nextRefillAt: consumed.nextRefillAt };
    }

    const day = gameDayOf(now).key;
    const owned = new Set(state.owned);
    const rarities = new Map(draw.cards.map((card) => [card.cardId, card.rarity]));
    const newIds = drawnIds.filter((id) => !owned.has(id));
    const xpRules = xpRulesAt(XP_SCHEDULE, now);
    const xpGained = boosterXp(xpRules, {
      newWords: newIds.flatMap((id) => rarities.get(id) ?? []),
      firstOfDay: locked.lastOpenedDay !== day,
    });
    const openId = crypto.randomUUID();
    const openedAt = new Date(now);
    // Only a new word can complete a rarity: a booster of duplicates skips the check.
    const completions =
      newIds.length === 0
        ? null
        : rarityCompletions(
            tx,
            xpRules,
            newIds.map((cardId) => ({ userId, cardId })),
            openedAt,
          );

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
          bonusBoosters: consumed.reserve.bonus,
          garniBoosters: consumed.reserve.garni,
          preciousBoosters: consumed.reserve.precious,
          lastOpenedDay: day,
          ...(locked.lastOpenedDay === day
            ? {}
            : { daysPlayed: sql`${boosterWallets.daysPlayed} + 1` }),
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
          collectionId: source.collectionId,
          seed: input.seed,
          poolFingerprint: fingerprint,
          pityCountersBefore: locked.pityCounters,
          cards: draw.cards,
          fromBonus: consumed.fromBonus,
          garni,
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
    const progressUpsert = addXp(
      tx,
      "progress_upsert",
      userId,
      completions === null ? xpGained : sql<number>`${xpGained}::int + ${completionXpOf(userId)}`,
    );
    // Every data-modifying CTE runs, read or not; the statement returns the new XP total.
    const writes = [cardsUpsert, walletUpdate, openInsert, requestInsert] as const;
    const [progress] = await (completions === null
      ? tx.with(...writes, progressUpsert)
      : tx.with(...writes, completions, progressUpsert)
    )
      .select({
        xp: progressUpsert.xp,
        completions: completions === null ? sql<RarityCompletion[]>`'[]'::json` : completionsJson,
      })
      .from(progressUpsert);
    if (progress === undefined) {
      throw new Error(`XP missing for user ${userId} right after the open`);
    }
    const completionXp = progress.completions.reduce((sum, completion) => sum + completion.xp, 0);

    return {
      kind: "opened",
      openId,
      cards: draw.cards,
      wallet: {
        stored: consumed.state.stored,
        nextRefillAt: consumed.state.nextRefillAt,
        bonus: consumed.reserve.bonus,
        garni: consumed.reserve.garni,
        bonusCap,
        ecus: locked.ecus,
      },
      progress: progressGain(progress.xp, xpGained + completionXp),
      completions: progress.completions,
    };
  });
}

/** The draw of a garni booster: its guaranteed card is at least the garni, or precious, rarity. */
function garniRules(rules: DrawRules, rewards: LevelRewardRules, precious: boolean): DrawRules {
  const minimum = precious ? rewards.preciousGarniMinRarity : rewards.garniMinRarity;
  return isAtLeast(rules.guaranteedMinRarity, minimum)
    ? rules
    : { ...rules, guaranteedMinRarity: minimum };
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
