import {
  type AdminFeedbackResponse,
  type AdminInvite,
  type AdminInvitesResponse,
  type AdminMeasures,
  type AdminTestersResponse,
  adminCreateInviteRequestSchema,
  adminFeedbackQuerySchema,
  adminTestersQuerySchema,
} from "@leximon/contract";
import { Hono } from "hono";
import { z } from "zod";
import { createInvite, listInvites, revokeInvite } from "../beta/invites";
import type { AppEnv } from "../context";
import { listFeedback, listTesters, markFeedbackRead, readMeasures } from "./measures";

const idSchema = z.uuid();

/** Invitations, measures and testers' notes, under `/admin` (admins only, checked there). */
export function adminBetaRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/invites", async (c) =>
    c.json<AdminInvitesResponse>({ invites: await listInvites(c.var.db) }),
  );

  routes.post("/invites", async (c) => {
    const body = adminCreateInviteRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await createInvite(c.var.db, c.var.userId, body.data);
    if (result.kind === "code_taken") return c.json({ error: "code_taken" }, 409);
    return c.json<AdminInvite>(result.invite, 201);
  });

  routes.post("/invites/:id/revoke", async (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "invite_not_found" }, 404);
    const invite = await revokeInvite(c.var.db, c.var.userId, id.data, Date.now());
    if (invite === null) return c.json({ error: "invite_not_found" }, 404);
    return c.json<AdminInvite>(invite);
  });

  routes.get("/measures", async (c) =>
    c.json<AdminMeasures>(await readMeasures(c.var.db, Date.now())),
  );

  routes.get("/testers", async (c) => {
    const query = adminTestersQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    return c.json<AdminTestersResponse>(await listTesters(c.var.db, query.data.cursor));
  });

  routes.get("/feedback", async (c) => {
    const query = adminFeedbackQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    return c.json<AdminFeedbackResponse>(await listFeedback(c.var.db, query.data.cursor));
  });

  routes.post("/feedback/:id/read", async (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "feedback_not_found" }, 404);
    const found = await markFeedbackRead(c.var.db, id.data, Date.now());
    return found ? c.json({ ok: true }) : c.json({ error: "feedback_not_found" }, 404);
  });

  return routes;
}
