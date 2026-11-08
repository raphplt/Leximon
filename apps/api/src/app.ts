import {
  type AppStatusResponse,
  appVersionSchema,
  INVITE_HEADER,
  REFERRER_HEADER,
  SOURCE_HEADER,
  sendSignInCodeRequestSchema,
  UNDELIVERABLE_EMAIL_ERROR,
} from "@leximon/contract";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createEmailSender, type EmailSenderFactory } from "./account/email-sender";
import { dnsOverHttpsResolver, type MailDomainResolver, mailDomainOf } from "./account/mail-domain";
import { accountRoutes } from "./account/routes";
import { adminRoutes } from "./admin/routes";
import { AUTH_BASE_PATH, googleSignInConfigured, parseOrigins } from "./auth";
import { inviteRoutes } from "./beta/routes";
import { createCardPoolLoader } from "./boosters/card-pool";
import { boosterRoutes } from "./boosters/routes";
import { type CampaignMailerFactory, createCampaignMailer } from "./campaigns/mailer";
import { emailPublicRoutes } from "./campaigns/routes";
import { createCatalogIndexLoader } from "./challenges/catalog-index";
import { challengeRoutes } from "./challenges/routes";
import { clanRoutes } from "./clans/routes";
import type { AppEnv } from "./context";
import { errorSummary } from "./error-summary";
import { referrerRoutes } from "./friends/routes";
import { joustRoutes } from "./jousts/routes";
import { meRoutes } from "./me/routes";
import { readAuthEmail, serializeCodeChecks } from "./middleware/auth-email";
import { databaseMiddleware } from "./middleware/database";
import {
  codeSendDailyQuota,
  codeSendEmailRateLimit,
  codeSendIpRateLimit,
  codeVerifyIpRateLimit,
  signupRateLimit,
  waitlistRateLimit,
} from "./middleware/rate-limit";
import { type BillingFactory, createStripeBilling } from "./patron/billing";
import { stripeWebhookRoutes } from "./patron/routes";
import { riddleRoutes } from "./riddles/routes";
import { playerRoutes, tradeRoutes } from "./trades/routes";
import { waitlistRoutes } from "./waitlist/routes";

/**
 * Better Auth routes the clients use; every other route Better Auth offers (passwords, profile
 * updates, other code types…) answers 404, so that nothing unused can be reached. The proxy carries
 * the mobile app's trip to Google from its browser.
 */
const AUTH_ROUTES = new Set([
  "POST /sign-in/anonymous",
  "POST /email-otp/send-verification-otp",
  "POST /sign-in/email-otp",
  "POST /sign-in/social",
  "POST /link-social",
  "GET /callback/google",
  "GET /expo-authorization-proxy",
  "GET /get-session",
  "POST /sign-out",
]);

export interface AppOptions {
  /** Builds the sender of sign-in codes; tests pass one that keeps the codes. */
  readonly emailSender?: EmailSenderFactory;
  /** Builds the campaign sender, used here for test sends; tests pass a fake. */
  readonly campaignMailer?: CampaignMailerFactory;
  /** Checks that an address's domain takes e-mail before a code goes; tests pass one without DNS. */
  readonly mailDomain?: MailDomainResolver;
  /** Talks to Stripe; tests pass a fake. */
  readonly billing?: BillingFactory;
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
  const createBilling = options.billing ?? createStripeBilling;

  app.use(requestId());
  app.use(secureHeaders());
  app.use((c, next) =>
    cors({
      origin: parseOrigins(c.env.TRUSTED_ORIGINS),
      credentials: true,
      allowHeaders: [
        "Content-Type",
        "Idempotency-Key",
        INVITE_HEADER,
        SOURCE_HEADER,
        REFERRER_HEADER,
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      // Browsers otherwise ask again within seconds: one more round trip before each write.
      // Two hours is Chrome's ceiling.
      maxAge: 7200,
    })(c, next),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/app", (c) => {
    // A malformed setting never locks every player out.
    const minimum = appVersionSchema.safeParse(c.env.MOBILE_MIN_VERSION);
    c.header("Cache-Control", "public, max-age=60");
    return c.json<AppStatusResponse>({
      mobileMinVersion: minimum.success ? minimum.data : "0.0.0",
      googleSignIn: googleSignInConfigured(c.env),
    });
  });

  // Limits run before the database is opened. Hono runs every matching handler in order.
  app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, async (c, next) => {
    const route = `${c.req.method} ${c.req.path.slice(AUTH_BASE_PATH.length)}`;
    return AUTH_ROUTES.has(route) ? next() : c.json({ error: "not_found" }, 404);
  });
  app.post(`${AUTH_BASE_PATH}/sign-in/anonymous`, signupRateLimit);
  // Each trip to Google writes its state: as many as guests, not more.
  app.post(`${AUTH_BASE_PATH}/sign-in/social`, signupRateLimit);
  app.post(`${AUTH_BASE_PATH}/link-social`, signupRateLimit);
  app.post(
    `${AUTH_BASE_PATH}/email-otp/send-verification-otp`,
    onlySignInCodes,
    codeSendIpRateLimit,
    codeSendEmailRateLimit,
    rejectUndeliverableAddress(options.mailDomain ?? dnsOverHttpsResolver),
  );
  app.post(`${AUTH_BASE_PATH}/sign-in/email-otp`, codeVerifyIpRateLimit);
  app.use(`${AUTH_BASE_PATH}/*`, withDatabase);
  app.post(`${AUTH_BASE_PATH}/email-otp/send-verification-otp`, codeSendDailyQuota);
  app.post(`${AUTH_BASE_PATH}/sign-in/email-otp`, serializeCodeChecks);
  app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) => c.var.auth.handler(c.req.raw));
  app.use("/account/*", withDatabase);
  app.route("/account", accountRoutes());
  app.use("/boosters/*", withDatabase);
  app.route("/boosters", boosterRoutes(loadCardPool));
  app.use("/me/*", withDatabase);
  app.route("/me", meRoutes(createBilling));
  app.use("/challenges", withDatabase);
  app.use("/challenges/*", withDatabase);
  app.route("/challenges", challengeRoutes(loadCatalogIndex));
  app.use("/jousts", withDatabase);
  app.use("/jousts/*", withDatabase);
  app.route("/jousts", joustRoutes(loadCatalogIndex));
  app.use("/riddles/*", withDatabase);
  app.route("/riddles", riddleRoutes(loadCatalogIndex));
  app.use("/trades/*", withDatabase);
  app.use("/trades", withDatabase);
  app.route("/trades", tradeRoutes());
  app.use("/clans", withDatabase);
  app.use("/clans/*", withDatabase);
  app.route("/clans", clanRoutes());
  app.use("/players/*", withDatabase);
  app.route("/players", playerRoutes());
  app.use("/stripe/*", withDatabase);
  app.route("/stripe", stripeWebhookRoutes(createBilling));
  app.use("/admin/*", withDatabase);
  app.route("/admin", adminRoutes(options.campaignMailer ?? createCampaignMailer));
  app.use("/email/*", withDatabase);
  app.route("/email", emailPublicRoutes());
  app.post("/waitlist", waitlistRateLimit);
  app.use("/waitlist", withDatabase);
  app.route("/waitlist", waitlistRoutes());
  // Public like the waiting list, and limited the same way: nobody tries codes one by one.
  app.get("/invites/*", waitlistRateLimit);
  app.use("/invites/*", withDatabase);
  app.route("/invites", inviteRoutes());
  app.get("/referrers/*", waitlistRateLimit);
  app.use("/referrers/*", withDatabase);
  app.route("/referrers", referrerRoutes());

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    console.error("Unhandled error", { requestId: c.get("requestId"), ...errorSummary(error) });
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

/**
 * Refuses an address whose domain takes no e-mail (a typo, a made-up domain) before a code goes:
 * the player learns it at once, and the sending domain keeps its reputation. Says nothing about
 * accounts. Runs after the limits, which also cap the lookups.
 */
function rejectUndeliverableAddress(resolve: MailDomainResolver) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const email = await readAuthEmail(c);
    const domain = email === null ? null : mailDomainOf(email);
    if (domain !== null && (await resolve(domain)) === "undeliverable") {
      return c.json({ error: UNDELIVERABLE_EMAIL_ERROR }, 400);
    }
    return next();
  });
}
