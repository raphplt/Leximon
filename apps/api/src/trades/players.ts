import {
  type EpochMs,
  type Holding,
  isTradeable,
  TRADE_SCHEDULE,
  tradeRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, eq, gte } from "drizzle-orm";
import { generatePlayerCode } from "./player-code";

const { cards, players, userCards, userProgress, users } = schema;

/** Only the standard variant is traded until variants exist (trade items carry no variant). */
export const TRADED_VARIANT = "standard";

export interface Player {
  readonly userId: string;
  readonly code: string;
  /** Creation of the account, which gates trading (D-026). */
  readonly createdAt: EpochMs;
  /** Experience, whose level gates trading too (P48). */
  readonly xp: number;
}

/** A free code is found on the first draw in practice: 40 bits for at most millions of players. */
const MAX_CODE_DRAWS = 5;

/**
 * The player's public identity, created on first use. Concurrent first requests are safe: the
 * insert does nothing on conflict (same player or same code) and the row is read back.
 */
export async function ensurePlayer(db: Database, userId: string): Promise<Player> {
  const existing = await readPlayer(db, userId);
  if (existing !== null) return existing;

  for (let draw = 0; draw < MAX_CODE_DRAWS; draw++) {
    await db.insert(players).values({ userId, code: generatePlayerCode() }).onConflictDoNothing();
    const player = await readPlayer(db, userId);
    if (player !== null) return player;
    // Nothing inserted and no row for this player: the code belongs to someone else.
  }
  throw new Error(`No free player code after ${MAX_CODE_DRAWS} draws`);
}

export async function findPlayerByCode(db: Database, code: string): Promise<Player | null> {
  const [row] = await playerQuery(db).where(eq(players.code, code));
  return row === undefined ? null : toPlayer(row);
}

async function readPlayer(db: Database, userId: string): Promise<Player | null> {
  const [row] = await playerQuery(db).where(eq(players.userId, userId));
  return row === undefined ? null : toPlayer(row);
}

function playerQuery(db: Database) {
  return db
    .select({
      userId: players.userId,
      code: players.code,
      createdAt: users.createdAt,
      xp: userProgress.xp,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .leftJoin(userProgress, eq(userProgress.userId, players.userId));
}

function toPlayer(row: {
  userId: string;
  code: string;
  createdAt: Date;
  xp: number | null;
}): Player {
  return {
    userId: row.userId,
    code: row.code,
    createdAt: row.createdAt.getTime(),
    xp: row.xp ?? 0,
  };
}

/** Cards this player can give now, sorted by id. Bounded by the catalog size: no pagination. */
export async function listTradeableCards(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<string[]> {
  const rules = tradeRulesAt(TRADE_SCHEDULE, now);
  const rows = await db
    .select(holdingFields)
    .from(userCards)
    .innerJoin(cards, eq(cards.id, userCards.cardId))
    .where(
      and(
        eq(userCards.userId, userId),
        eq(userCards.variant, TRADED_VARIANT),
        // Only duplicates can ever be traded: skips most of the collection in the database.
        gte(userCards.quantity, 2),
      ),
    )
    .orderBy(asc(userCards.cardId));
  return rows
    .map(toHolding)
    .filter((holding) => isTradeable(rules, holding, now))
    .map((holding) => holding.cardId);
}

/** Columns needed to build a `Holding`, from `user_cards` joined with `cards`. */
export const holdingFields = {
  userId: userCards.userId,
  cardId: userCards.cardId,
  rarity: cards.rarity,
  quantity: userCards.quantity,
  lastObtainedAt: userCards.lastObtainedAt,
};

export function toHolding(row: {
  cardId: string;
  rarity: Holding["rarity"];
  quantity: number;
  lastObtainedAt: Date;
}): Holding {
  return {
    cardId: row.cardId,
    rarity: row.rarity,
    quantity: row.quantity,
    lastObtainedAt: row.lastObtainedAt.getTime(),
  };
}
