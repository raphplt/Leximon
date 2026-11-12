import {
  type AccountResponse,
  type BannerPurchaseRefusal,
  type BannerPurchaseResponse,
  type BlocksResponse,
  type BoosterWalletResponse,
  type ClaimLevelRewardResponse,
  type ClaimRefusal,
  type ClaimWelcomeDayResponse,
  cardReadParamSchema,
  type DeleteAccountRefusal,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type LevelRewardsResponse,
  type MailResponse,
  type MarkMailReadResponse,
  type MasteryResponse,
  mailQuerySchema,
  markMailReadRequestSchema,
  type OwnedCardsResponse,
  ownedCardsQuerySchema,
  type Preferences,
  type ProfileRefusal,
  type ProfileResponse,
  type ProgressResponse,
  pinnedCardsRequestSchema,
  playerCodeSchema,
  type TradeableCardsResponse,
  updatePreferencesRequestSchema,
  updateProfileRequestSchema,
  type WelcomeRefusal,
  type WelcomeWeekResponse,
} from "@leximon/contract";
import {
  GUEST_SCHEDULE,
  guestBoostersLeft,
  guestRulesAt,
  levelOf,
  PRACTICE_SCHEDULE,
  practiceRulesAt,
} from "@leximon/core";
import { schema } from "@leximon/db";
import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { ADMIN_ROLE } from "../auth";
import { recordPlayedDay } from "../beta/activity";
import { betaPlayerRoutes } from "../beta/routes";
import { guestOpensSql } from "../boosters/open-booster";
import { emailPreferenceRoutes } from "../campaigns/routes";
import { leaveClan, touchLastSeen } from "../clans/clans";
import { sendGameEvents } from "../clans/events";
import { myClanRoutes } from "../clans/routes";
import type { AppEnv } from "../context";
import { ecuRoutes } from "../ecus/routes";
import { errorSummary } from "../error-summary";
import { friendRoutes } from "../friends/routes";
import { claimLevelReward, readLevelRewards, walletView } from "../levels/rewards";
import { markMailRead, readMail } from "../mail/mail";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { missionRoutes } from "../missions/routes";
import { readRestrictions, refuseLockedWrites } from "../moderation/restrictions";
import { sanctionRoutes } from "../moderation/routes";
import { type BillingFactory, billingConfigured } from "../patron/billing";
import { readDiscordLink } from "../patron/discord";
import { endBillingOfAccount } from "../patron/patron";
import { editionRoutes, patronRoutes } from "../patron/routes";
import { buyBanner } from "../profile/banners";
import {
  blockPlayer,
  deleteAccount,
  isAccountKept,
  listBlocks,
  readOwnProfile,
  readPreferences,
  setPinnedCards,
  unblockPlayer,
  updatePreferences,
  updateProfile,
} from "../profile/profile";
import { readXp } from "../progress/progress";
import { ensurePlayer, tradeableResponse } from "../trades/players";
import { blockResultResponse } from "../trades/routes";

import { claimWelcomeDay, readWelcomeWeek } from "../welcome/welcome";
import { wishRoutes } from "../wishes/routes";

const { boosterWallets, cards, userCards, userMastery } = schema;

/** A level in a path: from the first rewarded level, within the range of the stored column. */
const levelParamSchema = z.coerce.number().int().min(2).max(10_000);
const welcomeDayParamSchema = z.coerce.number().int().min(1).max(100);
/** Long enough to cover the trip back from Google or the e-mail, short enough to welcome only once. */
const JUST_JOINED_MS = 10 * 60_000;
/** An account made with Google gets its Google row within the same request. */
const LINKED_LATER_MS = 60_000;

const isRecent = (at: Date) => Date.now() - at.getTime() < JUST_JOINED_MS;

/** Player state for the current session. Never cached: it changes with every action. */
export function meRoutes(createBilling: BillingFactory) {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser);
  routes.use(playerRateLimit);
  routes.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  routes.route("/email-preferences", emailPreferenceRoutes());
  routes.route("/clan", myClanRoutes());
  routes.route("/sanctions", sanctionRoutes());
  routes.route("/patron", patronRoutes(createBilling));
  routes.route("/editions", editionRoutes());
  routes.route("/", betaPlayerRoutes());
  routes.route("/", friendRoutes());
  routes.route("/", ecuRoutes());
  routes.route("/", missionRoutes());
  routes.route("/", wishRoutes());

  routes.get("/wallet", async (c) => {
    // Asked for on every screen: the player's presence for the clan.
    await touchLastSeen(c.var.db, c.var.userId, Date.now());
    const [row] = await c.var.db
      .select()
      .from(boosterWallets)
      .where(eq(boosterWallets.userId, c.var.userId));
    // A player who never opened a booster has no row yet: their stock is full.
    return c.json<BoosterWalletResponse>(walletView(row, Date.now()));
  });

  /** The mail: letters written by the queue, newest first, and what stays unread. */
  routes.get("/mail", async (c) => {
    const query = mailQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    return c.json<MailResponse>(
      await readMail(c.var.db, {
        userId: c.var.userId,
        before: query.data.before,
        now: Date.now(),
      }),
    );
  });

  /** Read marks: setting them twice changes nothing. */
  routes.post("/mail/read", async (c) => {
    const body = markMailReadRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const unread = await markMailRead(c.var.db, {
      userId: c.var.userId,
      upTo: body.data.upTo,
      now: Date.now(),
    });
    return c.json<MarkMailReadResponse>({ unread });
  });

  /** Level rewards: the levels already claimed. */
  routes.get("/level-rewards", async (c) => {
    return c.json<LevelRewardsResponse>(await readLevelRewards(c.var.db, c.var.userId));
  });

  routes.post("/level-rewards/:level", refuseLockedWrites, async (c) => {
    const level = levelParamSchema.safeParse(c.req.param("level"));
    if (!level.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const result = await claimLevelReward(c.var.db, {
      userId: c.var.userId,
      level: level.data,
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: ClaimRefusal }>({ error: result.reason }, 409);
    }
    return c.json<ClaimLevelRewardResponse>({
      level: result.level,
      rewards: [...result.rewards],
      wallet: result.wallet,
    });
  });

  /** The welcome week: what each day gives and whether today's waits. */
  routes.get("/welcome", async (c) => {
    return c.json<WelcomeWeekResponse>(await readWelcomeWeek(c.var.db, c.var.userId, Date.now()));
  });

  routes.post("/welcome/:day", refuseLockedWrites, async (c) => {
    const day = welcomeDayParamSchema.safeParse(c.req.param("day"));
    if (!day.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const result = await claimWelcomeDay(c.var.db, {
      userId: c.var.userId,
      day: day.data,
      now: Date.now(),
    });
    if (result.kind === "refused") {
      return c.json<{ error: WelcomeRefusal }>({ error: result.reason }, 409);
    }
    return c.json<ClaimWelcomeDayResponse>({
      day: result.day,
      rewards: [...result.rewards],
      wallet: result.wallet,
    });
  });

  routes.get("/cards", async (c) => {
    const query = ownedCardsQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const { collectionId, limit } = query.data;
    const after = query.data.cursor === undefined ? null : decodeCursor(query.data.cursor);
    if (after === undefined) {
      return c.json({ error: "invalid_cursor" }, 400);
    }

    const rows = await c.var.db
      .select({
        cardId: userCards.cardId,
        variant: userCards.variant,
        quantity: userCards.quantity,
        firstObtainedAt: userCards.firstObtainedAt,
        readAt: userCards.readAt,
      })
      .from(userCards)
      .innerJoin(cards, eq(cards.id, userCards.cardId))
      .where(
        and(
          eq(userCards.userId, c.var.userId),
          gt(userCards.quantity, 0),
          collectionId === undefined ? undefined : eq(cards.collectionId, collectionId),
          after === null
            ? undefined
            : or(
                gt(userCards.cardId, after.cardId),
                and(eq(userCards.cardId, after.cardId), gt(userCards.variant, after.variant)),
              ),
        ),
      )
      .orderBy(asc(userCards.cardId), asc(userCards.variant))
      // One extra row tells whether another page exists.
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return c.json<OwnedCardsResponse>({
      cards: page.map((row) => ({
        ...row,
        firstObtainedAt: row.firstObtainedAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      })),
      nextCursor:
        rows.length > limit && last !== undefined
          ? encodeCursor({ cardId: last.cardId, variant: last.variant })
          : null,
    });
  });

  /**
   * The player opened the card's sheet: it is no longer new. A single update with nothing read
   * first, so a retry or two tabs at once change nothing; a card not owned has no row to mark.
   */
  routes.post("/cards/:cardId/read", async (c) => {
    const cardId = cardReadParamSchema.safeParse(c.req.param("cardId"));
    if (!cardId.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    await c.var.db
      .update(userCards)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userCards.userId, c.var.userId),
          eq(userCards.cardId, cardId.data),
          isNull(userCards.readAt),
        ),
      );
    return c.body(null, 204);
  });

  // The player code is created on first request: guests who never trade never get one.
  routes.get("/profile", async (c) => {
    return c.json<ProfileResponse>(await readOwnProfile(c.var.db, c.var.userId, Date.now()));
  });

  /** Pseudo, cosmetics and visibility: the profile as it now reads. */
  routes.patch("/profile", refuseLockedWrites, async (c) => {
    const body = updateProfileRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const now = Date.now();
    // A muted player chooses no pseudo the others would read.
    if (
      body.data.pseudo !== undefined &&
      !(await readRestrictions(c.var.db, c.var.userId, now)).canWrite
    ) {
      return c.json({ error: "sanctioned" }, 403);
    }
    const result = await updateProfile(c.var.db, {
      userId: c.var.userId,
      changes: body.data,
      now,
    });
    if (result.kind !== "ok") return profileRefusal(c, result.kind);
    return c.json<ProfileResponse>(await readOwnProfile(c.var.db, c.var.userId, now));
  });

  /** A banner motif bought with écus: the profile with it, and the écus left. */
  routes.post("/banners/:motif", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const motif = c.req.param("motif");
    if (!/^[a-z_]{1,40}$/.test(motif)) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const result = await buyBanner(c.var.db, {
      userId: c.var.userId,
      motif,
      idempotencyKey: key.data,
      now,
    });
    switch (result.kind) {
      case "guest_archived":
        return c.json({ error: "guest_archived" }, 409);
      case "refused":
        return c.json<{ error: BannerPurchaseRefusal }>({ error: result.reason }, 409);
      case "bought":
        return c.json<BannerPurchaseResponse>({
          profile: await readOwnProfile(c.var.db, c.var.userId, now),
          wallet: result.wallet,
        });
    }
  });

  /** The cards pinned to the profile, all of them in order. */
  routes.put("/pinned-cards", refuseLockedWrites, async (c) => {
    const body = pinnedCardsRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const now = Date.now();
    const result = await setPinnedCards(c.var.db, {
      userId: c.var.userId,
      cardIds: body.data.cardIds,
      now,
    });
    if (result.kind !== "ok") return profileRefusal(c, result.kind);
    return c.json<ProfileResponse>(await readOwnProfile(c.var.db, c.var.userId, now));
  });

  /** Blocked players. */
  routes.get("/blocks", async (c) => {
    return c.json<BlocksResponse>({
      players: await listBlocks(c.var.db, c.var.userId, Date.now()),
    });
  });

  routes.put("/blocks/:code", async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) {
      return c.json({ error: "player_not_found" }, 404);
    }
    const result = await blockPlayer(c.var.db, {
      userId: c.var.userId,
      code: code.data,
      now: Date.now(),
    });
    return blockResultResponse(c, result);
  });

  routes.delete("/blocks/:code", async (c) => {
    const code = playerCodeSchema.safeParse(c.req.param("code"));
    if (!code.success) {
      return c.json({ error: "player_not_found" }, 404);
    }
    const result = await unblockPlayer(c.var.db, { userId: c.var.userId, code: code.data });
    return blockResultResponse(c, result);
  });

  /** What the player wants to be told. Nothing is sent before the queue exists. */
  routes.get("/preferences", async (c) => {
    return c.json<Preferences>(await readPreferences(c.var.db, c.var.userId));
  });

  routes.patch("/preferences", async (c) => {
    const body = updatePreferencesRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const review = practiceRulesAt(PRACTICE_SCHEDULE, Date.now());
    const { reviewLength, newWordsPerDay } = body.data;
    if (
      (reviewLength !== undefined && !review.lengths.includes(reviewLength)) ||
      (newWordsPerDay !== undefined && !review.newWordsPerDay.includes(newWordsPerDay))
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    return c.json<Preferences>(await updatePreferences(c.var.db, c.var.userId, body.data));
  });

  /**
   * Account level: a player who never earned XP is at level 1. Every screen loads it once, so it
   * also notes the day played, in parallel with the read.
   */
  routes.get("/progress", async (c) => {
    const [xp] = await Promise.all([
      readXp(c.var.db, c.var.userId),
      recordPlayedDay(c.var.db, c.var.userId, Date.now()),
    ]);
    return c.json<ProgressResponse>({ xp, ...levelOf(xp) });
  });

  routes.get("/tradeable", async (c) => {
    const player = await ensurePlayer(c.var.db, c.var.userId);
    return c.json<TradeableCardsResponse>(
      await tradeableResponse(c.var.db, player, player, Date.now()),
    );
  });

  /** Who is playing: a guest (and how many boosters it may still open), or a member. */
  routes.get("/account", async (c) => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
    if (session === null) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (session.user.isAnonymous !== true) {
      const socialAccounts = await c.var.db
        .select({
          providerId: schema.accounts.providerId,
          linkedAt: schema.accounts.createdAt,
        })
        .from(schema.accounts)
        .where(
          and(
            eq(schema.accounts.userId, session.user.id),
            inArray(schema.accounts.providerId, ["google", "apple"]),
          ),
        );
      const google = socialAccounts.find((account) => account.providerId === "google");
      const apple = socialAccounts.find((account) => account.providerId === "apple");
      const linkedLater = (account: { readonly linkedAt: Date } | undefined) =>
        account !== undefined &&
        isRecent(account.linkedAt) &&
        account.linkedAt.getTime() - session.user.createdAt.getTime() > LINKED_LATER_MS;
      return c.json<AccountResponse>({
        kind: "member",
        email: session.user.email,
        isAdmin: session.user.role === ADMIN_ROLE,
        withGoogle: google !== undefined,
        withApple: apple !== undefined,
        justJoined: isRecent(session.user.createdAt),
        // Added to an account that was already there, not the way the account was made.
        googleJustLinked: linkedLater(google),
        appleJustLinked: linkedLater(apple),
      });
    }
    const rules = guestRulesAt(GUEST_SCHEDULE, Date.now());
    const counted = await c.var.db.execute<{ opened: number | null }>(
      sql`select ${guestOpensSql(session.user.id, rules.boostersBeforeSignup)} as opened`,
    );
    return c.json<AccountResponse>({
      kind: "guest",
      boostersLeft: guestBoostersLeft(rules, counted.rows[0]?.opened ?? 0),
    });
  });

  /**
   * Deletes the account at once. The session cookies are cleared in the same response:
   * the signed cookie cache would otherwise keep a deleted player signed in for minutes.
   */
  routes.delete("/account", async (c) => {
    const now = Date.now();
    // Refused before the subscription and the clan are touched: neither would come back.
    if (await isAccountKept(c.var.db, c.var.userId)) {
      return c.json<{ error: DeleteAccountRefusal }>({ error: "admin_account" }, 409);
    }
    // A deleted account is never billed again: without Stripe's answer, nothing is deleted.
    if (billingConfigured(c.env)) {
      try {
        await endBillingOfAccount(c.var.db, createBilling(c.env), c.var.userId);
      } catch (error) {
        console.error("Billing not ended before an account deletion", errorSummary(error));
        return c.json({ error: "billing_unavailable" }, 503);
      }
    }
    // Leaves the clan first, as anyone leaving: the chief's role passes on, the count follows.
    const left = await leaveClan(c.var.db, { userId: c.var.userId, now });
    if (left.kind === "left" && !left.dissolved) {
      sendGameEvents(c, [{ type: "clan_changed", clanId: left.clanId }]);
    }
    // Read before the account goes: the patrons' role must leave that Discord account.
    const discord = await readDiscordLink(c.var.db, c.var.userId);
    const result = await deleteAccount(c.var.db, { userId: c.var.userId, now });
    if (result.kind === "admin_account") {
      return c.json<{ error: DeleteAccountRefusal }>({ error: result.kind }, 409);
    }
    if (discord !== null) {
      sendGameEvents(c, [
        { type: "discord_role", userId: c.var.userId, discordUserId: discord.discordUserId },
      ]);
    }
    const signedOut = await c.var.auth.api.signOut({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    for (const cookie of signedOut.headers.getSetCookie()) {
      c.header("Set-Cookie", cookie, { append: true });
    }
    return c.body(null, 204);
  });

  /** The level, next review, stability and last review of every word reviewed at least once. */
  routes.get("/mastery", async (c) => {
    const rows = await c.var.db
      .select({
        cardId: userMastery.cardId,
        level: userMastery.level,
        due: userMastery.due,
        stability: userMastery.stability,
        lastReviewedAt: userMastery.lastReviewedAt,
      })
      .from(userMastery)
      .where(eq(userMastery.userId, c.var.userId))
      .orderBy(asc(userMastery.cardId));
    c.header("Cache-Control", "no-store");
    return c.json<MasteryResponse>({
      words: rows.map((row) => ({
        ...row,
        due: row.due.toISOString(),
        lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
      })),
    });
  });

  return routes;
}

/** 403 for a guest, 409 when another player or the calendar is in the way, 422 otherwise. */
function profileRefusal(c: Context<AppEnv>, error: ProfileRefusal) {
  const status =
    error === "account_required"
      ? 403
      : error === "pseudo_taken" || error === "pseudo_too_soon"
        ? 409
        : 422;
  return c.json<{ error: ProfileRefusal }>({ error }, status);
}

interface CardCursor {
  readonly cardId: string;
  readonly variant: string;
}

function encodeCursor(cursor: CardCursor): string {
  return btoa(JSON.stringify([cursor.cardId, cursor.variant]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** `undefined` when the cursor is malformed. */
function decodeCursor(value: string): CardCursor | undefined {
  try {
    const json = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const parsed: unknown = JSON.parse(json);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return { cardId: parsed[0], variant: parsed[1] };
    }
  } catch {
    // Falls through to the malformed result.
  }
  return undefined;
}
