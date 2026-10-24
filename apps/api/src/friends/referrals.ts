import type {
  BoosterWalletResponse,
  ClaimReferralRefusal,
  ReferralReward,
  ReferrerResponse,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  betaPlacesLeft,
  bonusRulesAt,
  defaultAvatar,
  type EpochMs,
  FRIEND_SCHEDULE,
  type FriendRules,
  friendRulesAt,
  gameMonthOf,
  LEVEL_REWARD_SCHEDULE,
  levelOf,
  levelRewardRulesAt,
  referralRewardFits,
  reserveCapacity,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { lockWallet, type WalletRow, walletView } from "../levels/rewards";
import { readBadges } from "../profile/profile";
import { ensurePlayer } from "../trades/players";
import { makeFriends, notLocked } from "./friends";

const { boosterWallets, mailLetters, players, referrals, userProgress, users } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;

function rulesAt(now: EpochMs): FriendRules {
  return friendRulesAt(FRIEND_SCHEDULE, now);
}

/** A player whose friend link works: a member with a pseudo, not suspended or closed. */
async function findReferrer(db: Reader, code: string, now: EpochMs) {
  const [row] = await db
    .select({
      userId: players.userId,
      code: players.code,
      pseudo: players.pseudo,
      avatar: players.avatar,
      frame: players.frame,
      placesUsed: players.friendPlacesUsed,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(
      and(eq(players.code, code), eq(users.isAnonymous, false), notLocked(players.userId, now)),
    );
  return row === undefined || row.pseudo === null ? null : { ...row, pseudo: row.pseudo };
}

/** `GET /referrers/:code`: who invites by this link, and whether the closed beta lets one more in. */
export async function readReferrer(
  db: Database,
  input: { readonly code: string; readonly betaRequired: boolean; readonly now: EpochMs },
): Promise<ReferrerResponse | null> {
  const referrer = await findReferrer(db, input.code, input.now);
  if (referrer === null) return null;
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, input.now);
  const open = !input.betaRequired || betaPlacesLeft(rulesAt(input.now), referrer.placesUsed) > 0;
  return {
    player: {
      pseudo: referrer.pseudo,
      avatar: referrer.avatar ?? defaultAvatar(rules, referrer.code),
      frame: referrer.frame ?? rules.startingFrame,
    },
    status: open ? "open" : "full",
  };
}

export type ReferrerClaim =
  | { readonly kind: "claimed"; readonly referrerId: string }
  | { readonly kind: "closed" | "unknown" };

/**
 * Takes a place of the closed beta on a friend link, for a new player arriving by it. One
 * conditional update: two arrivals at once never take more places than the link has.
 */
export async function claimReferrerPlace(
  db: Database,
  code: string,
  now: EpochMs,
): Promise<ReferrerClaim> {
  const referrer = await findReferrer(db, code, now);
  if (referrer === null) return { kind: "unknown" };
  const [row] = await db
    .update(players)
    .set({ friendPlacesUsed: sql`${players.friendPlacesUsed} + 1` })
    .where(
      and(
        eq(players.userId, referrer.userId),
        lt(players.friendPlacesUsed, rulesAt(now).betaPlacesPerPlayer),
      ),
    )
    .returning({ userId: players.userId });
  return row === undefined ? { kind: "closed" } : { kind: "claimed", referrerId: row.userId };
}

/** The player behind a friend link, without taking a place: the beta is open, or it was taken. */
export async function referrerOf(db: Reader, code: string, now: EpochMs): Promise<string | null> {
  return (await findReferrer(db, code, now))?.userId ?? null;
}

/**
 * Keeps who invited a new player. Written once: the first link followed wins, and a later one
 * changes nothing.
 */
export async function recordReferral(
  db: Database | Transaction,
  input: { readonly refereeId: string; readonly referrerId: string; readonly now: EpochMs },
): Promise<void> {
  if (input.refereeId === input.referrerId) return;
  await db
    .insert(referrals)
    .values({
      refereeId: input.refereeId,
      referrerId: input.referrerId,
      createdAt: new Date(input.now),
    })
    .onConflictDoNothing();
}

/**
 * A player who came by a friend link now has an account: they become friends of the player who
 * invited them, without a request, and the inviter gets a letter. Nothing when either blocked the
 * other, or when the inviter left. Run in the transaction that gives the account its game.
 */
export async function welcomeReferee(
  tx: Transaction,
  input: { readonly accountId: string; readonly now: EpochMs },
): Promise<void> {
  const { accountId, now } = input;
  const [referral] = await tx
    .select({ referrerId: referrals.referrerId })
    .from(referrals)
    .where(eq(referrals.refereeId, accountId));
  const referrerId = referral?.referrerId ?? null;
  if (referrerId === null) return;
  const blocked = await tx.execute(sql`select 1 from user_blocks
    where (blocker_id = ${accountId} and blocked_id = ${referrerId})
       or (blocker_id = ${referrerId} and blocked_id = ${accountId}) limit 1`);
  if (blocked.rows.length > 0) return;
  await makeFriends(tx, accountId, referrerId, now);
  await tx
    .insert(mailLetters)
    .values({
      userId: referrerId,
      kind: "referral_arrived",
      payload: { playerId: accountId },
      dedupeKey: `referral:${accountId}:arrived`,
      createdAt: new Date(now),
    })
    .onConflictDoNothing();
}

/**
 * Invited players who reached the referral level: the invitation is rewarded if the inviter's
 * month has room, and both players get a letter. Each referral qualifies once. The inviter's row
 * is locked while their month is counted, so that two invited players qualifying at once never
 * pass the monthly cap together.
 */
export async function qualifyReferrals(
  db: Database,
  userIds: readonly string[],
  now: EpochMs,
): Promise<void> {
  if (userIds.length === 0) return;
  const rules = rulesAt(now);
  const candidates = await db
    .select({
      refereeId: referrals.refereeId,
      referrerId: referrals.referrerId,
      xp: userProgress.xp,
    })
    .from(referrals)
    .innerJoin(userProgress, eq(userProgress.userId, referrals.refereeId))
    .innerJoin(users, eq(users.id, referrals.refereeId))
    .where(
      and(
        inArray(referrals.refereeId, [...new Set(userIds)]),
        isNull(referrals.qualifiedAt),
        eq(users.isAnonymous, false),
      ),
    );
  const month = gameMonthOf(now);
  for (const candidate of candidates) {
    const { referrerId, refereeId } = candidate;
    if (referrerId === null || levelOf(candidate.xp).level < rules.referralLevel) continue;
    // The reward is named by the invited player's code, which a player gets on first need.
    await ensurePlayer(db, refereeId);
    await db.transaction(async (tx) => {
      await tx
        .select({ userId: players.userId })
        .from(players)
        .where(eq(players.userId, referrerId))
        .for("update");
      const [count] = await tx
        .select({ rewarded: sql<number>`count(*)::int` })
        .from(referrals)
        .where(
          and(
            eq(referrals.referrerId, referrerId),
            eq(referrals.qualifiedMonth, month),
            eq(referrals.rewarded, true),
          ),
        );
      const rewarded = referralRewardFits(rules, count?.rewarded ?? 0);
      const updated = await tx
        .update(referrals)
        .set({ qualifiedAt: new Date(now), qualifiedMonth: month, rewarded })
        .where(and(eq(referrals.refereeId, refereeId), isNull(referrals.qualifiedAt)))
        .returning({ refereeId: referrals.refereeId });
      if (updated.length === 0) return;
      await tx
        .insert(mailLetters)
        .values([
          {
            userId: referrerId,
            kind: "referral_qualified",
            payload: { playerId: refereeId },
            dedupeKey: `referral:${refereeId}:qualified`,
            createdAt: new Date(now),
          },
          {
            userId: refereeId,
            kind: "referral_qualified",
            payload: { playerId: referrerId },
            dedupeKey: `referral:${refereeId}:qualified`,
            createdAt: new Date(now),
          },
        ])
        .onConflictDoNothing();
    });
  }
}

/** Bonus boosters of friend links waiting for the player to claim them, oldest first. */
export async function readReferralRewards(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<ReferralReward[]> {
  const rows = await db
    .select({
      refereeId: referrals.refereeId,
      referrerId: referrals.referrerId,
      referrerClaimedAt: referrals.referrerClaimedAt,
      refereeClaimedAt: referrals.refereeClaimedAt,
      qualifiedAt: referrals.qualifiedAt,
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.rewarded, true),
        sql`((${referrals.referrerId} = ${userId} and ${referrals.referrerClaimedAt} is null)
          or (${referrals.refereeId} = ${userId} and ${referrals.refereeClaimedAt} is null))`,
      ),
    )
    .orderBy(referrals.qualifiedAt);
  if (rows.length === 0) return [];
  const others = rows.flatMap((row) =>
    row.refereeId === userId ? (row.referrerId === null ? [] : [row.referrerId]) : [row.refereeId],
  );
  const badges = await readBadges(db, [...others, ...rows.map((row) => row.refereeId)], now);
  const boosters = rulesAt(now).referralBoosters;
  return rows.flatMap((row): ReferralReward[] => {
    const referee = badges.get(row.refereeId);
    if (referee === undefined) return [];
    const role = row.refereeId === userId ? "referee" : "referrer";
    const other = role === "referee" ? row.referrerId : row.refereeId;
    return [
      {
        player: other === null ? null : (badges.get(other) ?? null),
        role,
        refereeCode: referee.code,
        boosters,
      },
    ];
  });
}

export type ClaimReferralResult =
  | { readonly kind: "claimed"; readonly wallet: BoosterWalletResponse }
  | { readonly kind: "refused"; readonly reason: ClaimReferralRefusal };

/**
 * `POST /me/referrals/:code/claim`, the code being the invited player's. Like a coffret: the
 * wallet is locked first, a reserve too full keeps the reward for later, and a second claim
 * answers with the wallet as it is.
 */
export async function claimReferral(
  db: Database,
  input: { readonly userId: string; readonly refereeCode: string; readonly now: EpochMs },
): Promise<ClaimReferralResult> {
  const { userId, now } = input;
  const [referee] = await db
    .select({ userId: players.userId })
    .from(players)
    .where(eq(players.code, input.refereeCode));
  if (referee === undefined) return { kind: "refused", reason: "reward_not_found" };
  const boosters = rulesAt(now).referralBoosters;
  const bonusRules = bonusRulesAt(BONUS_SCHEDULE, now);

  return db.transaction(async (tx): Promise<ClaimReferralResult> => {
    const locked = await lockWallet(tx, userId, now);
    const [referral] = await tx
      .select()
      .from(referrals)
      .where(eq(referrals.refereeId, referee.userId))
      .for("update");
    const role =
      referral === undefined || !referral.rewarded
        ? null
        : referral.refereeId === userId
          ? "referee"
          : referral.referrerId === userId
            ? "referrer"
            : null;
    if (referral === undefined || role === null) {
      return { kind: "refused", reason: "reward_not_found" };
    }
    const claimedAt = role === "referee" ? referral.refereeClaimedAt : referral.referrerClaimedAt;
    if (claimedAt !== null) return { kind: "claimed", wallet: walletView(locked, now) };
    if (locked.bonusBoosters + boosters > reserveCapacity(bonusRules, locked.reserveSlots)) {
      return { kind: "refused", reason: "reserve_full" };
    }
    const after: WalletRow = { ...locked, bonusBoosters: locked.bonusBoosters + boosters };
    await tx
      .update(referrals)
      .set(
        role === "referee"
          ? { refereeClaimedAt: new Date(now) }
          : { referrerClaimedAt: new Date(now) },
      )
      .where(eq(referrals.refereeId, referee.userId));
    await tx
      .update(boosterWallets)
      .set({ bonusBoosters: after.bonusBoosters })
      .where(eq(boosterWallets.userId, userId));
    return { kind: "claimed", wallet: walletView(after, now) };
  });
}
