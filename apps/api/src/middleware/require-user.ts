import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";

/**
 * Rejects requests without a valid session. Must run after `withDatabase`.
 *
 * Passes on the cookies Better Auth sets while reading the session: the signed session cache,
 * which spares the next requests their two session queries, and the session's extension. Read
 * from the server, they would otherwise never reach the browser.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const { headers, response: session } = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  for (const cookie of headers.getSetCookie()) {
    c.header("Set-Cookie", cookie, { append: true });
  }
  if (session === null) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  return next();
});
