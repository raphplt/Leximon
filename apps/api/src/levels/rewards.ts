import type { BoosterWalletResponse, LevelRewardView } from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  type BoosterWallet,
  bonusRulesAt,
  capacityAt,
  computeRefill,
  createFullWallet,
  type EpochMs,
  LEVEL_REWARD_SCHEDULE,
  type LevelReward,
  levelOf,
  levelRewardRulesAt,
  levelRewards,
  REFILL_SCHEDULE,
  reserveCapacity,
  rewardReserve,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { asc, eq, sql } from "drizzle-orm";

const { boosterWallets, guestLinks, userLevelRewards, userProgress } = schema;

export type WalletRow = Pick<
  typeof boosterWallets.$inferSelect,
  | "stored"
  | "progressMs"
  | "asOf"
  | "bonusBoosters"
  | "garniBoosters"
  | "preciousBoosters"
  | "reserveSlots"
  | "ecus"
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
    ecus: row?.ecus ?? 0,
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

/**
 * The wallet once rewards are added to its reserve, or `null` when they bring boosters that do
 * not fit: the reward then waits, so that nothing is wasted.
 */
export function withRewards(
  locked: WalletRow,
  rewards: readonly LevelReward[],
  reserveSlots: number,
  now: EpochMs,
): WalletRow | null {
  const added = rewardReserve(rewards);
  const capacity = reserveCapacity(bonusRulesAt(BONUS_SCHEDULE, now), reserveSlots);
  if (added.bonus > 0 && locked.bonusBoosters + added.bonus > capacity) return null;
  return {
    stored: locked.stored,
    progressMs: locked.progressMs,
    asOf: locked.asOf,
    bonusBoosters: locked.bonusBoosters + added.bonus,
    garniBoosters: locked.garniBoosters + added.garni,
    preciousBoosters: locked.preciousBoosters + added.precious,
    reserveSlots,
    ecus: locked.ecus,
  };
}

export interface LevelRewardsState {
  readonly claimed: number[];
}

/** Levels a player claimed, lowest first. */
export async function readLevelRewards(
  db: Pick<Database, "select">,
  userId: string,
): Promise<LevelRewardsState> {
  const rows = await db
    .select({ level: userLevelRewards.level })
    .from(userLevelRewards)
    .where(eq(userLevelRewards.userId, userId))
    .orderBy(asc(userLevelRewards.level));
  return { claimed: rows.map((row) => row.level) };
}

export type ClaimResult =
  | {
      readonly kind: "claimed";
      readonly level: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly kind: "refused"; readonly reason: ClaimRefusalReason };

export type ClaimRefusalReason = "level_not_reached" | "reserve_full" | "guest_archived";

/**
 * Claims the reward of a level: the coffret. Idempotent by nature: the level is the key, a
 * second claim of the same level returns what the first one gave.
 *
 * A coffret that would waste something stays closed, to be claimed later: boosters that do not
 * fit in the reserve (`reserve_full`).
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

    const reserveSlots = locked.reserveSlots + (has("reserve_slot") ? 1 : 0);
    const after = withRewards(locked, rewards, reserveSlots, now);
    if (after === null) return { kind: "refused", reason: "reserve_full" };

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
