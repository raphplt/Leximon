import {
  type AdminCampaign,
  type AdminCampaignAudience,
  type AdminCampaignPreview,
  type AdminCampaignsResponse,
  adminCampaignContentSchema,
  adminCampaignInputSchema,
  adminCampaignLaunchRequestSchema,
  adminWaitlistEraseRequestSchema,
  type EmailPreferences,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  lettermintWebhookSchema,
  updateEmailPreferencesRequestSchema,
} from "@leximon/contract";
import { schema } from "@leximon/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { readAdminEmail } from "../admin/queries";
import type { AppEnv } from "../context";
import { errorSummary } from "../error-summary";
import { clientIp, rateLimit } from "../middleware/rate-limit";
import {
  type CampaignControl,
  controlCampaign,
  countAudience,
  createDraft,
  eraseWaitlist,
  launchCampaign,
  listCampaigns,
  MAX_SCHEDULE_AHEAD_MS,
  readCampaign,
  readCampaignRow,
  updateDraft,
} from "./campaigns";
import { type DeliveryConfig, startCampaignPump, unsubscribeLinks } from "./delivery";
import type { CampaignMailerFactory } from "./mailer";
import { applyLettermintEvent, unsubscribe } from "./opt-out";
import { prepareCampaignEmail } from "./render";
import {
  createUnsubscribeSigner,
  verifyLettermintSignature,
  verifyUnsubscribeToken,
} from "./signatures";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A test send has no row: its unsubscribe link points to one that cannot exist. */
const NO_SEND_ID = "00000000-0000-0000-0000-000000000000";
/** Webhook bodies are small JSON events; anything larger is refused before it is read. */
const MAX_WEBHOOK_BYTES = 64 * 1024;

/** The secrets and addresses a campaign link needs, or null when the environment lacks them. */
export function deliveryConfig(env: Env): DeliveryConfig | null {
  const linkSecret = env.EMAIL_LINK_SECRET?.trim() ?? "";
  if (linkSecret === "") return null;
  return { linkSecret, webUrl: env.PUBLIC_WEB_URL, apiUrl: env.BETTER_AUTH_URL };
}

/**
 * `/admin/campaigns/*`, mounted inside the admin routes (admins only, never cached). Only drafts
 * change; a launch freezes the recipients.
 */
export function campaignAdminRoutes(createMailer: CampaignMailerFactory) {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (c) =>
    c.json<AdminCampaignsResponse>({ campaigns: await listCampaigns(c.var.db) }),
  );

  routes.post("/", async (c) => {
    const body = adminCampaignInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await createDraft(c.var.db, { adminId: c.var.userId, campaign: body.data });
    if (result.kind !== "saved") return draftError(c, result.kind);
    return c.json<AdminCampaign>(await mustRead(c, result.id), 201);
  });

  routes.post("/preview", async (c) => {
    const body = adminCampaignContentSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const email = prepareCampaignEmail(body.data)(previewLinks(c.env));
    return c.json<AdminCampaignPreview>({
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  });

  // Sent to the admin's own address only, through the campaign provider, outside any campaign.
  routes.post("/test", async (c) => {
    const body = adminCampaignContentSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const config = deliveryConfig(c.env);
    if (config === null) return c.json({ error: "email_not_configured" }, 503);
    const to = await readAdminEmail(c.var.db, c.var.userId);
    const token = await createUnsubscribeSigner(config.linkSecret)(NO_SEND_ID);
    const email = prepareCampaignEmail(body.data)(unsubscribeLinks(config, token));
    const outcome = await createMailer(c.env)
      .sendBatch([
        {
          to,
          subject: `[Test] ${email.subject}`,
          html: email.html,
          text: email.text,
          headers: email.headers,
          idempotencyKey: crypto.randomUUID(),
          sendId: NO_SEND_ID,
        },
      ])
      .catch(() => ({ kind: "blocked" as const, code: "not_configured" }));
    if (outcome.kind === "accepted") return c.json({ ok: true });
    return c.json({ error: "send_failed", code: outcome.code }, 502);
  });

  routes.get("/:id", async (c) => {
    const id = c.req.param("id");
    const campaign = UUID.test(id) ? await readCampaign(c.var.db, id) : null;
    if (campaign === null) return c.json({ error: "campaign_not_found" }, 404);
    return c.json<AdminCampaign>(campaign);
  });

  routes.post("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "campaign_not_found" }, 404);
    const body = adminCampaignInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await updateDraft(c.var.db, { id, campaign: body.data, now: Date.now() });
    if (result.kind !== "saved") return draftError(c, result.kind);
    return c.json<AdminCampaign>(await mustRead(c, id));
  });

  routes.get("/:id/audience", async (c) => {
    const id = c.req.param("id");
    const campaign = UUID.test(id) ? await readCampaignRow(c.var.db, id) : null;
    if (campaign === null) return c.json({ error: "campaign_not_found" }, 404);
    return c.json<AdminCampaignAudience>({ recipients: await countAudience(c.var.db, campaign) });
  });

  routes.post("/:id/launch", async (c) => {
    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "campaign_not_found" }, 404);
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = adminCampaignLaunchRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const scheduledAt = body.data.scheduledAt === null ? null : Date.parse(body.data.scheduledAt);
    if (scheduledAt !== null && scheduledAt > now + MAX_SCHEDULE_AHEAD_MS) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const result = await launchCampaign(c.var.db, {
      adminId: c.var.userId,
      id,
      expectedRecipients: body.data.expectedRecipients,
      scheduledAt,
      idempotencyKey: key.data,
      now,
    });
    switch (result.kind) {
      case "launched":
        await startPump(c);
        return c.json<AdminCampaign>(await mustRead(c, id));
      case "campaign_not_found":
        return c.json({ error: "campaign_not_found" }, 404);
      case "recipient_count_changed":
        return c.json({ error: "recipient_count_changed", recipients: result.recipients }, 409);
      case "not_a_draft":
      case "waitlist_closed":
      case "no_recipients":
        return c.json({ error: result.kind }, 409);
    }
  });

  for (const control of ["pause", "resume", "cancel"] as const satisfies CampaignControl[]) {
    routes.post(`/:id/${control}`, async (c) => {
      const id = c.req.param("id");
      if (!UUID.test(id)) return c.json({ error: "campaign_not_found" }, 404);
      const result = await controlCampaign(c.var.db, {
        adminId: c.var.userId,
        id,
        control,
        now: Date.now(),
      });
      switch (result.kind) {
        case "done":
          if (control === "resume") await startPump(c);
          return c.json<AdminCampaign>(await mustRead(c, id));
        case "campaign_not_found":
          return c.json({ error: "campaign_not_found" }, 404);
        case "invalid_state":
          return c.json({ error: "invalid_state" }, 409);
      }
    });
  }

  return routes;
}

/**
 * Starts the pump after a launch or a resume. The campaign is saved whatever happens here: if the
 * message cannot leave, the daily maintenance starts the pump instead.
 */
async function startPump(c: Context<AppEnv>): Promise<void> {
  try {
    await startCampaignPump(c.env.CAMPAIGN_QUEUE);
  } catch (error) {
    console.error("Campaign pump not started", errorSummary(error));
  }
}

/** `POST /admin/waitlist/erase`, mounted with the admin routes. */
export function waitlistEraseRoute() {
  const routes = new Hono<AppEnv>();
  routes.post("/", async (c) => {
    const body = adminWaitlistEraseRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await eraseWaitlist(c.var.db, {
      adminId: c.var.userId,
      expectedCount: body.data.expectedCount,
      now: Date.now(),
    });
    switch (result.kind) {
      case "erased":
        return c.json({ erased: result.erased });
      case "not_sent_yet":
        return c.json({ error: "not_sent_yet" }, 409);
      case "count_changed":
        return c.json({ error: "count_changed", count: result.count }, 409);
    }
  });
  return routes;
}

function draftError(
  c: Context<AppEnv>,
  kind: "campaign_not_found" | "not_a_draft" | "waitlist_closed",
) {
  return c.json({ error: kind }, kind === "campaign_not_found" ? 404 : 409);
}

async function mustRead(c: Context<AppEnv>, id: string): Promise<AdminCampaign> {
  const campaign = await readCampaign(c.var.db, id);
  if (campaign === null) throw new Error(`Campaign ${id} missing right after it was written`);
  return campaign;
}

/** The preview shows real-looking links that lead nowhere. */
function previewLinks(env: Env) {
  const token = `${NO_SEND_ID}.${"0".repeat(43)}`;
  return unsubscribeLinks(
    { linkSecret: "", webUrl: env.PUBLIC_WEB_URL, apiUrl: env.BETTER_AUTH_URL },
    token,
  );
}

const unsubscribeRateLimit = rateLimit("EMAIL_LINK_RATE_LIMITER", clientIp);

/**
 * Public e-mail routes: unsubscribe (link and one-click header, RFC 8058) and the provider's
 * webhook. No session: the signed token or the webhook signature is the authorization.
 */
export function emailPublicRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
  });

  // Mail clients and link scanners open links: a GET never unsubscribes, it shows the page.
  routes.get("/unsubscribe/:token", (c) =>
    c.redirect(
      `${c.env.PUBLIC_WEB_URL.replace(/\/+$/, "")}/desinscription/${c.req.param("token")}`,
      303,
    ),
  );

  routes.post("/unsubscribe/:token", unsubscribeRateLimit, async (c) => {
    const secret = c.env.EMAIL_LINK_SECRET?.trim() ?? "";
    if (secret === "") return c.json({ error: "email_not_configured" }, 503);
    const sendId = await verifyUnsubscribeToken(secret, c.req.param("token"));
    if (sendId === null) return c.json({ error: "invalid_token" }, 400);
    await unsubscribe(c.var.db, sendId, Date.now());
    return c.json({ ok: true });
  });

  routes.post("/webhooks/lettermint", async (c) => {
    const secret = c.env.LETTERMINT_WEBHOOK_SECRET?.trim() ?? "";
    if (secret === "") return c.json({ error: "email_not_configured" }, 503);
    const length = Number(c.req.header("content-length") ?? "0");
    if (length > MAX_WEBHOOK_BYTES) return c.json({ error: "payload_too_large" }, 413);
    const rawBody = await c.req.text();
    if (rawBody.length > MAX_WEBHOOK_BYTES) return c.json({ error: "payload_too_large" }, 413);
    const check = await verifyLettermintSignature({
      secret,
      signatureHeader: c.req.header("x-lettermint-signature") ?? null,
      deliveryHeader: c.req.header("x-lettermint-delivery") ?? null,
      rawBody,
      nowS: Math.floor(Date.now() / 1000),
    });
    if (!check.ok) return c.json({ error: "invalid_signature" }, 401);
    const event = lettermintWebhookSchema.safeParse(safeJson(rawBody));
    if (!event.success) return c.json({ error: "invalid_request" }, 400);
    const result = await applyLettermintEvent(c.var.db, event.data, Date.now());
    return c.json({ result });
  });

  return routes;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const { emailConsents, emailSuppressions, users } = schema;

/**
 * `/me/email-preferences`: the player's consent to campaign e-mails. Registered inside the
 * player routes (session required, rate limited). Guests have no address: nothing to consent to.
 */
export function emailPreferenceRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (c) => {
    const [row] = await c.var.db
      .select({ revokedAt: emailConsents.revokedAt, grantedAt: emailConsents.grantedAt })
      .from(emailConsents)
      .where(eq(emailConsents.userId, c.var.userId));
    const newsOptIn = row !== undefined && row.grantedAt !== null && row.revokedAt === null;
    return c.json<EmailPreferences>({ newsOptIn });
  });

  routes.post("/", async (c) => {
    const body = updateEmailPreferencesRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const { newsOptIn, source } = body.data;
    const now = new Date();
    const result = await c.var.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ email: users.email, isAnonymous: users.isAnonymous })
        .from(users)
        .where(eq(users.id, c.var.userId));
      if (user === undefined || user.isAnonymous === true) return "guest" as const;
      if (newsOptIn) {
        await tx
          .insert(emailConsents)
          .values({ userId: c.var.userId, grantedAt: now, grantedSource: source })
          .onConflictDoUpdate({
            target: emailConsents.userId,
            set: { grantedAt: now, grantedSource: source, revokedAt: null, revokedSource: null },
          });
        // Asking again lifts a past unsubscribe; bounces and complaints stay.
        await tx
          .delete(emailSuppressions)
          .where(
            and(
              eq(emailSuppressions.email, sql`lower(${user.email})`),
              eq(emailSuppressions.reason, "unsubscribed"),
            ),
          );
      } else {
        await tx
          .update(emailConsents)
          .set({ revokedAt: now, revokedSource: source })
          .where(and(eq(emailConsents.userId, c.var.userId), isNull(emailConsents.revokedAt)));
      }
      return "saved" as const;
    });
    if (result === "guest") return c.json({ error: "account_required" }, 403);
    return c.json<EmailPreferences>({ newsOptIn });
  });

  return routes;
}
