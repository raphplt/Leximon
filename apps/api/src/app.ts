import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { AUTH_BASE_PATH, parseOrigins } from "./auth";
import { createCardPoolLoader } from "./boosters/card-pool";
import { boosterRoutes } from "./boosters/routes";
import type { AppEnv } from "./context";
import { meRoutes } from "./me/routes";
import { withDatabase } from "./middleware/database";
import { signupRateLimit } from "./middleware/rate-limit";

/**
 * Builds the HTTP application. Kept separate from the Worker entry point so tests can
 * exercise routes with `app.request()` without a Workers runtime.
 *
 * Stateless by design: no player data is kept in memory between requests.
 */
export function createApp() {
  const app = new Hono<AppEnv>();
  const loadCardPool = createCardPoolLoader();

  app.use(requestId());
  app.use(secureHeaders());
  app.use((c, next) =>
    cors({
      origin: parseOrigins(c.env.TRUSTED_ORIGINS),
      credentials: true,
      allowHeaders: ["Content-Type", "Idempotency-Key"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    })(c, next),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post(`${AUTH_BASE_PATH}/sign-in/anonymous`, signupRateLimit);
  app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, withDatabase, (c) =>
    c.var.auth.handler(c.req.raw),
  );
  app.use("/boosters/*", withDatabase);
  app.route("/boosters", boosterRoutes(loadCardPool));
  app.use("/me/*", withDatabase);
  app.route("/me", meRoutes());

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    console.error("Unhandled error", { requestId: c.get("requestId"), message: error.message });
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
