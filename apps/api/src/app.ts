import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { AUTH_BASE_PATH, parseOrigins } from "./auth";
import { createCardPoolLoader } from "./boosters/card-pool";
import { boosterRoutes } from "./boosters/routes";
import { createCatalogIndexLoader } from "./challenges/catalog-index";
import { challengeRoutes } from "./challenges/routes";
import type { AppEnv } from "./context";
import { meRoutes } from "./me/routes";
import { withDatabase } from "./middleware/database";
import { signupRateLimit } from "./middleware/rate-limit";
import { playerRoutes, tradeRoutes } from "./trades/routes";

/**
 * Builds the HTTP application. Kept separate from the Worker entry point so tests can
 * exercise routes with `app.request()` without a Workers runtime.
 *
 * Stateless by design: no player data is kept in memory between requests.
 */
export function createApp() {
  const app = new Hono<AppEnv>();
  const loadCardPool = createCardPoolLoader();
  const loadCatalogIndex = createCatalogIndexLoader();

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
  app.use("/challenges", withDatabase);
  app.use("/challenges/*", withDatabase);
  app.route("/challenges", challengeRoutes(loadCatalogIndex));
  app.use("/trades/*", withDatabase);
  app.use("/trades", withDatabase);
  app.route("/trades", tradeRoutes());
  app.use("/players/*", withDatabase);
  app.route("/players", playerRoutes());

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    console.error("Unhandled error", { requestId: c.get("requestId"), message: error.message });
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
