import {
  type AdminContestsResponse,
  type AdminReportsResponse,
  contestRequestSchema,
  createSanctionRequestSchema,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  resolveContestRequestSchema,
  type Sanction,
  type SanctionsResponse,
} from "@leximon/contract";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import {
  contestSanction,
  createSanction,
  dismissReport,
  listOpenContests,
  listOpenReports,
  listSanctions,
  markSanctionsSeen,
  resolveContest,
} from "./sanctions";

const idSchema = z.uuid();

/** `/me/sanctions`: open to a suspended or closed account, which must read and contest. */
export function sanctionRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (c) =>
    c.json<SanctionsResponse>({
      sanctions: await listSanctions(c.var.db, c.var.userId, Date.now()),
    }),
  );

  routes.post("/seen", async (c) => {
    await markSanctionsSeen(c.var.db, c.var.userId, Date.now());
    return c.body(null, 204);
  });

  routes.post("/:id/contest", async (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "sanction_not_found" }, 404);
    const body = contestRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await contestSanction(c.var.db, {
      userId: c.var.userId,
      sanctionId: id.data,
      text: body.data.text,
      now: Date.now(),
    });
    switch (result.kind) {
      case "contested":
        return c.body(null, 204);
      case "sanction_not_found":
        return c.json({ error: result.kind }, 404);
      case "not_contestable":
        return c.json({ error: result.kind }, 409);
    }
  });

  return routes;
}

/** Reports, sanctions and contests in the back office. Mounted under `/admin`. */
export function adminModerationRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/reports", async (c) =>
    c.json<AdminReportsResponse>({ reports: await listOpenReports(c.var.db, Date.now()) }),
  );

  routes.post("/reports/:id/dismiss", async (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "report_not_found" }, 404);
    const result = await dismissReport(c.var.db, {
      adminId: c.var.userId,
      reportId: id.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "dismissed":
        return c.json({ reports: result.reports });
      case "report_not_found":
        return c.json({ error: result.kind }, 404);
      case "already_resolved":
        return c.json({ error: result.kind }, 409);
    }
  });

  routes.post("/sanctions", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = createSanctionRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await createSanction(c.var.db, {
      adminId: c.var.userId,
      request: body.data,
      idempotencyKey: key.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "created":
        return c.json<Sanction>(result.sanction, 201);
      case "player_not_found":
      case "report_not_found":
        return c.json({ error: result.kind }, 404);
      case "already_resolved":
        return c.json({ error: result.kind }, 409);
      default:
        return c.json({ error: result.kind }, 422);
    }
  });

  routes.get("/contests", async (c) =>
    c.json<AdminContestsResponse>({ contests: await listOpenContests(c.var.db, Date.now()) }),
  );

  routes.post("/sanctions/:id/contest", async (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "sanction_not_found" }, 404);
    const body = resolveContestRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await resolveContest(c.var.db, {
      adminId: c.var.userId,
      sanctionId: id.data,
      outcome: body.data.outcome,
      now: Date.now(),
    });
    switch (result.kind) {
      case "resolved":
        return c.body(null, 204);
      case "sanction_not_found":
        return c.json({ error: result.kind }, 404);
      case "already_resolved":
        return c.json({ error: result.kind }, 409);
    }
  });

  return routes;
}
