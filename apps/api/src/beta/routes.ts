import {
  type InviteStatus,
  recordInterestRequestSchema,
  sendFeedbackRequestSchema,
} from "@leximon/contract";
import { schema } from "@leximon/db";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { parseInviteCode, readInviteStatus } from "./invites";

/** `GET /invites/{code}`: public, for the invitation page. Must run after `withDatabase`. */
export function inviteRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/:code", async (c) => {
    const code = parseInviteCode(c.req.param("code"));
    const status = code === null ? "unknown" : await readInviteStatus(c.var.db, code, Date.now());
    c.header("Cache-Control", "no-store");
    return c.json<InviteStatus>({ status });
  });

  return routes;
}

/** Testers' notes and interest in the patron offer, under `/me`. */
export function betaPlayerRoutes() {
  const routes = new Hono<AppEnv>();

  routes.post("/feedback", async (c) => {
    const body = sendFeedbackRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    await c.var.db.insert(schema.playerFeedback).values({
      userId: c.var.userId,
      screen: body.data.screen,
      body: body.data.body,
    });
    return c.body(null, 204);
  });

  routes.post("/interest", async (c) => {
    const body = recordInterestRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    await c.var.db
      .insert(schema.playerInterest)
      .values({ userId: c.var.userId, kind: body.data.kind })
      .onConflictDoNothing();
    return c.body(null, 204);
  });

  return routes;
}
