import {
  type ChallengeAnswerResponse,
  type ChallengesResponse,
  challengeAnswerRequestSchema,
  challengesQuerySchema,
  type DailyChallengeResponse,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
} from "@leximon/contract";
import { Hono } from "hono";
import { generateSeed } from "../boosters/seed";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { refuseLockedWrites } from "../moderation/restrictions";
import type { CatalogIndexLoader } from "./catalog-index";
import { answerChallenge, dailyTally, nextChallenges } from "./challenges";

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
      questions: session.questions.map(({ cardId, format, choices }) => ({
        cardId,
        format,
        choices: [...choices],
      })),
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
    const result = await answerChallenge(c.var.db, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      ...body.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "answered":
        return c.json<ChallengeAnswerResponse>({
          correct: result.correct,
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

  return routes;
}
