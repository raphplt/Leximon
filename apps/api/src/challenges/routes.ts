import {
  type ChallengeAnswerResponse,
  type ChallengesResponse,
  challengeAnswerRequestSchema,
  challengesQuerySchema,
  type DailyChallengeResponse,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type PracticeAnswerResponse,
  type PracticeResponse,
  type PracticeSummaryResponse,
  practiceAnswerRequestSchema,
  practiceRequestSchema,
} from "@leximon/contract";
import { Hono } from "hono";
import { generateSeed } from "../boosters/seed";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { refuseLockedWrites } from "../moderation/restrictions";
import type { CatalogIndexLoader } from "./catalog-index";
import { answerChallenge, dailyTally, nextChallenges } from "./challenges";
import { answerPractice, practiceSummary, startPractice } from "./practice";

/** Challenges: questions on owned words, answers that raise their mastery. */
export function challengeRoutes(loadCatalogIndex: CatalogIndexLoader) {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser);
  routes.use(playerRateLimit);
  routes.use(refuseLockedWrites);

  routes.get("/", async (c) => {
    const query = challengesQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const now = Date.now();
    const catalog = await loadCatalogIndex(c.var.db, now);
    const session = await nextChallenges(c.var.db, catalog, {
      userId: c.var.userId,
      now,
      limit: query.data.limit,
      seed: generateSeed(),
    });
    c.header("Cache-Control", "no-store");
    return c.json<ChallengesResponse>({
      questions: session.questions.map((question) =>
        question.format === "typed"
          ? { cardId: question.cardId, format: question.format }
          : { cardId: question.cardId, format: question.format, choices: [...question.choices] },
      ),
      nextDueAt: session.nextDueAt === null ? null : new Date(session.nextDueAt).toISOString(),
    });
  });

  routes.get("/daily", async (c) => {
    const tally = await dailyTally(c.var.db, c.var.userId, Date.now());
    c.header("Cache-Control", "no-store");
    return c.json<DailyChallengeResponse>(tally);
  });

  routes.post("/answer", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) {
      return c.json({ error: "invalid_idempotency_key" }, 400);
    }
    const body = challengeAnswerRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const catalog = await loadCatalogIndex(c.var.db, Date.now());
    const result = await answerChallenge(c.var.db, catalog, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      ...body.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "answered":
        sendGameEvents(c, [
          ...(result.correct ? [{ type: "answer_given" as const, userId: c.var.userId }] : []),
          ...(result.progress.levelUp ? [{ type: "level_up" as const, userId: c.var.userId }] : []),
        ]);
        return c.json<ChallengeAnswerResponse>({
          correct: result.correct,
          slip: result.slip,
          level: result.level,
          levelUp: result.levelUp,
          nextReviewAt: new Date(result.nextReviewAt).toISOString(),
          bonus: result.bonus,
          progress: result.progress,
        });
      case "card_not_owned":
        return c.json({ error: "card_not_owned" }, 404);
      case "not_due":
        return c.json(
          {
            error: "challenge_not_due",
            nextReviewAt: new Date(result.nextReviewAt).toISOString(),
          },
          409,
        );
    }
  });

  routes.get("/practice", async (c) => {
    const now = Date.now();
    const catalog = await loadCatalogIndex(c.var.db, now);
    const summary = await practiceSummary(c.var.db, catalog, { userId: c.var.userId, now });
    c.header("Cache-Control", "no-store");
    return c.json<PracticeSummaryResponse>({
      scopes: [...summary.scopes],
      xp: summary.xp,
    });
  });

  // A POST for the length of an album's list; it writes nothing.
  routes.post("/practice", async (c) => {
    const body = practiceRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const now = Date.now();
    const catalog = await loadCatalogIndex(c.var.db, now);
    const series = await startPractice(c.var.db, catalog, {
      userId: c.var.userId,
      scope: body.data.scope,
      now,
      seed: generateSeed(),
    });
    c.header("Cache-Control", "no-store");
    switch (series.kind) {
      case "ready":
        return c.json<PracticeResponse>({ questions: [...series.questions] });
      case "level_required":
        return c.json({ error: "level_required", level: series.level }, 403);
      case "scope_too_small":
        return c.json({ error: "scope_too_small", minWords: series.minWords }, 422);
    }
  });

  routes.post("/practice/answer", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) {
      return c.json({ error: "invalid_idempotency_key" }, 400);
    }
    const body = practiceAnswerRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const result = await answerPractice(c.var.db, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      ...body.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "answered":
        sendGameEvents(
          c,
          result.progress.levelUp ? [{ type: "level_up" as const, userId: c.var.userId }] : [],
        );
        return c.json<PracticeAnswerResponse>({
          correct: result.correct,
          xpToday: result.xpToday,
          progress: result.progress,
        });
      case "card_not_owned":
        return c.json({ error: "card_not_owned" }, 404);
    }
  });

  return routes;
}
