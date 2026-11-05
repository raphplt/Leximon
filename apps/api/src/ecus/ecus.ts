import type {
  BoosterWalletResponse,
  MissingWordRefusal,
  RarityCompletionResponse,
  RecycleRefusal,
} from "@leximon/contract";
import {
  canOpenCollection,
  createSeededRandom,
  drawMissingWord,
  ECU_SCHEDULE,
  type EpochMs,
  ecuRulesAt,
  levelOf,
  type ProgressGain,
  progressGain,
  type Rarity,
  type RecycledCard,
  type RecyclePlan,
  recycleOne,
  recyclePlan,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
  XP_SCHEDULE,
  xpRulesAt,
} from "@leximon/core";
import { type Database, type EcuMovementDetails, schema } from "@leximon/db";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { lockWallet, walletView } from "../levels/rewards";
import { addXp } from "../progress/progress";
import {
  completionsJson,
  completionXpOf,
  type RarityCompletion,
  rarityCompletions,
} from "../progress/rarity-completions";

const { boosterWallets, cards, collections, ecuMovements, guestLinks, userCards, userProgress } =
  schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type RecycleResult =
  | {
      readonly kind: "recycled";
      readonly plan: RecyclePlan;
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly kind: "refused"; readonly reason: RecycleRefusal }
  /** A guest whose game went to an account: its old session changes nothing more. */
  | { readonly kind: "guest_archived" };

interface RecycleInput {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly now: EpochMs;
}

/**
 * Turns into écus the duplicates beyond the copies kept, for the rarities recycled together. The
 * rarest cards are never part of it: they are recycled one by one, by `recycleCopy`.
 *
 * One transaction, lock order as a booster's open: the wallet first, then the player's copies, by
 * card id. A trade being accepted locks the same copies without the wallet: the one that comes
 * second sees the quantities the first one left. A request repeating an idempotency key returns
 * what the first one recycled.
 */
export function recycleDuplicates(db: Database, input: RecycleInput): Promise<RecycleResult> {
  const rules = ecuRulesAt(ECU_SCHEDULE, input.now);
  return recycleWith(db, input, (tx) =>
    lockCopies(tx, input.userId, [
      inArray(cards.rarity, [...rules.recycledTogether]),
      gt(userCards.quantity, rules.copiesKept),
    ]).then((holdings) => recyclePlan(rules, holdings)),
  );
}

/** Turns one copy of a card into écus, whatever its rarity; never the player's last copy. */
export function recycleCopy(
  db: Database,
  input: RecycleInput & { readonly cardId: string },
): Promise<RecycleResult> {
  const rules = ecuRulesAt(ECU_SCHEDULE, input.now);
  return recycleWith(db, input, async (tx) => {
    const [holding] = await lockCopies(tx, input.userId, [eq(userCards.cardId, input.cardId)]);
    const card = holding === undefined ? null : recycleOne(rules, holding);
    return card === null ? null : planOf([card]);
  });
}

async function recycleWith(
  db: Database,
  input: RecycleInput,
  plan: (tx: Transaction) => Promise<RecyclePlan | null>,
): Promise<RecycleResult> {
  const { userId, idempotencyKey, now } = input;
  return db.transaction(async (tx): Promise<RecycleResult> => {
    const locked = await lockWallet(tx, userId, now);
    const state = await lookUp(tx, userId, idempotencyKey);
    if (state.archived) return { kind: "guest_archived" };
    if (state.previous?.kind === "recycle") {
      return {
        kind: "recycled",
        plan: planOf(state.previous.cards),
        wallet: walletView(locked, now),
      };
    }

    const recycled = await plan(tx);
    if (recycled === null) return { kind: "refused", reason: "no_duplicate" };
    if (recycled.copies === 0) {
      return { kind: "recycled", plan: recycled, wallet: walletView(locked, now) };
    }

    const copies = Object.fromEntries(recycled.cards.map((card) => [card.cardId, card.copies]));
    const copiesUpdate = tx.$with("copies_update").as(
      tx
        .update(userCards)
        .set({
          quantity: sql`${userCards.quantity} - (${JSON.stringify(copies)}::jsonb ->> ${userCards.cardId})::int`,
        })
        .where(
          and(
            eq(userCards.userId, userId),
            eq(userCards.variant, "standard"),
            inArray(
              userCards.cardId,
              recycled.cards.map((card) => card.cardId),
            ),
          ),
        )
        .returning({ cardId: userCards.cardId }),
    );
    const movementInsert = insertMovement(tx, input, recycled.ecus, {
      kind: "recycle",
      cards: recycled.cards,
    });
    await tx
      .with(copiesUpdate, movementInsert)
      .update(boosterWallets)
      .set({ ecus: sql`${boosterWallets.ecus} + ${recycled.ecus}` })
      .where(eq(boosterWallets.userId, userId));
    return {
      kind: "recycled",
      plan: recycled,
      wallet: walletView({ ...locked, ecus: locked.ecus + recycled.ecus }, now),
    };
  });
}

export type MissingWordResult =
  | {
      readonly kind: "bought";
      readonly cardId: string;
      readonly price: number;
      readonly wallet: BoosterWalletResponse;
      readonly progress: ProgressGain;
      readonly completions: readonly RarityCompletionResponse[];
    }
  | { readonly kind: "refused"; readonly reason: MissingWordRefusal }
  | { readonly kind: "guest_archived" };

export interface MissingWordInput {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly collectionId: string;
  readonly rarity: Rarity;
  readonly now: EpochMs;
  /** Fresh cryptographic seed for the draw. */
  readonly seed: string;
}

/**
 * Spends écus on a word the player lacks, drawn among the drawable cards of the collection and
 * rarity they chose that they hold no copy of. A word never owned before earns its new-word XP and
 * may complete its rarity, as from a booster.
 *
 * One transaction that locks the wallet first, so that two purchases never spend the same écus
 * and a booster opened meanwhile is seen: BEGIN, lock the wallet, look up the key, the account and
 * the candidates, one combined write, COMMIT. A trade does not take the wallet lock: a word it
 * brings at the same instant may be drawn, and the player then holds two copies of it.
 */
export async function buyMissingWord(
  db: Database,
  input: MissingWordInput,
): Promise<MissingWordResult> {
  const { userId, collectionId, rarity, now } = input;
  const rules = ecuRulesAt(ECU_SCHEDULE, now);
  const unlockRules = unlockRulesAt(UNLOCK_SCHEDULE, now);
  const xpRules = xpRulesAt(XP_SCHEDULE, now);
  const price = rules.missingWordPrice[rarity];

  return db.transaction(async (tx): Promise<MissingWordResult> => {
    const locked = await lockWallet(tx, userId, now);
    const state = await lookUp(tx, userId, input.idempotencyKey);
    if (state.archived) return { kind: "guest_archived" };
    if (state.previous?.kind === "missing_word") {
      return {
        kind: "bought",
        cardId: state.previous.cardId,
        price: -state.previousAmount,
        wallet: walletView(locked, now),
        progress: progressGain(state.xp, 0),
        completions: [],
      };
    }

    const lookup = await tx.execute<{ published: boolean; missing: string[]; known: string[] }>(sql`
      select
        exists (select 1 from ${collections} where ${collections.id} = ${collectionId}
          and ${collections.publishedAt} <= ${new Date(now)}) as published,
        array(select ${cards.id} from ${cards}
          where ${cards.collectionId} = ${collectionId} and ${cards.rarity} = ${rarity}
            and ${cards.retiredAt} is null
            and not exists (select 1 from ${userCards} where ${userCards.userId} = ${userId}
              and ${userCards.cardId} = ${cards.id} and ${userCards.quantity} > 0)
          order by ${cards.id}) as missing,
        array(select ${userCards.cardId} from ${userCards} join ${cards} on ${cards.id} = ${userCards.cardId}
          where ${userCards.userId} = ${userId} and ${cards.collectionId} = ${collectionId}
            and ${cards.rarity} = ${rarity}) as known
    `);
    const choice = lookup.rows[0];
    if (choice === undefined) throw new Error("Missing word lookup returned no row");
    if (!choice.published) return { kind: "refused", reason: "collection_not_found" };
    if (!canOpenCollection(unlockRules, collectionId, levelOf(state.xp).level)) {
      return { kind: "refused", reason: "collection_locked" };
    }
    const cardId = drawMissingWord(choice.missing, createSeededRandom(input.seed));
    if (cardId === null) return { kind: "refused", reason: "nothing_missing" };
    if (locked.ecus < price) return { kind: "refused", reason: "not_enough_ecus" };

    // A word held once and traded away comes back without its XP: it was earned the first time.
    const isNew = !choice.known.includes(cardId);
    const wordXp = isNew ? xpRules.newWord[rarity] : 0;
    const obtainedAt = new Date(now);
    const completions = isNew
      ? rarityCompletions(tx, xpRules, [{ userId, cardId }], obtainedAt)
      : null;
    const cardUpsert = tx.$with("card_upsert").as(
      tx
        .insert(userCards)
        .values({
          userId,
          cardId,
          quantity: 1,
          firstObtainedAt: obtainedAt,
          lastObtainedAt: obtainedAt,
        })
        .onConflictDoUpdate({
          target: [userCards.userId, userCards.cardId, userCards.variant],
          set: {
            quantity: sql`${userCards.quantity} + 1`,
            lastObtainedAt: sql`excluded.last_obtained_at`,
          },
        })
        .returning({ cardId: userCards.cardId }),
    );
    const walletUpdate = tx.$with("wallet_update").as(
      tx
        .update(boosterWallets)
        .set({ ecus: sql`${boosterWallets.ecus} - ${price}` })
        .where(eq(boosterWallets.userId, userId))
        .returning({ userId: boosterWallets.userId }),
    );
    const movementInsert = insertMovement(tx, input, -price, { kind: "missing_word", cardId });
    const progressUpsert = addXp(
      tx,
      "progress_upsert",
      userId,
      completions === null ? wordXp : sql<number>`${wordXp}::int + ${completionXpOf(userId)}`,
    );
    const writes = [cardUpsert, walletUpdate, movementInsert] as const;
    const [progress] = await (completions === null
      ? tx.with(...writes, progressUpsert)
      : tx.with(...writes, completions, progressUpsert)
    )
      .select({
        xp: progressUpsert.xp,
        completions: completions === null ? sql<RarityCompletion[]>`'[]'::json` : completionsJson,
      })
      .from(progressUpsert);
    if (progress === undefined) throw new Error(`XP missing for user ${userId} after a purchase`);

    const completionXp = progress.completions.reduce((sum, completion) => sum + completion.xp, 0);
    return {
      kind: "bought",
      cardId,
      price,
      wallet: walletView({ ...locked, ecus: locked.ecus - price }, now),
      progress: progressGain(progress.xp, wordXp + completionXp),
      completions: progress.completions.map(({ collectionId, rarity, xp }) => ({
        collectionId,
        rarity,
        xp,
      })),
    };
  });
}

/** The player's copies matching `filters`, locked in card id order, with each card's rarity. */
function lockCopies(tx: Transaction, userId: string, filters: readonly ReturnType<typeof eq>[]) {
  return tx
    .select({ cardId: userCards.cardId, rarity: cards.rarity, quantity: userCards.quantity })
    .from(userCards)
    .innerJoin(cards, eq(cards.id, userCards.cardId))
    .where(and(eq(userCards.userId, userId), eq(userCards.variant, "standard"), ...filters))
    .orderBy(asc(userCards.cardId))
    .for("update", { of: userCards });
}

/**
 * After the wallet lock: sees a movement committed by a concurrent request with the same key, and
 * a sign-in that archived this guest meanwhile.
 */
async function lookUp(tx: Transaction, userId: string, idempotencyKey: string) {
  const [state] = await tx
    .select({
      archived: sql<boolean>`exists (select 1 from ${guestLinks}
        where ${guestLinks.guestId} = ${userId})`,
      previous: sql<EcuMovementDetails | null>`(select ${ecuMovements.details} from ${ecuMovements}
        where ${ecuMovements.userId} = ${userId}
          and ${ecuMovements.idempotencyKey} = ${idempotencyKey})`,
      previousAmount: sql<number>`coalesce((select ${ecuMovements.amount} from ${ecuMovements}
        where ${ecuMovements.userId} = ${userId}
          and ${ecuMovements.idempotencyKey} = ${idempotencyKey}), 0)`,
      xp: sql<number>`coalesce((select ${userProgress.xp} from ${userProgress}
        where ${userProgress.userId} = ${userId}), 0)`,
    })
    .from(sql`(select 1) as one`);
  if (state === undefined) throw new Error("Écus lookup returned no row");
  return state;
}

function insertMovement(
  tx: Transaction,
  input: { readonly userId: string; readonly idempotencyKey: string; readonly now: EpochMs },
  amount: number,
  details: EcuMovementDetails,
) {
  return tx.$with("movement_insert").as(
    tx
      .insert(ecuMovements)
      .values({
        id: crypto.randomUUID(),
        userId: input.userId,
        kind: details.kind,
        amount,
        idempotencyKey: input.idempotencyKey,
        details,
        createdAt: new Date(input.now),
      })
      .returning({ id: ecuMovements.id }),
  );
}

function planOf(cards: readonly RecycledCard[]): RecyclePlan {
  return {
    cards,
    copies: cards.reduce((sum, card) => sum + card.copies, 0),
    ecus: cards.reduce((sum, card) => sum + card.ecus, 0),
  };
}
