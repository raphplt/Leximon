import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";

/** Rejects requests without a valid session. Must run after `withDatabase`. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (session === null) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  return next();
});
