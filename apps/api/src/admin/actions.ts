import { ADMIN_ACTIONS } from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  bonusRulesAt,
  createFullWallet,
  type EpochMs,
  REFILL_SCHEDULE,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { ADMIN_ROLE } from "../auth";

/**
 * Changes made from the back office. Each one is logged in `admin_actions` in the same
 * transaction, so a change is never applied without its trace.
 */

const { adminActions, boosterWallets, guestLinks, sessions, trades, users } = schema;

export type GrantBonusResult =
  | { readonly kind: "granted"; readonly added: number; readonly bonus: number }
  | { readonly kind: "player_not_found" }
  /** The guest's game went to an account: gifts go to that account. */
  | { readonly kind: "guest_archived" };

/**
 * Adds bonus boosters to a player's reserve, up to its cap (P23): the gift follows the same rule
 * as rewards, so `added` can be less than asked.
 *
 * Locks the wallet row as opening a booster does, so a gift and an open never overwrite each other.
 * A request repeating its idempotency key returns the first result without adding again.
 */
export async function grantBonus(
  db: Database,
  input: {
    readonly adminId: string;
    readonly userId: string;
    readonly amount: number;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly now: EpochMs;
  },
): Promise<GrantBonusResult> {
  const { adminId, userId, amount, reason, idempotencyKey, now } = input;
  const cap = bonusRulesAt(BONUS_SCHEDULE, now).reserveCap;

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: users.id,
        archived: sql<boolean>`exists (select 1 from ${guestLinks}
          where ${guestLinks.guestId} = ${users.id})`,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (target === undefined) return { kind: "player_not_found" };
    if (target.archived) return { kind: "guest_archived" };

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
      .returning({ bonus: boosterWallets.bonusBoosters });
    if (locked === undefined) {
      throw new Error(`Wallet missing for user ${userId} right after its creation`);
    }

    // After the lock: sees a gift with the same key committed by a concurrent retry.
    const [previous] = await tx
      .select({ details: adminActions.details })
      .from(adminActions)
      .where(
        and(eq(adminActions.adminId, adminId), eq(adminActions.idempotencyKey, idempotencyKey)),
      );
    if (previous !== undefined) {
      return {
        kind: "granted",
        added: Number(previous.details["added"] ?? 0),
        bonus: locked.bonus,
      };
    }

    const bonus = Math.max(locked.bonus, Math.min(cap, locked.bonus + amount));
    const added = bonus - locked.bonus;
    if (added > 0) {
      await tx
        .update(boosterWallets)
        .set({ bonusBoosters: bonus })
        .where(eq(boosterWallets.userId, userId));
    }
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.grantBonus,
      targetUserId: userId,
      details: { amount, added, reason },
      idempotencyKey,
      createdAt: new Date(now),
    });
    return { kind: "granted", added, bonus };
  });
}

export type BanResult =
  | { readonly kind: "done" }
  | { readonly kind: "player_not_found" }
  | { readonly kind: "cannot_ban_admin" };

/**
 * Bans a player: they can no longer sign in (admin plugin) and their sessions are deleted. A
 * session read from the signed cookie cache can live up to five more minutes.
 */
export async function banPlayer(
  db: Database,
  input: {
    readonly adminId: string;
    readonly userId: string;
    readonly reason: string;
    readonly days: number | null;
    readonly now: EpochMs;
  },
): Promise<BanResult> {
  const { adminId, userId, reason, days, now } = input;
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (target === undefined) return { kind: "player_not_found" };
    if (target.role === ADMIN_ROLE) return { kind: "cannot_ban_admin" };

    const expires = days === null ? null : new Date(now + days * 86_400_000);
    await tx
      .update(users)
      .set({ banned: true, banReason: reason, banExpires: expires })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.ban,
      targetUserId: userId,
      details: { reason, days },
      createdAt: new Date(now),
    });
    return { kind: "done" };
  });
}

export async function unbanPlayer(
  db: Database,
  input: { readonly adminId: string; readonly userId: string; readonly now: EpochMs },
): Promise<{ readonly kind: "done" } | { readonly kind: "player_not_found" }> {
  const { adminId, userId, now } = input;
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (updated.length === 0) return { kind: "player_not_found" };
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.unban,
      targetUserId: userId,
      createdAt: new Date(now),
    });
    return { kind: "done" };
  });
}

export type CancelTradeResult =
  | { readonly kind: "cancelled" }
  | { readonly kind: "trade_not_found" }
  | { readonly kind: "trade_not_pending" };

/**
 * Cancels a pending offer on behalf of the players. One conditional update, like a player's own
 * cancel: it waits for a concurrent acceptance and then no longer matches. Logged against the
 * proposer.
 */
export async function cancelTrade(
  db: Database,
  input: {
    readonly adminId: string;
    readonly tradeId: string;
    readonly reason: string;
    readonly now: EpochMs;
  },
): Promise<CancelTradeResult> {
  const { adminId, tradeId, reason, now } = input;
  return db.transaction(async (tx) => {
    const cancelled = await tx
      .update(trades)
      .set({ status: "cancelled", resolvedAt: new Date(now) })
      .where(
        and(
          eq(trades.id, tradeId),
          eq(trades.status, "pending"),
          gt(trades.expiresAt, new Date(now)),
        ),
      )
      .returning({ proposerId: trades.proposerId });
    const row = cancelled[0];
    if (row === undefined) {
      const [existing] = await tx
        .select({ id: trades.id })
        .from(trades)
        .where(eq(trades.id, tradeId));
      return existing === undefined ? { kind: "trade_not_found" } : { kind: "trade_not_pending" };
    }
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.cancelTrade,
      targetUserId: row.proposerId,
      details: { tradeId, reason },
      createdAt: new Date(now),
    });
    return { kind: "cancelled" };
  });
}

/** Logs a read that exposes personal data in bulk, such as the waiting list export. */
export async function logExport(db: Database, adminId: string, now: EpochMs): Promise<void> {
  await db.insert(adminActions).values({
    adminId,
    action: ADMIN_ACTIONS.exportWaitlist,
    createdAt: new Date(now),
  });
}
