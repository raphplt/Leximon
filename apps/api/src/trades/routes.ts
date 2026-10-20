import {
  createTradeRequestSchema,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  playerCodeSchema,
  type TradeableCardsResponse,
  type TradesResponse,
  tradesQuerySchema,
} from "@leximon/contract";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { decodeTradeCursor, encodeTradeCursor } from "./cursor";
import { findPlayerByCode, listTradeableCards } from "./players";
import {
  acceptTrade,
  createTrade,
  listTrades,
  type ResolveAction,
  resolveTrade,
  toTradeResponse,
} from "./trades";

const tradeIdSchema = z.uuid();

/** Trade state changes with every action of either player: never cached. */
const noStore = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

/** Trade offers (D-026). */
export function tradeRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser, playerRateLimit, noStore);

  routes.post("/", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) {
      return c.json({ error: "invalid_idempotency_key" }, 400);
    }
    const body = createTradeRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }

    const now = Date.now();
    const result = await createTrade(c.var.db, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      recipientCode: body.data.recipientCode,
      give: body.data.give,
      want: body.data.want,
      now,
    });
    switch (result.kind) {
      case "created":
        return c.json(toTradeResponse(result.trade, now), 201);
      case "player_not_found":
        return c.json({ error: "player_not_found" }, 404);
      case "refused":
        return c.json({ error: result.reason }, 422);
    }
  });

  routes.get("/", async (c) => {
    const query = tradesQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const { box, limit } = query.data;
    const after = query.data.cursor === undefined ? null : decodeTradeCursor(query.data.cursor);
    if (after === undefined) {
      return c.json({ error: "invalid_cursor" }, 400);
    }

    const now = Date.now();
    const rows = await listTrades(c.var.db, { userId: c.var.userId, box, after, limit });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return c.json<TradesResponse>({
      trades: page.map((row) => toTradeResponse(row, now)),
      nextCursor:
        rows.length > limit && last !== undefined
          ? encodeTradeCursor({ createdAt: last.createdAt.getTime(), id: last.id })
          : null,
    });
  });

  routes.post("/:id/accept", async (c) => {
    const tradeId = tradeIdSchema.safeParse(c.req.param("id"));
    if (!tradeId.success) {
      return c.json({ error: "trade_not_found" }, 404);
    }
    const now = Date.now();
    const result = await acceptTrade(c.var.db, {
      userId: c.var.userId,
      tradeId: tradeId.data,
      now,
    });
    switch (result.kind) {
      case "completed":
        return c.json(toTradeResponse(result.trade, now));
      case "not_found":
        return c.json({ error: "trade_not_found" }, 404);
      case "refused":
        return c.json({ error: result.reason }, 409);
    }
  });

  for (const action of ["decline", "cancel"] as const satisfies readonly ResolveAction[]) {
    routes.post(`/:id/${action}`, async (c) => {
      const tradeId = tradeIdSchema.safeParse(c.req.param("id"));
      if (!tradeId.success) {
        return c.json({ error: "trade_not_found" }, 404);
      }
      const now = Date.now();
      const result = await resolveTrade(c.var.db, {
        userId: c.var.userId,
        tradeId: tradeId.data,
        action,
        now,
      });
      switch (result.kind) {
        case "resolved":
          return c.json(toTradeResponse(result.trade, now));
        case "not_found":
          return c.json({ error: "trade_not_found" }, 404);
        case "refused":
          return c.json({ error: result.reason }, 409);
      }
    });
  }

  return routes;
}

/** Public player lookups by code (D-026): what another player can offer. */
export function playerRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser, playerRateLimit, noStore);

  routes.get("/:code/tradeable", async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const player = await findPlayerByCode(c.var.db, code.data);
    if (player === null) {
      return c.json({ error: "player_not_found" }, 404);
    }
    return c.json<TradeableCardsResponse>({
      playerCode: player.code,
      cardIds: await listTradeableCards(c.var.db, player.userId, Date.now()),
    });
  });

  return routes;
}
