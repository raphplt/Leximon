import {
  type AdminPatronRefundRefusal,
  type AdminPatronRefundResponse,
  type AdminPatronsResponse,
  type AdminPollRefusal,
  type AdminPollsResponse,
  adminPatronsQuerySchema,
  adminPollCreateSchema,
  DISCORD_RETURN_QUERY,
  type DiscordLinkRefusal,
  discordLinkRequestSchema,
  type EditionsResponse,
  editionChoiceSchema,
  type FindRefusal,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  monthCosmeticSchema,
  type PatronClaimRefusal,
  type PatronClaimResponse,
  type PatronRedirectResponse,
  type PatronRefusal,
  type PatronResponse,
  type PatronThanksResponse,
  type PatronVoteRefusal,
  patronCheckoutRequestSchema,
  patronThanksChoiceSchema,
  patronVoteRequestSchema,
  type ReserveResponse,
  reserveQuerySchema,
  slugSchema,
  type WordFindView,
} from "@leximon/contract";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { errorSummary } from "../error-summary";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireAdmin } from "../middleware/require-admin";
import { refuseLockedWrites } from "../moderation/restrictions";
import { InvalidPatronCursorError, listPatrons, refundPatron } from "./admin";
import type { BillingFactory } from "./billing";
import {
  type DiscordFactory,
  discordAuthorizeUrl,
  discordConfigured,
  linkDiscord,
  readDiscordLink,
  readDiscordState,
  unlinkDiscord,
} from "./discord";
import { type EditionWriteResult, readEditions, setAlbumEdition, setCardEdition } from "./editions";
import { billingEventOf, verifiedStripeEvent } from "./events";
import {
  applyBillingEvent,
  claimCosmetic,
  openCheckout,
  openPortal,
  patronSales,
  paysAsPatron,
  readPatron,
} from "./patron";
import { listPolls, openPoll, votePoll } from "./polls";
import { findWord, InvalidReserveCursorError, searchReserve } from "./reserve";
import { readPatronThanks, setPatronThanks } from "./thanks";

/** Invoices list their lines: larger than other webhooks, still far below this. */
const MAX_WEBHOOK_BYTES = 256 * 1024;

const webUrlOf = (env: Env) => env.PUBLIC_WEB_URL.replace(/\/+$/, "");

/** Library editions, under `/me/editions` (signed-in player, rate limited). */
export function editionRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (c) =>
    c.json<EditionsResponse>(await readEditions(c.var.db, c.var.userId, Date.now())),
  );

  const answer = (c: Context<AppEnv>, result: EditionWriteResult) =>
    result.kind === "ok" ? c.body(null, 204) : c.json({ error: result.reason }, 403);

  routes.put("/album", refuseLockedWrites, async (c) => {
    const body = editionChoiceSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await setAlbumEdition(c.var.db, {
      userId: c.var.userId,
      edition: body.data.edition,
      now: Date.now(),
    });
    return answer(c, result);
  });

  routes.put("/cards/:cardId", refuseLockedWrites, async (c) => {
    const cardId = slugSchema.safeParse(c.req.param("cardId"));
    const body = editionChoiceSchema.safeParse(await c.req.json().catch(() => null));
    if (!cardId.success || !body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await setCardEdition(c.var.db, {
      userId: c.var.userId,
      cardId: cardId.data,
      edition: body.data.edition,
      now: Date.now(),
    });
    return answer(c, result);
  });

  return routes;
}

/** The patron subscription, under `/me/patron` (signed-in player, rate limited). */
export function patronRoutes(createBilling: BillingFactory) {
  const routes = new Hono<AppEnv>();
  routes.onError((error, c) => {
    if (error instanceof InvalidReserveCursorError) return c.json({ error: "invalid_cursor" }, 400);
    throw error;
  });

  routes.get("/", async (c) =>
    c.json<PatronResponse>(
      await readPatron(c.var.db, {
        userId: c.var.userId,
        sales: patronSales(c.env),
        discordAvailable: discordConfigured(c.env),
        now: Date.now(),
      }),
    ),
  );

  routes.put("/thanks", refuseLockedWrites, async (c) => {
    const body = patronThanksChoiceSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    await setPatronThanks(c.var.db, { userId: c.var.userId, listed: body.data.listed });
    return c.body(null, 204);
  });

  routes.post("/discord/link", refuseLockedWrites, async (c) => {
    const body = discordLinkRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const refuse = (error: DiscordLinkRefusal) =>
      c.json<{ error: DiscordLinkRefusal }>({ error }, 409);
    if (!discordConfigured(c.env)) return refuse("discord_unavailable");
    if (!(await paysAsPatron(c.var.db, c.var.userId))) return refuse("not_patron");
    const url = await discordAuthorizeUrl(c.env, {
      userId: c.var.userId,
      app: body.data.app,
      now: Date.now(),
    });
    return c.json<PatronRedirectResponse>({ url });
  });

  routes.delete("/discord", async (c) => {
    const discordUserId = await unlinkDiscord(c.var.db, c.var.userId);
    if (discordUserId !== null) {
      sendGameEvents(c, [{ type: "discord_role", userId: c.var.userId, discordUserId }]);
    }
    return c.body(null, 204);
  });

  routes.put("/polls/:pollId/vote", refuseLockedWrites, async (c) => {
    const pollId = z.uuid().safeParse(c.req.param("pollId"));
    const body = patronVoteRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!pollId.success || !body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await votePoll(c.var.db, {
      userId: c.var.userId,
      pollId: pollId.data,
      theme: body.data.theme,
      now: Date.now(),
    });
    if (result.kind === "missing") return c.json({ error: "not_found" }, 404);
    if (result.kind === "refused") {
      return c.json<{ error: PatronVoteRefusal }>({ error: result.reason }, 409);
    }
    return c.body(null, 204);
  });

  routes.post("/checkout", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = patronCheckoutRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const sales = patronSales(c.env);
    if (sales === "unavailable") {
      return c.json<{ error: PatronRefusal }>({ error: "sales_closed" }, 409);
    }
    const result = await openCheckout(c.var.db, createBilling(c.env), {
      userId: c.var.userId,
      plan: body.data.plan,
      sales,
      idempotencyKey: key.data,
      webUrl: webUrlOf(c.env),
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: PatronRefusal }>({ error: result.reason }, 409);
    }
    return c.json<PatronRedirectResponse>({ url: result.url });
  });

  routes.post("/portal", async (c) => {
    if (patronSales(c.env) === "unavailable") {
      return c.json<{ error: PatronRefusal }>({ error: "not_subscribed" }, 409);
    }
    const result = await openPortal(c.var.db, createBilling(c.env), {
      userId: c.var.userId,
      webUrl: webUrlOf(c.env),
    });
    if (result.kind === "refused") {
      return c.json<{ error: PatronRefusal }>({ error: result.reason }, 409);
    }
    return c.json<PatronRedirectResponse>({ url: result.url });
  });

  routes.post("/cosmetics/:month/claim", refuseLockedWrites, async (c) => {
    const month = monthCosmeticSchema.shape.month.safeParse(c.req.param("month"));
    if (!month.success) return c.json({ error: "invalid_request" }, 400);
    const result = await claimCosmetic(c.var.db, {
      userId: c.var.userId,
      month: month.data,
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: PatronClaimRefusal }>({ error: result.reason }, 409);
    }
    return c.json<PatronClaimResponse>({ cosmetic: result.cosmetic });
  });

  routes.get("/reserve", async (c) => {
    const query = reserveQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    return c.json<ReserveResponse>(await searchReserve(c.var.db, query.data));
  });

  routes.post("/reserve/:wordId/find", refuseLockedWrites, async (c) => {
    const wordId = slugSchema.safeParse(c.req.param("wordId"));
    if (!wordId.success) return c.json({ error: "invalid_request" }, 400);
    const result = await findWord(c.var.db, {
      userId: c.var.userId,
      wordId: wordId.data,
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: FindRefusal }>({ error: result.reason }, 409);
    }
    return c.json<{ find: WordFindView }>({ find: result.find });
  });

  return routes;
}

/**
 * `POST /stripe/webhook`: what Stripe tells of subscriptions and invoices. Answers 2xx once the
 * event is applied or known; any other answer makes Stripe send it again, for three days.
 */
export function stripeWebhookRoutes(createBilling: BillingFactory) {
  const routes = new Hono<AppEnv>();

  routes.post("/webhook", async (c) => {
    const secret = c.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
    if (secret === "" || patronSales(c.env) === "unavailable") {
      return c.json({ error: "billing_not_configured" }, 503);
    }
    const length = Number(c.req.header("content-length") ?? "0");
    if (length > MAX_WEBHOOK_BYTES) return c.json({ error: "payload_too_large" }, 413);
    const rawBody = await c.req.text();
    if (rawBody.length > MAX_WEBHOOK_BYTES) return c.json({ error: "payload_too_large" }, 413);
    const verified = await verifiedStripeEvent(
      rawBody,
      c.req.header("stripe-signature") ?? "",
      secret,
    );
    if (verified === null) return c.json({ error: "invalid_signature" }, 400);
    const event = billingEventOf(verified);
    if (event === null) return c.json({ error: "invalid_request" }, 400);
    const { result, userId } = await applyBillingEvent(
      c.var.db,
      createBilling(c.env),
      event,
      Date.now(),
    );
    if (result === "unknown_customer") {
      console.warn("Stripe event for a customer the game did not make", { type: event.type });
    }
    // The subscription may have started paying or stopped: the role follows.
    const link = userId === null ? null : await readDiscordLink(c.var.db, userId);
    if (userId !== null && link !== null) {
      sendGameEvents(c, [{ type: "discord_role", userId, discordUserId: link.discordUserId }]);
    }
    return c.json({ result });
  });

  return routes;
}

/** `/admin/patrons`: the subscribers and the refund, admins only, never cached. */
export function adminPatronRoutes(createBilling: BillingFactory) {
  const routes = new Hono<AppEnv>();
  routes.use(requireAdmin);
  routes.use(playerRateLimit);
  routes.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  routes.onError((error, c) => {
    if (error instanceof InvalidPatronCursorError) return c.json({ error: "invalid_cursor" }, 400);
    throw error;
  });

  routes.get("/", async (c) => {
    const query = adminPatronsQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_request" }, 400);
    return c.json<AdminPatronsResponse>(
      await listPatrons(c.var.db, { cursor: query.data.cursor, sales: patronSales(c.env) }),
    );
  });

  routes.get("/polls", async (c) => c.json<AdminPollsResponse>(await listPolls(c.var.db)));

  routes.post("/polls", async (c) => {
    const body = adminPollCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await openPoll(c.var.db, {
      adminId: c.var.userId,
      themes: body.data.themes,
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: AdminPollRefusal }>({ error: result.reason }, 409);
    }
    return c.json({ id: result.id }, 201);
  });

  routes.post("/:userId/refund", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    if (patronSales(c.env) === "unavailable") {
      return c.json<{ error: AdminPatronRefundRefusal }>({ error: "not_subscribed" }, 409);
    }
    const result = await refundPatron(c.var.db, createBilling(c.env), {
      adminId: c.var.userId,
      userId: c.req.param("userId"),
      idempotencyKey: key.data,
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: AdminPatronRefundRefusal }>({ error: result.reason }, 409);
    }
    return c.json<AdminPatronRefundResponse>({ refunded: result.refunded });
  });

  return routes;
}

/** The page of thanks, under `/patrons`: readable without an account, kept by the CDN. */
export function patronThanksRoutes() {
  const routes = new Hono<AppEnv>();
  routes.get("/", async (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json<PatronThanksResponse>(await readPatronThanks(c.var.db, Date.now()));
  });
  return routes;
}

/**
 * `GET /discord/callback`: Discord's page sends the browser back here. The signed state names the
 * account; the player then goes back to the patron page, on the web or in the app.
 */
export function discordRoutes(createDiscord: DiscordFactory) {
  const routes = new Hono<AppEnv>();
  routes.get("/callback", async (c) => {
    const now = Date.now();
    const state = await readDiscordState(c.env, c.req.query("state") ?? "", now);
    if (state === null) return c.json({ error: "invalid_state" }, 400);
    const back = (outcome: "linked" | "failed") => {
      const query = `?${DISCORD_RETURN_QUERY}=${outcome}`;
      return c.redirect(
        state.app ? `leximon://mecene${query}` : `${webUrlOf(c.env)}/mecene${query}`,
      );
    };
    const code = c.req.query("code");
    // Refused on Discord's page, or Discord not set here any more.
    if (code === undefined || code === "" || !discordConfigured(c.env)) return back("failed");
    try {
      const linked = await linkDiscord(c.var.db, createDiscord(c.env), c.env, {
        userId: state.userId,
        code,
        now,
      });
      if (linked.kind === "refused") return back("failed");
      sendGameEvents(c, [
        { type: "discord_role", userId: state.userId, discordUserId: linked.discordUserId },
        ...(linked.previous === null
          ? []
          : [
              {
                type: "discord_role" as const,
                userId: state.userId,
                discordUserId: linked.previous,
              },
            ]),
      ]);
      return back("linked");
    } catch (error) {
      console.error("Discord link failed", errorSummary(error));
      return back("failed");
    }
  });
  return routes;
}
