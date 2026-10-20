import { type AnalyticsMessage, analyticsBatchSchema } from "@leximon/contract";
import { EXPERIMENTS, runningVariants } from "@leximon/core";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { analyticsSubject } from "./subject";

/**
 * Event log of the A/B tests (D-030). The request only validates and queues: nothing is written
 * to Postgres while the player waits. Variants are computed here, from the server's clock and
 * the player id, never taken from the client.
 */
export function analyticsRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser, playerRateLimit);

  routes.post("/", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const batch = analyticsBatchSchema.safeParse(body);
    if (!batch.success) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const message: AnalyticsMessage = {
      subject: await analyticsSubject(c.env.ANALYTICS_SECRET, c.var.userId),
      variants: runningVariants(EXPERIMENTS, c.var.userId, now),
      receivedAt: new Date(now).toISOString(),
      events: batch.data.events,
    };
    await c.env.ANALYTICS_QUEUE.send(message);
    return c.body(null, 202);
  });

  return routes;
}
