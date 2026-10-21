import { sendSignInCodeRequestSchema } from "@leximon/contract";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createEmailSender, type EmailSenderFactory } from "./account/email-sender";
import { accountRoutes } from "./account/routes";
import { adminRoutes } from "./admin/routes";
import { AUTH_BASE_PATH, parseOrigins } from "./auth";
import { createCardPoolLoader } from "./boosters/card-pool";
import { boosterRoutes } from "./boosters/routes";
import { createCatalogIndexLoader } from "./challenges/catalog-index";
import { challengeRoutes } from "./challenges/routes";
import type { AppEnv } from "./context";
import { meRoutes } from "./me/routes";
import { readAuthEmail, serializeCodeChecks } from "./middleware/auth-email";
import { databaseMiddleware } from "./middleware/database";
import {
  codeSendEmailRateLimit,
  codeSendIpRateLimit,
  codeVerifyIpRateLimit,
  signupRateLimit,
  waitlistRateLimit,
} from "./middleware/rate-limit";
import { playerRoutes, tradeRoutes } from "./trades/routes";
import { waitlistRoutes } from "./waitlist/routes";

/**
 * Better Auth routes the clients use; every other route Better Auth offers (passwords, profile
 * updates, other code types…) answers 404, so that nothing unused can be reached. Apple and Google
 * will add `/sign-in/social` and `/callback/:provider`.
 */
const AUTH_ROUTES = new Set([
  "POST /sign-in/anonymous",
  "POST /email-otp/send-verification-otp",
  "POST /sign-in/email-otp",
  "GET /get-session",
  "POST /sign-out",
]);

export interface AppOptions {
  /** Builds the sender of sign-in codes; tests pass one that keeps the codes. */
  readonly emailSender?: EmailSenderFactory;
}

/**
 * Builds the HTTP application. Kept separate from the Worker entry point so tests can
 * exercise routes with `app.request()` without a Workers runtime.
 *
 * Stateless by design: no player data is kept in memory between requests.
 */
export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>();
  const withDatabase = databaseMiddleware(options.emailSender ?? createEmailSender);
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

  // Limits run before the database is opened. Hono runs every matching handler in order.
  app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, async (c, next) => {
    const route = `${c.req.method} ${c.req.path.slice(AUTH_BASE_PATH.length)}`;
    return AUTH_ROUTES.has(route) ? next() : c.json({ error: "not_found" }, 404);
  });
  app.post(`${AUTH_BASE_PATH}/sign-in/anonymous`, signupRateLimit);
  app.post(
    `${AUTH_BASE_PATH}/email-otp/send-verification-otp`,
    onlySignInCodes,
    codeSendIpRateLimit,
    codeSendEmailRateLimit,
  );
  app.post(`${AUTH_BASE_PATH}/sign-in/email-otp`, codeVerifyIpRateLimit);
  app.use(`${AUTH_BASE_PATH}/*`, withDatabase);
  app.post(`${AUTH_BASE_PATH}/sign-in/email-otp`, serializeCodeChecks);
  app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) => c.var.auth.handler(c.req.raw));
  app.use("/account/*", withDatabase);
  app.route("/account", accountRoutes());
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
  app.use("/admin/*", withDatabase);
  app.route("/admin", adminRoutes());
  app.post("/waitlist", waitlistRateLimit);
  app.use("/waitlist", withDatabase);
  app.route("/waitlist", waitlistRoutes());

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    console.error("Unhandled error", { requestId: c.get("requestId"), message: error.message });
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}

/** Codes are only sent to sign in: e-mail verification and password reset are not used. */
const onlySignInCodes = createMiddleware<AppEnv>(async (c, next) => {
  const body = sendSignInCodeRequestSchema.safeParse(
    await c.req.raw
      .clone()
      .json()
      .catch(() => null),
  );
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  // The limits key on the address as Better Auth will read it.
  await readAuthEmail(c);
  return next();
});
