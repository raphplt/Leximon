import type {
  BoosterWalletResponse,
  LevelRewardView,
  WelcomeRefusal,
  WelcomeWeekResponse,
} from "@leximon/contract";
import {
  type EpochMs,
  gameDayOf,
  type LevelReward,
  WELCOME_SCHEDULE,
  welcomeRewards,
  welcomeRulesAt,
  welcomeState,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { asc, eq, sql } from "drizzle-orm";
import { lockWallet, walletView, withRewards } from "../levels/rewards";

const { boosterWallets, users, userWelcomeDays } = schema;

/** The welcome week of a player: what each day gives, how far they are, whether today's waits. */
export async function readWelcomeWeek(
  db: Pick<Database, "select">,
  userId: string,
  now: EpochMs,
): Promise<WelcomeWeekResponse> {
  const rules = welcomeRulesAt(WELCOME_SCHEDULE, now);
  const [player] = await db
    .select({ guest: users.isAnonymous })
    .from(users)
    .where(eq(users.id, userId));
  const claims = await db
    .select({ day: userWelcomeDays.day, on: userWelcomeDays.claimedOn })
    .from(userWelcomeDays)
    .where(eq(userWelcomeDays.userId, userId))
    .orderBy(asc(userWelcomeDays.day));
  const state = welcomeState(rules, claims, gameDayOf(now).key);
  return {
    days: rules.days.map((day) => [...day]),
    claimed: claims.length,
    open: state.kind === "open",
    account: player?.guest !== true,
  };
}

export type WelcomeClaimResult =
  | {
      readonly kind: "claimed";
      readonly day: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly kind: "refused"; readonly reason: WelcomeRefusal };

/**
 * Claims a day of the welcome week. Idempotent by nature: the day is the key, a second claim of
 * the same day returns what the first one gave.
 *
 * A day whose boosters do not fit in the reserve stays closed (`reserve_full`), to be claimed
 * later: nothing is wasted.
 *
 * One transaction that locks the player's wallet, as a coffret does (lock order: the wallet
 * first): BEGIN, lock (or create) the wallet, read the account and the days claimed, one combined
 * write, COMMIT. The avatar and the title are recorded here and used by the profile.
 */
export async function claimWelcomeDay(
  db: Database,
  input: { readonly userId: string; readonly day: number; readonly now: EpochMs },
): Promise<WelcomeClaimResult> {
  const { userId, day, now } = input;
  const rules = welcomeRulesAt(WELCOME_SCHEDULE, now);
  const today = gameDayOf(now).key;

  return db.transaction(async (tx): Promise<WelcomeClaimResult> => {
    const locked = await lockWallet(tx, userId, now);

    // After the lock: sees a day claimed by a concurrent request.
    const [state] = await tx
      .select({
        guest: sql<boolean>`coalesce((select ${users.isAnonymous} from ${users}
          where ${users.id} = ${userId}), true)`,
        claims: sql<{ day: number; on: string; rewards: LevelReward[] }[]>`coalesce(
          (select json_agg(json_build_object('day', ${userWelcomeDays.day},
            'on', ${userWelcomeDays.claimedOn}, 'rewards', ${userWelcomeDays.rewards}))
          from ${userWelcomeDays} where ${userWelcomeDays.userId} = ${userId}), '[]'::json)`,
      })
      .from(sql`(select 1) as one`);
    if (state === undefined) throw new Error("Welcome lookup returned no row");

    const previous = state.claims.find((claim) => claim.day === day);
    if (previous !== undefined) {
      return { kind: "claimed", day, rewards: previous.rewards, wallet: walletView(locked, now) };
    }
    if (state.guest) return { kind: "refused", reason: "account_required" };
    const next = welcomeState(rules, state.claims, today);
    if (next.kind !== "open" || next.day !== day) return { kind: "refused", reason: "not_open" };

    const rewards = [...welcomeRewards(rules, day)];
    const after = withRewards(locked, rewards, locked.reserveSlots, now);
    if (after === null) return { kind: "refused", reason: "reserve_full" };

    const claimInsert = tx.$with("claim_insert").as(
      tx
        .insert(userWelcomeDays)
        .values({ userId, day, rewards, claimedAt: new Date(now), claimedOn: today })
        .returning({ day: userWelcomeDays.day }),
    );
    await tx
      .with(claimInsert)
      .update(boosterWallets)
      .set(after)
      .where(eq(boosterWallets.userId, userId));
    return { kind: "claimed", day, rewards, wallet: walletView(after, now) };
  });
}
