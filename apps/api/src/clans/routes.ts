import {
  type ClaimGoalResponse,
  type ClanJoinResult,
  type ClanMembersResponse,
  type ClanMessage,
  type ClanMessagesResponse,
  type ClanRefusal,
  type ClanRequestsResponse,
  type ClansResponse,
  type ClanView,
  claimGoalRequestSchema,
  clanMessagesQuerySchema,
  clansQuerySchema,
  createClanRequestSchema,
  joinByCodeRequestSchema,
  type MyClanResponse,
  muteRequestSchema,
  playerCodeSchema,
  postClanMessageRequestSchema,
  setRoleRequestSchema,
  updateClanRequestSchema,
} from "@leximon/contract";
import { type Context, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { readRestrictions, refuseLockedWrites } from "../moderation/restrictions";
import {
  acceptRequest,
  createClan,
  declineRequest,
  findClanByCode,
  handOver,
  joinClan,
  kickMember,
  leaveClan,
  listClans,
  listRequests,
  muteMember,
  readClanView,
  readMembers,
  readMyClan,
  refusalStatus,
  renewInviteCode,
  setMemberRole,
  touchLastSeen,
  updateClan,
  withdrawRequest,
} from "./clans";
import {
  decodeClanCursor,
  decodeMemberCursor,
  encodeClanCursor,
  encodeMemberCursor,
} from "./cursor";
import { sendGameEvents } from "./events";
import { claimGoal } from "./goal";
import {
  deleteMessage,
  listMessages,
  postMessage,
  reportClanName,
  reportMessage,
} from "./messages";

const clanIdSchema = z.uuid();
const messageIdSchema = z.coerce.number().int().positive().max(2_147_483_647);
const MEMBERS_PAGE = 50;

/** Clan state changes with every member's action: never cached. */
const noStore = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

/** Members show as online while they use the game (K-05). */
const seen = createMiddleware<AppEnv>(async (c, next) => {
  await touchLastSeen(c.var.db, c.var.userId, Date.now());
  return next();
});

function refused(c: Context<AppEnv>, reason: ClanRefusal, extra: object = {}) {
  return c.json({ error: reason, ...extra }, refusalStatus(reason));
}

async function readBody(c: Context<AppEnv>): Promise<unknown> {
  return c.req.json().catch(() => null);
}

async function canWrite(c: Context<AppEnv>, now: number): Promise<boolean> {
  return (await readRestrictions(c.var.db, c.var.userId, now)).canWrite;
}

/** `/clans` (K-01 to K-13). */
export function clanRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser, playerRateLimit, noStore, refuseLockedWrites, seen);

  routes.get("/", async (c) => {
    const query = clansQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    const after = query.data.cursor === undefined ? null : decodeClanCursor(query.data.cursor);
    if (after === undefined) return c.json({ error: "invalid_cursor" }, 400);
    const page = await listClans(c.var.db, {
      q: query.data.q,
      entry: query.data.entry,
      after,
      limit: query.data.limit,
    });
    return c.json<ClansResponse>({
      clans: page.clans,
      nextCursor: page.last === null ? null : encodeClanCursor(page.last),
    });
  });

  routes.post("/", async (c) => {
    const body = createClanRequestSchema.safeParse(await readBody(c));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const result = await createClan(c.var.db, {
      userId: c.var.userId,
      request: body.data,
      canWrite: await canWrite(c, now),
      now,
    });
    if (result.kind === "refused") return refused(c, result.reason);
    sendGameEvents(c, [{ type: "clan_changed", clanId: result.clanId }]);
    return c.json<ClanJoinResult>({ outcome: "joined", clanId: result.clanId }, 201);
  });

  routes.post("/join", async (c) => {
    const body = joinByCodeRequestSchema.safeParse(await readBody(c));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const clanId = await findClanByCode(c.var.db, body.data.code);
    if (clanId === null) return refused(c, "clan_not_found");
    return join(c, clanId, true);
  });

  routes.get("/:id", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const view = await readClanView(c.var.db, {
      viewerId: c.var.userId,
      clanId: clanId.data,
      now: Date.now(),
    });
    if (view === null) return refused(c, "clan_not_found");
    return c.json<ClanView>(view);
  });

  routes.patch("/:id", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const body = updateClanRequestSchema.safeParse(await readBody(c));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const result = await updateClan(c.var.db, {
      actorId: c.var.userId,
      clanId: clanId.data,
      changes: body.data,
      canWrite: await canWrite(c, now),
      now,
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  routes.get("/:id/members", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const cursor = c.req.query("cursor");
    const after = cursor === undefined ? null : decodeMemberCursor(cursor);
    if (after === undefined) return c.json({ error: "invalid_cursor" }, 400);
    const page = await readMembers(c.var.db, {
      clanId: clanId.data,
      after,
      limit: MEMBERS_PAGE,
      now: Date.now(),
    });
    return c.json<ClanMembersResponse>({
      members: page.members,
      nextCursor: page.last === null ? null : encodeMemberCursor(page.last),
    });
  });

  routes.post("/:id/join", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    return join(c, clanId.data, false);
  });

  routes.delete("/:id/join", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    await withdrawRequest(c.var.db, { userId: c.var.userId, clanId: clanId.data });
    return c.body(null, 204);
  });

  routes.post("/:id/invite-code", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const result = await renewInviteCode(c.var.db, { actorId: c.var.userId, clanId: clanId.data });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.json({ inviteCode: result.code });
  });

  routes.post("/:id/report", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const result = await reportClanName(c.var.db, {
      userId: c.var.userId,
      clanId: clanId.data,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  // --- Requests, chief and deputies (K-10) ---

  routes.get("/:id/requests", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const result = await listRequests(c.var.db, {
      actorId: c.var.userId,
      clanId: clanId.data,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.json<ClanRequestsResponse>({ requests: result.requests });
  });

  for (const decision of ["accept", "decline"] as const) {
    routes.post(`/:id/requests/:code/${decision}`, async (c) => {
      const target = memberTarget(c);
      if (target === null) return refused(c, "player_not_found");
      const now = Date.now();
      const input = { actorId: c.var.userId, ...target, now };
      const result =
        decision === "accept"
          ? await acceptRequest(c.var.db, input)
          : await declineRequest(c.var.db, input);
      if (result.kind === "refused") return refused(c, result.reason);
      if (decision === "accept")
        sendGameEvents(c, [{ type: "clan_changed", clanId: target.clanId }]);
      return c.body(null, 204);
    });
  }

  routes.post("/:id/members/:code/kick", async (c) => {
    const target = memberTarget(c);
    if (target === null) return refused(c, "player_not_found");
    const result = await kickMember(c.var.db, {
      actorId: c.var.userId,
      ...target,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    sendGameEvents(c, [{ type: "clan_changed", clanId: target.clanId }]);
    return c.body(null, 204);
  });

  routes.put("/:id/members/:code/role", async (c) => {
    const target = memberTarget(c);
    if (target === null) return refused(c, "player_not_found");
    const body = setRoleRequestSchema.safeParse(await readBody(c));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await setMemberRole(c.var.db, {
      actorId: c.var.userId,
      ...target,
      role: body.data.role,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  routes.post("/:id/members/:code/hand-over", async (c) => {
    const target = memberTarget(c);
    if (target === null) return refused(c, "player_not_found");
    const result = await handOver(c.var.db, { actorId: c.var.userId, ...target, now: Date.now() });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  routes.put("/:id/members/:code/mute", async (c) => {
    const target = memberTarget(c);
    if (target === null) return refused(c, "player_not_found");
    const body = muteRequestSchema.safeParse(await readBody(c));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await muteMember(c.var.db, {
      actorId: c.var.userId,
      ...target,
      durationMs: body.data.durationMs,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  routes.delete("/:id/members/:code/mute", async (c) => {
    const target = memberTarget(c);
    if (target === null) return refused(c, "player_not_found");
    const result = await muteMember(c.var.db, {
      actorId: c.var.userId,
      ...target,
      durationMs: null,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  // --- Discussion (K-06, K-07) ---

  routes.get("/:id/messages", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const query = clanMessagesQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    const result = await listMessages(c.var.db, {
      viewerId: c.var.userId,
      clanId: clanId.data,
      after: query.data.after,
      before: query.data.before,
      limit: query.data.limit,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.json<ClanMessagesResponse>({ messages: result.messages, hasMore: result.hasMore });
  });

  routes.post("/:id/messages", async (c) => {
    const clanId = clanIdSchema.safeParse(c.req.param("id"));
    if (!clanId.success) return refused(c, "clan_not_found");
    const body = postClanMessageRequestSchema.safeParse(await readBody(c));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const result = await postMessage(c.var.db, {
      userId: c.var.userId,
      clanId: clanId.data,
      body: body.data.body,
      canWrite: await canWrite(c, now),
      now,
    });
    if (result.kind === "refused") {
      return refused(
        c,
        result.reason,
        result.retryAt === undefined ? {} : { retryAt: result.retryAt },
      );
    }
    return c.json<ClanMessage>(result.message, 201);
  });

  routes.delete("/:id/messages/:messageId", async (c) => {
    const target = messageTarget(c);
    if (target === null) return refused(c, "player_not_found");
    const result = await deleteMessage(c.var.db, {
      userId: c.var.userId,
      ...target,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  routes.post("/:id/messages/:messageId/report", async (c) => {
    const target = messageTarget(c);
    if (target === null) return refused(c, "player_not_found");
    const result = await reportMessage(c.var.db, {
      userId: c.var.userId,
      ...target,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.body(null, 204);
  });

  return routes;
}

async function join(c: Context<AppEnv>, clanId: string, byCode: boolean) {
  const result = await joinClan(c.var.db, {
    userId: c.var.userId,
    clanId,
    byCode,
    now: Date.now(),
  });
  if (result.kind === "refused") return refused(c, result.reason);
  if (result.outcome === "joined") sendGameEvents(c, [{ type: "clan_changed", clanId }]);
  return c.json<ClanJoinResult>({ outcome: result.outcome, clanId: result.clanId });
}

function memberTarget(c: Context<AppEnv>): { clanId: string; targetCode: string } | null {
  const clanId = clanIdSchema.safeParse(c.req.param("id"));
  const code = playerCodeSchema.safeParse(c.req.param("code"));
  return clanId.success && code.success ? { clanId: clanId.data, targetCode: code.data } : null;
}

function messageTarget(c: Context<AppEnv>): { clanId: string; messageId: number } | null {
  const clanId = clanIdSchema.safeParse(c.req.param("id"));
  const messageId = messageIdSchema.safeParse(c.req.param("messageId"));
  return clanId.success && messageId.success
    ? { clanId: clanId.data, messageId: messageId.data }
    : null;
}

/** `/me/clan`: the player's own standing, leaving, and the weekly goal's boosters. */
export function myClanRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(refuseLockedWrites);

  routes.get("/", async (c) => {
    const now = Date.now();
    await touchLastSeen(c.var.db, c.var.userId, now);
    return c.json<MyClanResponse>(await readMyClan(c.var.db, c.var.userId, now));
  });

  routes.post("/leave", async (c) => {
    const result = await leaveClan(c.var.db, { userId: c.var.userId, now: Date.now() });
    if (result.kind === "refused") return refused(c, result.reason);
    if (!result.dissolved) sendGameEvents(c, [{ type: "clan_changed", clanId: result.clanId }]);
    return c.body(null, 204);
  });

  routes.post("/claims", async (c) => {
    const body = claimGoalRequestSchema.safeParse(await readBody(c));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await claimGoal(c.var.db, {
      userId: c.var.userId,
      week: body.data.week,
      tier: body.data.tier,
      now: Date.now(),
    });
    if (result.kind === "refused") return refused(c, result.reason);
    return c.json<ClaimGoalResponse>({
      week: result.week,
      tier: result.tier,
      boosters: result.boosters,
      wallet: result.wallet,
    });
  });

  return routes;
}
