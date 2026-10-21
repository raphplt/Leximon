import { createMiddleware } from "hono/factory";
import { ADMIN_ROLE } from "../auth";
import type { AppEnv } from "../context";

/**
 * Rejects requests that are not from an admin. Must run after `withDatabase`.
 *
 * Reads the session from the database, not the signed cookie cache: a revoked role or a ban takes
 * effect on the next request instead of up to five minutes later. Admin traffic is small.
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });
  if (session === null) {
    return c.json({ error: "unauthorized" }, 401);
  }
  if (session.user.role !== ADMIN_ROLE || session.user.banned === true) {
    return c.json({ error: "forbidden" }, 403);
  }
  c.set("userId", session.user.id);
  return next();
});
