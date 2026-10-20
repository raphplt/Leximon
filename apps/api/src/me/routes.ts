import {
  type AccountResponse,
  type BoosterWalletResponse,
  type MasteryResponse,
  type OwnedCardsResponse,
  ownedCardsQuerySchema,
  type ProfileResponse,
  type ProgressResponse,
  type TradeableCardsResponse,
} from "@leximon/contract";
import {
  computeRefill,
  createFullWallet,
  GUEST_SCHEDULE,
  guestBoostersLeft,
  guestRulesAt,
  levelOf,
  REFILL_SCHEDULE,
  TRADE_SCHEDULE,
  tradeRulesAt,
} from "@leximon/core";
import { schema } from "@leximon/db";
import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { guestOpensSql } from "../boosters/open-booster";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { readXp } from "../progress/progress";
import { ensurePlayer, listTradeableCards } from "../trades/players";

const { boosterWallets, cards, userCards, userMastery } = schema;

/** Player state for the current session. Never cached: it changes with every action. */
export function meRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser);
  routes.use(playerRateLimit);
  routes.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  routes.get("/wallet", async (c) => {
    const now = Date.now();
    const [row] = await c.var.db
      .select()
      .from(boosterWallets)
      .where(eq(boosterWallets.userId, c.var.userId));
    // A player who never opened a booster has no row yet: their stock is full.
    const wallet =
      row === undefined
        ? createFullWallet(REFILL_SCHEDULE, now)
        : { stored: row.stored, progressMs: row.progressMs, asOf: row.asOf.getTime() };
    const state = computeRefill(wallet, REFILL_SCHEDULE, now);
    return c.json<BoosterWalletResponse>({
      stored: state.stored,
      nextRefillAt: state.nextRefillAt === null ? null : new Date(state.nextRefillAt).toISOString(),
      bonus: row?.bonusBoosters ?? 0,
    });
  });

  routes.get("/cards", async (c) => {
    const query = ownedCardsQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const { collectionId, limit } = query.data;
    const after = query.data.cursor === undefined ? null : decodeCursor(query.data.cursor);
    if (after === undefined) {
      return c.json({ error: "invalid_cursor" }, 400);
    }

    const rows = await c.var.db
      .select({
        cardId: userCards.cardId,
        variant: userCards.variant,
        quantity: userCards.quantity,
        firstObtainedAt: userCards.firstObtainedAt,
      })
      .from(userCards)
      .innerJoin(cards, eq(cards.id, userCards.cardId))
      .where(
        and(
          eq(userCards.userId, c.var.userId),
          gt(userCards.quantity, 0),
          collectionId === undefined ? undefined : eq(cards.collectionId, collectionId),
          after === null
            ? undefined
            : or(
                gt(userCards.cardId, after.cardId),
                and(eq(userCards.cardId, after.cardId), gt(userCards.variant, after.variant)),
              ),
        ),
      )
      .orderBy(asc(userCards.cardId), asc(userCards.variant))
      // One extra row tells whether another page exists.
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return c.json<OwnedCardsResponse>({
      cards: page.map((row) => ({ ...row, firstObtainedAt: row.firstObtainedAt.toISOString() })),
      nextCursor:
        rows.length > limit && last !== undefined
          ? encodeCursor({ cardId: last.cardId, variant: last.variant })
          : null,
    });
  });

  // The player code is created on first request: guests who never trade never get one.
  routes.get("/profile", async (c) => {
    const now = Date.now();
    const player = await ensurePlayer(c.var.db, c.var.userId);
    const { minAccountAgeMs, minLevel } = tradeRulesAt(TRADE_SCHEDULE, now);
    return c.json<ProfileResponse>({
      playerCode: player.code,
      canTradeFrom: new Date(player.createdAt + minAccountAgeMs).toISOString(),
      tradeMinLevel: minLevel,
    });
  });

  /** Account level (P48). Read only: a player who never earned XP is at level 1. */
  routes.get("/progress", async (c) => {
    const xp = await readXp(c.var.db, c.var.userId);
    return c.json<ProgressResponse>({ xp, ...levelOf(xp) });
  });

  routes.get("/tradeable", async (c) => {
    const now = Date.now();
    const player = await ensurePlayer(c.var.db, c.var.userId);
    return c.json<TradeableCardsResponse>({
      playerCode: player.code,
      cardIds: await listTradeableCards(c.var.db, player.userId, now),
    });
  });

  /** Who is playing: a guest (and how many boosters it may still open), or a member. */
  routes.get("/account", async (c) => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
    if (session === null) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (session.user.isAnonymous !== true) {
      return c.json<AccountResponse>({ kind: "member", email: session.user.email });
    }
    const rules = guestRulesAt(GUEST_SCHEDULE, Date.now());
    const counted = await c.var.db.execute<{ opened: number | null }>(
      sql`select ${guestOpensSql(session.user.id, rules.boostersBeforeSignup)} as opened`,
    );
    return c.json<AccountResponse>({
      kind: "guest",
      boostersLeft: guestBoostersLeft(rules, counted.rows[0]?.opened ?? 0),
    });
  });

  /** The level of every word reviewed at least once (D-025). */
  routes.get("/mastery", async (c) => {
    const rows = await c.var.db
      .select({ cardId: userMastery.cardId, level: userMastery.level })
      .from(userMastery)
      .where(eq(userMastery.userId, c.var.userId))
      .orderBy(asc(userMastery.cardId));
    return c.json<MasteryResponse>({ words: rows });
  });

  return routes;
}

interface CardCursor {
  readonly cardId: string;
  readonly variant: string;
}

function encodeCursor(cursor: CardCursor): string {
  return btoa(JSON.stringify([cursor.cardId, cursor.variant]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** `undefined` when the cursor is malformed. */
function decodeCursor(value: string): CardCursor | undefined {
  try {
    const json = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const parsed: unknown = JSON.parse(json);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return { cardId: parsed[0], variant: parsed[1] };
    }
  } catch {
    // Falls through to the malformed result.
  }
  return undefined;
}
