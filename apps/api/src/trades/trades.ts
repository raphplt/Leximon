import type { Trade } from "@leximon/contract";
import {
  canGive,
  checkOffer,
  type EpochMs,
  type Holding,
  isAccountOldEnough,
  isExpired,
  TRADE_SCHEDULE,
  type TradeRefusal,
  tradeRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, desc, eq, gt, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TradeCursor } from "./cursor";
import {
  ensurePlayer,
  findPlayerByCode,
  holdingFields,
  TRADED_VARIANT,
  toHolding,
} from "./players";
import { type CardMove, planTransfers } from "./transfers";

const { cards, players, tradeItems, trades, userCards, users } = schema;

const DAY_MS = 24 * 60 * 60 * 1000;

type StoredStatus = (typeof schema.tradeStatus.enumValues)[number];

/** A trade as stored, with the players' public codes. */
export interface TradeRecord {
  readonly id: string;
  readonly proposerId: string;
  readonly recipientId: string;
  readonly proposerCode: string;
  readonly recipientCode: string;
  readonly give: readonly string[];
  readonly want: readonly string[];
  readonly status: StoredStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly resolvedAt: Date | null;
}

/** The public view of a trade. "expired" is derived here, never stored (no scheduled task). */
export function toTradeResponse(record: TradeRecord, now: EpochMs): Trade {
  const expired = record.status === "pending" && isExpired(record.expiresAt.getTime(), now);
  return {
    id: record.id,
    proposerCode: record.proposerCode,
    recipientCode: record.recipientCode,
    give: sortIds(record.give),
    want: sortIds(record.want),
    status: expired ? "expired" : record.status,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    resolvedAt: record.resolvedAt === null ? null : record.resolvedAt.toISOString(),
  };
}

const proposerPlayer = alias(players, "proposer_player");
const recipientPlayer = alias(players, "recipient_player");

/** Cards of one side, read in the same statement as the trade (no N+1 query). */
function cardsOn(side: "give" | "want") {
  return sql<
    string[]
  >`array(select ${tradeItems.cardId} from ${tradeItems} where ${tradeItems.tradeId} = ${trades.id} and ${tradeItems.side} = ${side})`;
}

const tradeFields = {
  id: trades.id,
  proposerId: trades.proposerId,
  recipientId: trades.recipientId,
  proposerCode: proposerPlayer.code,
  recipientCode: recipientPlayer.code,
  give: cardsOn("give"),
  want: cardsOn("want"),
  status: trades.status,
  createdAt: trades.createdAt,
  expiresAt: trades.expiresAt,
  resolvedAt: trades.resolvedAt,
};

type TradeReader = Pick<Database, "select">;

function selectTrades(db: TradeReader) {
  return db
    .select(tradeFields)
    .from(trades)
    .innerJoin(proposerPlayer, eq(proposerPlayer.userId, trades.proposerId))
    .innerJoin(recipientPlayer, eq(recipientPlayer.userId, trades.recipientId));
}

async function readTrade(db: TradeReader, tradeId: string): Promise<TradeRecord | null> {
  const [row] = await selectTrades(db).where(eq(trades.id, tradeId));
  return row ?? null;
}

// --- Creating an offer -------------------------------------------------------------------------

export interface CreateTradeInput {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly recipientCode: string;
  readonly give: readonly string[];
  readonly want: readonly string[];
  readonly now: EpochMs;
}

export type CreateTradeResult =
  | { readonly kind: "created"; readonly trade: TradeRecord }
  | { readonly kind: "player_not_found" }
  | { readonly kind: "refused"; readonly reason: TradeRefusal };

/**
 * Sends an offer. Nothing is reserved: the cards are only checked, and checked again on
 * acceptance.
 *
 * The daily quota is a read-modify-write of the proposer's state, so the transaction locks the
 * proposer's `players` row: concurrent offers from one player are applied one after the other.
 * Collections are read before the transaction, to keep the lock short; they need no lock since
 * nothing is moved yet. Statements: player, recipient, holdings, then BEGIN, lock, key and quota,
 * combined insert, COMMIT.
 */
export async function createTrade(
  db: Database,
  input: CreateTradeInput,
): Promise<CreateTradeResult> {
  const { userId, idempotencyKey, give, want, now } = input;
  const rules = tradeRulesAt(TRADE_SCHEDULE, now);

  const proposer = await ensurePlayer(db, userId);
  const recipient = await findPlayerByCode(db, input.recipientCode);
  if (recipient === null) {
    return { kind: "player_not_found" };
  }
  const holdings = await readHoldings(db, [
    { userId: proposer.userId, cardIds: give },
    { userId: recipient.userId, cardIds: want },
  ]);

  return db.transaction(async (tx) => {
    const locked = await tx
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.userId, userId))
      .for("update");
    if (locked.length === 0) {
      throw new Error("Player row missing right after its creation");
    }

    const sameKey = sql<string | null>`(select ${trades.id} from ${trades}
      where ${trades.proposerId} = ${userId} and ${trades.idempotencyKey} = ${idempotencyKey})`;
    // Rolling 24 hours, served by trades_proposer_created_idx. Every offer counts, even cancelled
    // ones: cancelling must not reset the quota.
    const since = new Date(now - DAY_MS).toISOString();
    const sentToday = sql<number>`(select count(*)::int from ${trades}
      where ${trades.proposerId} = ${userId} and ${trades.createdAt} > ${since})`;
    // A separate statement, after the lock is granted: it sees offers committed by a concurrent
    // request of the same player that held the lock first.
    const [state] = await tx
      .select({ existingId: sameKey, sentToday })
      .from(players)
      .where(eq(players.userId, userId));
    if (state === undefined) {
      throw new Error("Player row vanished under its lock");
    }

    if (state.existingId !== null) {
      const existing = await readTrade(tx, state.existingId);
      if (existing === null) throw new Error("Trade vanished under its proposer's lock");
      return { kind: "created", trade: existing };
    }

    const refusal = checkOffer({
      rules,
      proposerId: proposer.userId,
      recipientId: recipient.userId,
      give,
      want,
      proposerCreatedAt: proposer.createdAt,
      recipientCreatedAt: recipient.createdAt,
      offersSentToday: state.sentToday,
      proposerHoldings: holdings.get(proposer.userId) ?? new Map(),
      recipientHoldings: holdings.get(recipient.userId) ?? new Map(),
      now,
    });
    if (refusal !== null) {
      return { kind: "refused", reason: refusal };
    }

    const trade: TradeRecord = {
      id: crypto.randomUUID(),
      proposerId: proposer.userId,
      recipientId: recipient.userId,
      proposerCode: proposer.code,
      recipientCode: recipient.code,
      give,
      want,
      status: "pending",
      createdAt: new Date(now),
      // Stored, so that a later change of the delay does not affect offers already sent.
      expiresAt: new Date(now + rules.offerTtlMs),
      resolvedAt: null,
    };
    // One statement: the items' foreign key is checked at its end, after the trade is inserted.
    const tradeInsert = tx.$with("trade_insert").as(
      tx
        .insert(trades)
        .values({
          id: trade.id,
          proposerId: trade.proposerId,
          recipientId: trade.recipientId,
          idempotencyKey,
          createdAt: trade.createdAt,
          expiresAt: trade.expiresAt,
        })
        .returning({ id: trades.id }),
    );
    await tx
      .with(tradeInsert)
      .insert(tradeItems)
      .values([
        ...give.map((cardId) => ({ tradeId: trade.id, side: "give" as const, cardId })),
        ...want.map((cardId) => ({ tradeId: trade.id, side: "want" as const, cardId })),
      ]);
    return { kind: "created", trade };
  });
}

// --- Listing offers ----------------------------------------------------------------------------

export interface ListTradesInput {
  readonly userId: string;
  readonly box: "incoming" | "outgoing";
  readonly after: TradeCursor | null;
  readonly limit: number;
}

/**
 * Offers received or sent, newest first, one extra row telling whether another page exists.
 * Served by trades_recipient_created_idx or trades_proposer_created_idx.
 */
export async function listTrades(db: Database, input: ListTradesInput): Promise<TradeRecord[]> {
  const owner = input.box === "incoming" ? trades.recipientId : trades.proposerId;
  const { after } = input;
  let page: SQL | undefined;
  if (after !== null) {
    const createdAt = new Date(after.createdAt);
    page = or(
      lt(trades.createdAt, createdAt),
      and(eq(trades.createdAt, createdAt), lt(trades.id, after.id)),
    );
  }
  return selectTrades(db)
    .where(and(eq(owner, input.userId), page))
    .orderBy(desc(trades.createdAt), desc(trades.id))
    .limit(input.limit + 1);
}

// --- Accepting an offer ------------------------------------------------------------------------

export type AcceptRefusal =
  | "trade_not_pending"
  | "trade_expired"
  | "card_not_tradeable"
  | "account_too_recent";

export type AcceptTradeResult =
  | { readonly kind: "completed"; readonly trade: TradeRecord }
  | { readonly kind: "not_found" }
  | { readonly kind: "refused"; readonly reason: AcceptRefusal };

const proposerUser = alias(users, "proposer_user");
const recipientUser = alias(users, "recipient_user");

/**
 * Concludes an offer, for its recipient only.
 *
 * One transaction: lock the offer, then the `user_cards` rows of both players for every card
 * involved, always in (user_id, card_id) order so that concurrent trades between the same players
 * cannot deadlock. Everything is checked again under these locks with the rules in force now,
 * then one copy of each card changes hands. Statements: BEGIN, lock offer, lock cards, combined
 * write, COMMIT. Mastery (`user_mastery`) is never touched: it belongs to the player, not the copy.
 */
export async function acceptTrade(
  db: Database,
  input: { readonly userId: string; readonly tradeId: string; readonly now: EpochMs },
): Promise<AcceptTradeResult> {
  const { userId, tradeId, now } = input;

  return db.transaction(async (tx): Promise<AcceptTradeResult> => {
    // A concurrent acceptance waits here, then sees the offer as completed.
    const [locked] = await tx
      .select({
        ...tradeFields,
        proposerCreatedAt: proposerUser.createdAt,
        recipientCreatedAt: recipientUser.createdAt,
      })
      .from(trades)
      .innerJoin(proposerPlayer, eq(proposerPlayer.userId, trades.proposerId))
      .innerJoin(recipientPlayer, eq(recipientPlayer.userId, trades.recipientId))
      .innerJoin(proposerUser, eq(proposerUser.id, trades.proposerId))
      .innerJoin(recipientUser, eq(recipientUser.id, trades.recipientId))
      .where(eq(trades.id, tradeId))
      .for("update", { of: trades });
    if (locked === undefined || locked.recipientId !== userId) {
      return { kind: "not_found" };
    }
    const { proposerCreatedAt, recipientCreatedAt, ...record } = locked;
    if (record.status === "completed") {
      return { kind: "completed", trade: record };
    }
    if (record.status !== "pending") {
      return { kind: "refused", reason: "trade_not_pending" };
    }
    if (isExpired(record.expiresAt.getTime(), now)) {
      return { kind: "refused", reason: "trade_expired" };
    }

    const parties = [record.proposerId, record.recipientId];
    const cardIds = [...new Set([...record.give, ...record.want])];
    const rows = await tx
      .select(holdingFields)
      .from(userCards)
      .innerJoin(cards, eq(cards.id, userCards.cardId))
      .where(
        and(
          inArray(userCards.userId, parties),
          inArray(userCards.cardId, cardIds),
          eq(userCards.variant, TRADED_VARIANT),
        ),
      )
      .orderBy(asc(userCards.userId), asc(userCards.cardId))
      .for("update", { of: userCards });
    const holdings = groupHoldings(rows);

    const rules = tradeRulesAt(TRADE_SCHEDULE, now);
    if (
      !isAccountOldEnough(rules, proposerCreatedAt.getTime(), now) ||
      !isAccountOldEnough(rules, recipientCreatedAt.getTime(), now)
    ) {
      return { kind: "refused", reason: "account_too_recent" };
    }
    if (
      !canGive(rules, record.give, holdings.get(record.proposerId) ?? new Map(), now) ||
      !canGive(rules, record.want, holdings.get(record.recipientId) ?? new Map(), now)
    ) {
      // The offer stays pending: the player may obtain the card again.
      return { kind: "refused", reason: "card_not_tradeable" };
    }

    const resolvedAt = new Date(now);
    await tx
      .with(...moveCards(tx, planTransfers(record), resolvedAt))
      .update(trades)
      .set({ status: "completed", resolvedAt })
      .where(eq(trades.id, tradeId));
    return { kind: "completed", trade: { ...record, status: "completed", resolvedAt } };
  });
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Data-modifying CTEs moving the copies, run with the offer's update in one statement. The rows
 * are already locked; a giver keeps at least one copy (checked above, and by the
 * `user_cards_quantity_check` constraint as a last resort).
 */
function moveCards(tx: Transaction, plan: ReturnType<typeof planTransfers>, at: Date) {
  const ctes = [];
  if (plan.debits.length > 0) {
    ctes.push(
      tx.$with("debits").as(
        tx
          .update(userCards)
          .set({ quantity: sql`${userCards.quantity} - 1` })
          .where(and(eq(userCards.variant, TRADED_VARIANT), or(...plan.debits.map(isRowOf))))
          .returning({ cardId: userCards.cardId }),
      ),
    );
  }
  if (plan.credits.length > 0) {
    ctes.push(
      tx.$with("credits").as(
        tx
          .insert(userCards)
          .values(
            plan.credits.map(({ userId, cardId }) => ({
              userId,
              cardId,
              variant: TRADED_VARIANT,
              quantity: 1,
              firstObtainedAt: at,
              lastObtainedAt: at,
            })),
          )
          .onConflictDoUpdate({
            target: [userCards.userId, userCards.cardId, userCards.variant],
            set: {
              quantity: sql`${userCards.quantity} + 1`,
              // Restarts the holding period of rare cards (D-026).
              lastObtainedAt: sql`excluded.last_obtained_at`,
            },
          })
          .returning({ cardId: userCards.cardId }),
      ),
    );
  }
  return ctes;
}

function isRowOf(move: CardMove) {
  return and(eq(userCards.userId, move.userId), eq(userCards.cardId, move.cardId));
}

// --- Declining or cancelling an offer ----------------------------------------------------------

export type ResolveAction = "decline" | "cancel";

export type ResolveTradeResult =
  | { readonly kind: "resolved"; readonly trade: TradeRecord }
  | { readonly kind: "not_found" }
  | { readonly kind: "refused"; readonly reason: "trade_not_pending" | "trade_expired" };

/**
 * Declines (recipient) or cancels (proposer) a pending offer. A single conditional update, atomic
 * on its own: it waits for a concurrent acceptance and then no longer matches. The offer is read
 * back for the response, and to explain a refusal. Repeating the same action returns the offer.
 */
export async function resolveTrade(
  db: Database,
  input: {
    readonly userId: string;
    readonly tradeId: string;
    readonly action: ResolveAction;
    readonly now: EpochMs;
  },
): Promise<ResolveTradeResult> {
  const { userId, tradeId, action, now } = input;
  const actor = action === "decline" ? trades.recipientId : trades.proposerId;
  const target = action === "decline" ? "declined" : "cancelled";

  await db
    .update(trades)
    .set({ status: target, resolvedAt: new Date(now) })
    .where(
      and(
        eq(trades.id, tradeId),
        eq(actor, userId),
        eq(trades.status, "pending"),
        gt(trades.expiresAt, new Date(now)),
      ),
    );

  const record = await readTrade(db, tradeId);
  const actorId = action === "decline" ? record?.recipientId : record?.proposerId;
  if (record === null || actorId !== userId) {
    return { kind: "not_found" };
  }
  if (record.status === target) {
    return { kind: "resolved", trade: record };
  }
  if (record.status === "pending" && isExpired(record.expiresAt.getTime(), now)) {
    return { kind: "refused", reason: "trade_expired" };
  }
  return { kind: "refused", reason: "trade_not_pending" };
}

// --- Helpers -----------------------------------------------------------------------------------

/** The rows of several players for some cards, in one query. */
async function readHoldings(
  db: Database,
  wanted: readonly { readonly userId: string; readonly cardIds: readonly string[] }[],
): Promise<Map<string, Map<string, Holding>>> {
  const filters = wanted
    .filter(({ cardIds }) => cardIds.length > 0)
    .map(({ userId, cardIds }) =>
      and(eq(userCards.userId, userId), inArray(userCards.cardId, [...cardIds])),
    );
  // Without any filter the query would read whole collections.
  if (filters.length === 0) return new Map();
  const rows = await db
    .select(holdingFields)
    .from(userCards)
    .innerJoin(cards, eq(cards.id, userCards.cardId))
    .where(and(eq(userCards.variant, TRADED_VARIANT), or(...filters)));
  return groupHoldings(rows);
}

function groupHoldings(
  rows: readonly (Parameters<typeof toHolding>[0] & { userId: string })[],
): Map<string, Map<string, Holding>> {
  const byPlayer = new Map<string, Map<string, Holding>>();
  for (const row of rows) {
    const holdings = byPlayer.get(row.userId) ?? new Map<string, Holding>();
    holdings.set(row.cardId, toHolding(row));
    byPlayer.set(row.userId, holdings);
  }
  return byPlayer;
}

function sortIds(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
