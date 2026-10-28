import {
  type AdminEmailsResponse,
  type AdminFeedbackResponse,
  type AdminInvite,
  type AdminInvitesResponse,
  type AdminMeasures,
  type AdminTestersResponse,
  adminCreateInviteRequestSchema,
  adminEmailsQuerySchema,
  adminFeedbackQuerySchema,
  adminMeasuresQuerySchema,
  adminSetInvitePlacesRequestSchema,
  adminTestersQuerySchema,
} from "@leximon/contract";
import { Hono } from "hono";
import { z } from "zod";
import { createInvite, listInvites, revokeInvite, setInvitePlaces } from "../beta/invites";
import type { AppEnv } from "../context";
import { readEmails } from "./emails";
import { listFeedback, listTesters, markFeedbackRead, readMeasures } from "./measures";

const idSchema = z.uuid();

/** Invitations, measures, e-mails and testers' notes, under `/admin` (admins only, checked there). */
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

  routes.post("/invites/:id/places", async (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "invite_not_found" }, 404);
    const body = adminSetInvitePlacesRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await setInvitePlaces(c.var.db, c.var.userId, id.data, body.data);
    if (result.kind === "not_found") return c.json({ error: "invite_not_found" }, 404);
    if (result.kind === "below_uses") return c.json({ error: "below_uses" }, 409);
    return c.json<AdminInvite>(result.invite);
  });

  routes.get("/measures", async (c) => {
    const query = adminMeasuresQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    const measures = await readMeasures(c.var.db, Date.now(), query.data);
    if (measures === null) return c.json({ error: "invalid_request" }, 400);
    return c.json<AdminMeasures>(measures);
  });

  routes.get("/emails", async (c) => {
    const query = adminEmailsQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    const dailyLimit = Number.parseInt(c.env.NOTIFY_DAILY_LIMIT, 10);
    const emails = await readEmails(
      c.var.db,
      Date.now(),
      query.data,
      Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : 0,
    );
    if (emails === null) return c.json({ error: "invalid_request" }, 400);
    return c.json<AdminEmailsResponse>(emails);
  });

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
