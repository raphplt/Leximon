import type { BoosterWalletResponse, LevelRewardView } from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  type BoosterWallet,
  bonusRulesAt,
  capacityAt,
  computeRefill,
  createFullWallet,
  type EpochMs,
  isChoosableRarity,
  LEVEL_REWARD_SCHEDULE,
  type LevelReward,
  levelOf,
  levelRewardRulesAt,
  levelRewards,
  RARITIES,
  REFILL_SCHEDULE,
  refillToFull,
  reserveCapacity,
  rewardBoosters,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, eq, sql } from "drizzle-orm";

const {
  boosterWallets,
  cards,
  collections,
  guestLinks,
  userCards,
  userLevelRewards,
  userProgress,
} = schema;

export type WalletRow = Pick<
  typeof boosterWallets.$inferSelect,
  "stored" | "progressMs" | "asOf" | "bonusBoosters" | "garniBoosters" | "reserveSlots"
>;

/** The wallet as clients see it. A player without a row yet has a full stock and no bonus. */
export function walletView(row: WalletRow | undefined, now: EpochMs): BoosterWalletResponse {
  const wallet: BoosterWallet =
    row === undefined
      ? createFullWallet(REFILL_SCHEDULE, now)
      : { stored: row.stored, progressMs: row.progressMs, asOf: row.asOf.getTime() };
  const state = computeRefill(wallet, REFILL_SCHEDULE, now);
  return {
    stored: state.stored,
    nextRefillAt: state.nextRefillAt === null ? null : new Date(state.nextRefillAt).toISOString(),
    bonus: row?.bonusBoosters ?? 0,
    garni: row?.garniBoosters ?? 0,
    bonusCap: reserveCapacity(bonusRulesAt(BONUS_SCHEDULE, now), row?.reserveSlots ?? 0),
    capacity: capacityAt(REFILL_SCHEDULE, now),
  };
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Locks the player's wallet, created full if missing: the first step of every transaction that
 * adds boosters to the reserve (lock order: the wallet first).
 */
export async function lockWallet(tx: Transaction, userId: string, now: EpochMs) {
  const fresh = createFullWallet(REFILL_SCHEDULE, now);
  const [locked] = await tx
    .insert(boosterWallets)
    .values({
      userId,
      stored: fresh.stored,
      progressMs: fresh.progressMs,
      asOf: new Date(fresh.asOf),
    })
    .onConflictDoUpdate({ target: boosterWallets.userId, set: { userId: sql`excluded.user_id` } })
    .returning();
  if (locked === undefined) {
    throw new Error(`Wallet missing for user ${userId} right after its creation`);
  }
  return locked;
}

export interface LevelRewardsState {
  readonly claimed: number[];
  readonly cardChoices: number[];
}

/** Levels a player claimed, and those whose card of the player's choice is still to take. */
export async function readLevelRewards(
  db: Pick<Database, "select">,
  userId: string,
): Promise<LevelRewardsState> {
  const rows = await db
    .select({
      level: userLevelRewards.level,
      rewards: userLevelRewards.rewards,
      chosenCardId: userLevelRewards.chosenCardId,
    })
    .from(userLevelRewards)
    .where(eq(userLevelRewards.userId, userId))
    .orderBy(asc(userLevelRewards.level));
  return {
    claimed: rows.map((row) => row.level),
    cardChoices: rows
      .filter((row) => row.chosenCardId === null && hasCardChoice(row.rewards))
      .map((row) => row.level),
  };
}

export type ClaimResult =
  | {
      readonly kind: "claimed";
      readonly level: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly kind: "refused"; readonly reason: ClaimRefusalReason };

export type ClaimRefusalReason =
  | "level_not_reached"
  | "reserve_full"
  | "stock_full"
  | "guest_archived";

/**
 * Claims the reward of a level (P58): the coffret. Idempotent by nature: the level is the key, a
 * second claim of the same level returns what the first one gave.
 *
 * A coffret that would waste something stays closed, to be claimed later: boosters that do not
 * fit in the reserve (`reserve_full`), a refill of a full stock (`stock_full`).
 *
 * One transaction that locks the player's wallet, as an open or an answer does (lock order: the
 * wallet first): BEGIN, lock (or create) the wallet, read the XP and the claim, one combined
 * write, COMMIT. Titles, avatars and pinned slots are recorded here and used by the profile.
 */
export async function claimLevelReward(
  db: Database,
  input: { readonly userId: string; readonly level: number; readonly now: EpochMs },
): Promise<ClaimResult> {
  const { userId, level, now } = input;
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  const bonusRules = bonusRulesAt(BONUS_SCHEDULE, now);

  return db.transaction(async (tx): Promise<ClaimResult> => {
    const locked = await lockWallet(tx, userId, now);

    // After the lock: sees a claim of the same level committed by a concurrent request.
    const [state] = await tx
      .select({
        xp: sql<number>`coalesce((select ${userProgress.xp} from ${userProgress}
          where ${userProgress.userId} = ${userId}), 0)`,
        archived: sql<boolean>`exists (select 1 from ${guestLinks}
          where ${guestLinks.guestId} = ${userId})`,
        previous: sql<LevelReward[] | null>`(select ${userLevelRewards.rewards}
          from ${userLevelRewards}
          where ${userLevelRewards.userId} = ${userId} and ${userLevelRewards.level} = ${level})`,
      })
      .from(sql`(select 1) as one`);
    if (state === undefined) throw new Error("Claim lookup returned no row");

    if (state.previous !== null) {
      return { kind: "claimed", level, rewards: state.previous, wallet: walletView(locked, now) };
    }
    if (state.archived) return { kind: "refused", reason: "guest_archived" };
    if (levelOf(state.xp).level < level) return { kind: "refused", reason: "level_not_reached" };

    const rewards = levelRewards(rules, level);
    const has = (kind: LevelReward["kind"]) => rewards.some((reward) => reward.kind === kind);

    let refill: BoosterWallet | null = null;
    if (has("refill")) {
      refill = refillToFull(
        { stored: locked.stored, progressMs: locked.progressMs, asOf: locked.asOf.getTime() },
        REFILL_SCHEDULE,
        now,
      );
      if (refill === null) return { kind: "refused", reason: "stock_full" };
    }
    const reserveSlots = locked.reserveSlots + (has("reserve_slot") ? 1 : 0);
    const boosters = rewardBoosters(rewards);
    const garni = rewards.filter((reward) => reward.kind === "garni_booster").length;
    if (
      boosters > 0 &&
      locked.bonusBoosters + boosters > reserveCapacity(bonusRules, reserveSlots)
    ) {
      return { kind: "refused", reason: "reserve_full" };
    }

    const after: WalletRow = {
      stored: refill?.stored ?? locked.stored,
      progressMs: refill?.progressMs ?? locked.progressMs,
      asOf: refill === null ? locked.asOf : new Date(refill.asOf),
      bonusBoosters: locked.bonusBoosters + boosters,
      garniBoosters: locked.garniBoosters + garni,
      reserveSlots,
    };
    const claimInsert = tx.$with("claim_insert").as(
      tx
        .insert(userLevelRewards)
        .values({ userId, level, rewards, claimedAt: new Date(now) })
        .returning({ level: userLevelRewards.level }),
    );
    await tx
      .with(claimInsert)
      .update(boosterWallets)
      .set(after)
      .where(eq(boosterWallets.userId, userId));
    return { kind: "claimed", level, rewards, wallet: walletView(after, now) };
  });
}

export type CardChoiceResult =
  | { readonly kind: "chosen"; readonly level: number; readonly cardId: string }
  | { readonly kind: "refused"; readonly reason: "no_card_choice" | "already_chosen" }
  | { readonly kind: "refused"; readonly reason: "card_not_choosable" };

/**
 * Takes the card of the player's choice won at a level (P58): a Courant or Peu courant card of a
 * published collection that the player does not own. Contents are known in advance: nothing is
 * drawn. A player who owns every such card may take any of them.
 *
 * Idempotent: the same card again for the same level returns the first result. One transaction:
 * lock the claim row, check the card, then mark the choice and add the copy in one statement.
 * Lock order: the claim row, then the copy (nothing else locks them the other way round).
 */
export async function chooseCard(
  db: Database,
  input: {
    readonly userId: string;
    readonly level: number;
    readonly cardId: string;
    readonly now: EpochMs;
  },
): Promise<CardChoiceResult> {
  const { userId, level, cardId, now } = input;
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  const choosable = RARITIES.filter((rarity) => isChoosableRarity(rules, rarity));

  return db.transaction(async (tx): Promise<CardChoiceResult> => {
    const [claim] = await tx
      .select({ rewards: userLevelRewards.rewards, chosenCardId: userLevelRewards.chosenCardId })
      .from(userLevelRewards)
      .where(and(eq(userLevelRewards.userId, userId), eq(userLevelRewards.level, level)))
      .for("update");
    if (claim === undefined || !hasCardChoice(claim.rewards)) {
      return { kind: "refused", reason: "no_card_choice" };
    }
    if (claim.chosenCardId !== null) {
      return claim.chosenCardId === cardId
        ? { kind: "chosen", level, cardId }
        : { kind: "refused", reason: "already_chosen" };
    }

    const isChoosable = sql`${cards.retiredAt} is null and ${collections.publishedAt} <= ${new Date(now)}
      and ${cards.rarity} in (${sql.join(
        choosable.map((rarity) => sql`${rarity}`),
        sql`, `,
      )})`;
    const owns = (card: typeof cards.id) => sql`exists (select 1 from ${userCards}
      where ${userCards.userId} = ${userId} and ${userCards.cardId} = ${card}
        and ${userCards.quantity} > 0)`;
    const [card] = await tx
      .select({
        choosable: sql<boolean>`${isChoosable}`,
        owned: owns(cards.id).mapWith(Boolean),
      })
      .from(cards)
      .innerJoin(collections, eq(collections.id, cards.collectionId))
      .where(eq(cards.id, cardId));
    if (card === undefined || !card.choosable) {
      return { kind: "refused", reason: "card_not_choosable" };
    }
    if (card.owned) {
      // Rare: only allowed when nothing choosable is missing. An anti-join over the catalog.
      const [missing] = await tx
        .select({ id: cards.id })
        .from(cards)
        .innerJoin(collections, eq(collections.id, cards.collectionId))
        .where(sql`${isChoosable} and not ${owns(cards.id)}`)
        .limit(1);
      if (missing !== undefined) return { kind: "refused", reason: "card_not_choosable" };
    }

    const at = new Date(now);
    const choiceUpdate = tx.$with("choice_update").as(
      tx
        .update(userLevelRewards)
        .set({ chosenCardId: cardId, chosenAt: at })
        .where(and(eq(userLevelRewards.userId, userId), eq(userLevelRewards.level, level)))
        .returning({ level: userLevelRewards.level }),
    );
    await tx
      .with(choiceUpdate)
      .insert(userCards)
      .values({ userId, cardId, quantity: 1, firstObtainedAt: at, lastObtainedAt: at })
      .onConflictDoUpdate({
        target: [userCards.userId, userCards.cardId, userCards.variant],
        set: {
          quantity: sql`${userCards.quantity} + 1`,
          lastObtainedAt: sql`excluded.last_obtained_at`,
        },
      });
    return { kind: "chosen", level, cardId };
  });
}

function hasCardChoice(rewards: readonly LevelReward[]): boolean {
  return rewards.some((reward) => reward.kind === "card_choice");
}
