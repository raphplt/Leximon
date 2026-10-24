import {
  type BlockRefusal,
  createTradeRequestSchema,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type PublicProfile,
  playerCodeSchema,
  type Trade,
  type TradeableCardsResponse,
  type TradesResponse,
  tradesQuerySchema,
} from "@leximon/contract";
import type { Database } from "@leximon/db";
import { type Context, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { readRestrictions, refuseLockedWrites } from "../moderation/restrictions";
import {
  type BlockResult,
  isBlockedEitherWay,
  readPublicProfile,
  reportPlayer,
} from "../profile/profile";
import { decodeTradeCursor, encodeTradeCursor } from "./cursor";
import { ensurePlayer, findPlayerByCode, tradeableResponse } from "./players";
import {
  acceptTrade,
  createTrade,
  listTrades,
  type ResolveAction,
  readTradeBadges,
  resolveTrade,
  type TradeRecord,
  toTradeResponse,
} from "./trades";

const tradeIdSchema = z.uuid();

/** Trade state changes with every action of either player: never cached. */
const noStore = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

async function tradeView(db: Database, record: TradeRecord, now: number): Promise<Trade> {
  return toTradeResponse(record, await readTradeBadges(db, [record], now), now);
}

/** Trade offers. */
export function tradeRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser, playerRateLimit, noStore, refuseLockedWrites);

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
    if (!(await readRestrictions(c.var.db, c.var.userId, now)).canTrade) {
      return c.json({ error: "sanctioned" }, 403);
    }
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
        sendGameEvents(c, [{ type: "trade_changed", tradeId: result.trade.id }]);
        return c.json(await tradeView(c.var.db, result.trade, now), 201);
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
    const badges = await readTradeBadges(c.var.db, page, now);
    const last = page.at(-1);
    return c.json<TradesResponse>({
      trades: page.map((row) => toTradeResponse(row, badges, now)),
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
    if (!(await readRestrictions(c.var.db, c.var.userId, now)).canTrade) {
      return c.json({ error: "sanctioned" }, 403);
    }
    const result = await acceptTrade(c.var.db, {
      userId: c.var.userId,
      tradeId: tradeId.data,
      now,
    });
    switch (result.kind) {
      case "completed":
        sendGameEvents(c, [
          { type: "trade_changed", tradeId: result.trade.id },
          ...[result.trade.proposerId, result.trade.recipientId].flatMap((userId) =>
            userId === null ? [] : [{ type: "cards_obtained" as const, userId }],
          ),
          ...result.levelUps.map((userId) => ({ type: "level_up" as const, userId })),
        ]);
        return c.json(await tradeView(c.var.db, result.trade, now));
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
          sendGameEvents(c, [{ type: "trade_changed", tradeId: result.trade.id }]);
          return c.json(await tradeView(c.var.db, result.trade, now));
        case "not_found":
          return c.json({ error: "trade_not_found" }, 404);
        case "refused":
          return c.json({ error: result.reason }, 409);
      }
    });
  }

  return routes;
}

/**
 * Other players: what one can offer, by code, and public profiles by pseudo.
 */
export function playerRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/:code/tradeable", requireUser, playerRateLimit, noStore, async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const player = await findPlayerByCode(c.var.db, code.data);
    if (player === null || (await isBlockedEitherWay(c.var.db, c.var.userId, player.userId))) {
      return c.json({ error: "player_not_found" }, 404);
    }
    const requester = await ensurePlayer(c.var.db, c.var.userId);
    return c.json<TradeableCardsResponse>(
      await tradeableResponse(c.var.db, player, requester, Date.now()),
    );
  });

  /**
   * Readable without an account: the public page is rendered by the web server and shared. The
   * CDN keeps it a minute; a signed-in viewer is counted on their own limit and never sees a
   * player they blocked or who blocked them, so their answer is not shared.
   */
  routes.get("/:pseudo", async (c) => {
    const pseudo = pseudoParamSchema.safeParse(c.req.param("pseudo"));
    if (!pseudo.success) {
      return c.json({ error: "player_not_found" }, 404);
    }
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
    if (session !== null) {
      c.set("userId", session.user.id);
      const limited = await playerRateLimit(c, async () => {});
      if (limited instanceof Response) return limited;
    }
    const result = await readPublicProfile(c.var.db, {
      pseudo: pseudo.data,
      viewerId: session?.user.id ?? null,
      now: Date.now(),
    });
    c.header("Cache-Control", session === null ? "public, max-age=60" : "private, no-store");
    if (result.kind === "not_found") {
      return c.json({ error: "player_not_found" }, 404);
    }
    return c.json<PublicProfile>(result.profile);
  });

  routes.post(
    "/:pseudo/report",
    requireUser,
    playerRateLimit,
    noStore,
    refuseLockedWrites,
    async (c) => {
      const pseudo = pseudoParamSchema.safeParse(c.req.param("pseudo"));
      if (!pseudo.success) {
        return c.json({ error: "player_not_found" }, 404);
      }
      const result = await reportPlayer(c.var.db, {
        userId: c.var.userId,
        pseudo: pseudo.data,
        now: Date.now(),
      });
      return blockResultResponse(c, result);
    },
  );

  return routes;
}

/** A pseudo in a path: never longer than a pseudo, so nothing heavy reaches the database. */
const pseudoParamSchema = z.string().min(1).max(60);

/** The answer to a block, an unblock or a report: 204, or the refusal. */
export function blockResultResponse(c: Context<AppEnv>, result: BlockResult) {
  switch (result.kind) {
    case "ok":
      return c.body(null, 204);
    case "account_required":
      return c.json<{ error: BlockRefusal }>({ error: result.kind }, 403);
    case "player_not_found":
      return c.json<{ error: BlockRefusal }>({ error: result.kind }, 404);
    case "self":
      return c.json<{ error: BlockRefusal }>({ error: result.kind }, 422);
  }
}
