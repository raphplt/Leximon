import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

export interface AppBindings {
  Bindings: Env;
}

/**
 * Builds the HTTP application. Kept separate from the Worker entry point so tests can
 * exercise routes with `app.request()` without a Workers runtime.
 *
 * Stateless by design: nothing here may keep data in memory between requests.
 */
export function createApp() {
  const app = new Hono<AppBindings>();

  app.use(requestId());
  app.use(secureHeaders());

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    console.error("Unhandled error", { requestId: c.get("requestId"), message: error.message });
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
