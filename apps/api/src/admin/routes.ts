import {
  type AdminActionsResponse,
  type AdminCardStats,
  type AdminCatalog,
  type AdminGrantBonusResponse,
  type AdminMe,
  type AdminOverview,
  type AdminPlayerDetail,
  type AdminPlayersResponse,
  type AdminTradesResponse,
  type AdminWaitlistInviteResponse,
  type AdminWaitlistResponse,
  adminBanRequestSchema,
  adminCancelTradeRequestSchema,
  adminGrantBonusRequestSchema,
  adminPlayersQuerySchema,
  adminTradesQuerySchema,
  adminWaitlistInviteRequestSchema,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
} from "@leximon/contract";
import { Hono } from "hono";
import type { CampaignMailerFactory } from "../campaigns/mailer";
import { campaignAdminRoutes, waitlistEraseRoute } from "../campaigns/routes";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireAdmin } from "../middleware/require-admin";
import { adminModerationRoutes } from "../moderation/routes";
import { inviteFromWaitlist } from "../waitlist/invite";
import { banPlayer, cancelTrade, grantBonus, logExport, unbanPlayer } from "./actions";
import { adminBetaRoutes } from "./beta-routes";
import {
  exportWaitlist,
  InvalidCursorError,
  listActions,
  listPlayers,
  listTrades,
  listWaitlist,
  readAdminEmail,
  readCardStats,
  readCatalog,
  readOverview,
  readPlayer,
} from "./queries";

const MAX_ID_LENGTH = 200;

/** Back office (`/admin/*`): admins only, never cached. */
export function adminRoutes(createMailer: CampaignMailerFactory) {
  const routes = new Hono<AppEnv>();
  routes.use(requireAdmin);
  routes.use(playerRateLimit);
  routes.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  routes.onError((error, c) => {
    if (error instanceof InvalidCursorError) return c.json({ error: "invalid_cursor" }, 400);
    throw error;
  });

  routes.route("/", adminModerationRoutes());
  routes.route("/", adminBetaRoutes());

  routes.get("/me", async (c) => {
    const email = await readAdminEmail(c.var.db, c.var.userId);
    return c.json<AdminMe>({ email });
  });

  routes.get("/overview", async (c) =>
    c.json<AdminOverview>(await readOverview(c.var.db, Date.now())),
  );

  routes.get("/players", async (c) => {
    const query = adminPlayersQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    return c.json<AdminPlayersResponse>(await listPlayers(c.var.db, query.data));
  });

  routes.get("/players/:id", async (c) => {
    const id = c.req.param("id");
    if (id.length > MAX_ID_LENGTH) return c.json({ error: "player_not_found" }, 404);
    const detail = await readPlayer(c.var.db, id, Date.now());
    if (detail === null) return c.json({ error: "player_not_found" }, 404);
    return c.json<AdminPlayerDetail>(detail);
  });

  routes.post("/players/:id/bonus", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = adminGrantBonusRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await grantBonus(c.var.db, {
      adminId: c.var.userId,
      userId: c.req.param("id"),
      amount: body.data.amount,
      reason: body.data.reason,
      idempotencyKey: key.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "granted":
        return c.json<AdminGrantBonusResponse>({ added: result.added, bonus: result.bonus });
      case "player_not_found":
        return c.json({ error: "player_not_found" }, 404);
      case "guest_archived":
        return c.json({ error: "guest_archived" }, 409);
    }
  });

  routes.post("/players/:id/ban", async (c) => {
    const body = adminBanRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await banPlayer(c.var.db, {
      adminId: c.var.userId,
      userId: c.req.param("id"),
      reason: body.data.reason,
      days: body.data.days,
      now: Date.now(),
    });
    switch (result.kind) {
      case "done":
        return c.json({ ok: true });
      case "player_not_found":
        return c.json({ error: "player_not_found" }, 404);
      case "cannot_ban_admin":
        return c.json({ error: "cannot_ban_admin" }, 409);
    }
  });

  routes.post("/players/:id/unban", async (c) => {
    const result = await unbanPlayer(c.var.db, {
      adminId: c.var.userId,
      userId: c.req.param("id"),
      now: Date.now(),
    });
    return result.kind === "done"
      ? c.json({ ok: true })
      : c.json({ error: "player_not_found" }, 404);
  });

  routes.get("/waitlist", async (c) =>
    c.json<AdminWaitlistResponse>(await listWaitlist(c.var.db, c.req.query("cursor"))),
  );

  routes.get("/waitlist/export", async (c) => {
    const csv = await exportWaitlist(c.var.db);
    await logExport(c.var.db, c.var.userId, Date.now());
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", 'attachment; filename="liste-attente.csv"');
    return c.body(csv);
  });

  routes.post("/waitlist/invite", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = adminWaitlistInviteRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await inviteFromWaitlist(c.var.db, {
      adminId: c.var.userId,
      request: body.data,
      webUrl: c.env.PUBLIC_WEB_URL,
      idempotencyKey: key.data,
      now: Date.now(),
    });
    if (result.kind === "nobody_to_invite") return c.json({ error: "nobody_to_invite" }, 409);
    const { kind: _, ...invited } = result;
    return c.json<AdminWaitlistInviteResponse>(invited);
  });

  routes.route("/waitlist/erase", waitlistEraseRoute());
  routes.route("/campaigns", campaignAdminRoutes(createMailer));

  routes.get("/trades", async (c) => {
    const query = adminTradesQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    return c.json<AdminTradesResponse>(await listTrades(c.var.db, query.data));
  });

  routes.post("/trades/:id/cancel", async (c) => {
    const id = c.req.param("id");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: "trade_not_found" }, 404);
    const body = adminCancelTradeRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await cancelTrade(c.var.db, {
      adminId: c.var.userId,
      tradeId: id,
      reason: body.data.reason,
      now: Date.now(),
    });
    switch (result.kind) {
      case "cancelled":
        return c.json({ ok: true });
      case "trade_not_found":
        return c.json({ error: "trade_not_found" }, 404);
      case "trade_not_pending":
        return c.json({ error: "trade_not_pending" }, 409);
    }
  });

  routes.get("/catalog", async (c) => c.json<AdminCatalog>(await readCatalog(c.var.db)));

  routes.get("/cards/:id", async (c) => {
    const id = c.req.param("id");
    if (id.length > MAX_ID_LENGTH) return c.json({ error: "card_not_found" }, 404);
    const stats = await readCardStats(c.var.db, id);
    if (stats === null) return c.json({ error: "card_not_found" }, 404);
    return c.json<AdminCardStats>(stats);
  });

  routes.get("/actions", async (c) =>
    c.json<AdminActionsResponse>(await listActions(c.var.db, c.req.query("cursor"))),
  );

  return routes;
}
