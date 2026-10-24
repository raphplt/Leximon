import {
  type AcceptFriendResponse,
  type ClaimReferralResponse,
  type FeedResponse,
  type FriendCardsResponse,
  type FriendRefusal,
  type FriendsResponse,
  feedQuerySchema,
  type PodiumResponse,
  playerCodeSchema,
  type ReferrerResponse,
  reactRequestSchema,
  type SendFriendRequestResponse,
  sendFriendRequestSchema,
} from "@leximon/contract";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { invitesRequired } from "../beta/invites";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { refuseLockedWrites } from "../moderation/restrictions";
import { react, readFeed, unreact } from "./feed";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  listFriends,
  removeFriend,
  sendFriendRequest,
} from "./friends";
import { readPodium } from "./podium";
import { claimReferral, readReferrer } from "./referrals";
import { readFriendCards } from "./suggestions";

const eventIdSchema = z.coerce.number().int().positive().max(2_147_483_647);

const REFUSAL_STATUS: Readonly<Record<FriendRefusal, 403 | 404 | 422>> = {
  account_required: 403,
  pseudo_required: 403,
  player_not_found: 404,
  request_not_found: 404,
  self: 422,
  already_friends: 422,
  already_requested: 422,
  requests_closed: 422,
  recently_declined: 422,
  daily_limit_reached: 422,
  too_many_pending: 422,
  friend_limit_reached: 422,
  their_friend_limit_reached: 422,
};

function refusal(c: Context<AppEnv>, reason: FriendRefusal) {
  return c.json({ error: reason }, REFUSAL_STATUS[reason]);
}

/** Friends, requests, the podium, the feed and friend link rewards, under `/me`. */
export function friendRoutes() {
  // Mounted on `/` of `/me`: a middleware here would run for every route of `/me`.
  const routes = new Hono<AppEnv>();

  routes.get("/friends", async (c) => {
    const result = await listFriends(c.var.db, {
      userId: c.var.userId,
      betaRequired: invitesRequired(c.env),
      now: Date.now(),
    });
    if ("kind" in result) return refusal(c, result.reason);
    return c.json<FriendsResponse>(result);
  });

  routes.get("/friends/podium", async (c) => {
    return c.json<PodiumResponse>(await readPodium(c.var.db, c.var.userId, Date.now()));
  });

  routes.get("/friends/feed", async (c) => {
    const query = feedQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    return c.json<FeedResponse>(
      await readFeed(c.var.db, {
        userId: c.var.userId,
        before: query.data.before,
        now: Date.now(),
      }),
    );
  });

  routes.get("/friends/:code/cards", async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) return refusal(c, "player_not_found");
    const result = await readFriendCards(c.var.db, {
      userId: c.var.userId,
      code: code.data,
      now: Date.now(),
    });
    if (result.kind === "not_found") return refusal(c, "player_not_found");
    return c.json<FriendCardsResponse>(result.response);
  });

  routes.delete("/friends/:code", refuseLockedWrites, async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) return refusal(c, "player_not_found");
    const result = await removeFriend(c.var.db, { userId: c.var.userId, code: code.data });
    if (result.kind === "refused") return refusal(c, result.reason);
    return c.body(null, 204);
  });

  routes.post("/friend-requests", refuseLockedWrites, async (c) => {
    const body = sendFriendRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await sendFriendRequest(c.var.db, {
      userId: c.var.userId,
      target: body.data,
      now: Date.now(),
    });
    if (result.kind === "refused") return refusal(c, result.reason);
    sendGameEvents(c, [
      result.kind === "sent"
        ? { type: "friend_request", senderId: c.var.userId, recipientId: result.otherId }
        : { type: "friend_accepted", userId: c.var.userId, friendId: result.otherId },
    ]);
    return c.json<SendFriendRequestResponse>({ outcome: result.kind, player: result.player });
  });

  routes.post("/friend-requests/:code/accept", refuseLockedWrites, async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) return refusal(c, "request_not_found");
    const result = await acceptFriendRequest(c.var.db, {
      userId: c.var.userId,
      code: code.data,
      now: Date.now(),
    });
    if (result.kind === "refused") return refusal(c, result.reason);
    sendGameEvents(c, [
      { type: "friend_accepted", userId: c.var.userId, friendId: result.otherId },
    ]);
    return c.json<AcceptFriendResponse>({ player: result.player });
  });

  routes.post("/friend-requests/:code/decline", refuseLockedWrites, async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) return refusal(c, "request_not_found");
    const result = await declineFriendRequest(c.var.db, {
      userId: c.var.userId,
      code: code.data,
      now: Date.now(),
    });
    if (result.kind === "refused") return refusal(c, result.reason);
    return c.body(null, 204);
  });

  routes.delete("/friend-requests/:code", refuseLockedWrites, async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) return refusal(c, "player_not_found");
    const result = await cancelFriendRequest(c.var.db, {
      userId: c.var.userId,
      code: code.data,
    });
    if (result.kind === "refused") return refusal(c, result.reason);
    return c.body(null, 204);
  });

  routes.put("/friend-reactions/:eventId", refuseLockedWrites, async (c) => {
    const eventId = eventIdSchema.safeParse(c.req.param("eventId"));
    const body = reactRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!eventId.success || !body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await react(c.var.db, {
      userId: c.var.userId,
      eventId: eventId.data,
      reaction: body.data.reaction,
      now: Date.now(),
    });
    if (result.kind === "event_not_found") return c.json({ error: "event_not_found" }, 404);
    if (result.first) sendGameEvents(c, [{ type: "friend_reaction", eventId: eventId.data }]);
    return c.body(null, 204);
  });

  routes.delete("/friend-reactions/:eventId", refuseLockedWrites, async (c) => {
    const eventId = eventIdSchema.safeParse(c.req.param("eventId"));
    if (!eventId.success) return c.json({ error: "invalid_request" }, 400);
    await unreact(c.var.db, { userId: c.var.userId, eventId: eventId.data });
    return c.body(null, 204);
  });

  routes.post("/referrals/:code/claim", refuseLockedWrites, async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) return c.json({ error: "reward_not_found" }, 404);
    const result = await claimReferral(c.var.db, {
      userId: c.var.userId,
      refereeCode: code.data,
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json({ error: result.reason }, result.reason === "reward_not_found" ? 404 : 409);
    }
    return c.json<ClaimReferralResponse>({ wallet: result.wallet });
  });

  return routes;
}

/** `GET /referrers/{code}`: public, for the page of a friend link. Must run after `withDatabase`. */
export function referrerRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/:code", async (c) => {
    c.header("Cache-Control", "no-store");
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) return c.json({ error: "player_not_found" }, 404);
    const referrer = await readReferrer(c.var.db, {
      code: code.data,
      betaRequired: invitesRequired(c.env),
      now: Date.now(),
    });
    if (referrer === null) return c.json({ error: "player_not_found" }, 404);
    return c.json<ReferrerResponse>(referrer);
  });

  return routes;
}
