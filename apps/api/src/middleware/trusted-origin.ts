import { createMiddleware } from "hono/factory";
import { parseOrigins } from "../auth";
import type { AppEnv } from "../context";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Refuses a write a browser sends with the session cookie from a page that is not ours. The
 * cookie's SameSite already keeps other sites out; this also covers a page on a sibling subdomain,
 * which is same-site, and a form posted as plain text, which skips the preflight.
 *
 * Browsers name the page on every write. Requests without `Origin` (the mobile app, webhooks, the
 * web server) or without a cookie (signed links mail clients post to) ride on no one's session.
 */
export const trustedOrigin = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header("origin");
  if (
    SAFE_METHODS.has(c.req.method) ||
    origin === undefined ||
    c.req.header("cookie") === undefined ||
    parseOrigins(c.env.TRUSTED_ORIGINS).includes(origin)
  ) {
    return next();
  }
  return c.json({ error: "forbidden" }, 403);
});
