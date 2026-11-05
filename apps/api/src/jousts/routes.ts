import {
  type AnswerJoustResponse,
  answerJoustRequestSchema,
  type GameEvent,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type JoustDeckResponse,
  type JoustOpponentsResponse,
  type JoustQuestionResponse,
  type JoustsResponse,
  type JoustView,
  launchJoustRequestSchema,
  saveDeckRequestSchema,
} from "@leximon/contract";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { generateSeed } from "../boosters/seed";
import type { CatalogIndexLoader } from "../challenges/catalog-index";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { refuseLockedWrites } from "../moderation/restrictions";
import {
  answerQuestion,
  launchJoust,
  listJousts,
  listOpponents,
  nextQuestion,
  readDeck,
  readJoust,
  type SettleReport,
  saveDeck,
  settleJoust,
} from "./jousts";

const joustIdSchema = z.uuid();

/** Letters for the joust that closed something, and the levels its rewards passed. */
function settledEvents(report: SettleReport, joustIds: readonly string[]): GameEvent[] {
  if (!report.changed) return [];
  return [
    ...joustIds.map((joustId) => ({ type: "joust_changed" as const, joustId })),
    ...report.levelUps.map((userId) => ({ type: "level_up" as const, userId })),
  ];
}

/** Settles the joust once the player's run is over, and sends what it changed. */
async function settleAfterRun(c: Context<AppEnv>, joustId: string): Promise<void> {
  const report = await settleJoust(c.var.db, joustId, Date.now());
  sendGameEvents(c, settledEvents(report, [joustId]));
}

/** Jousts: two players find the words of each other's cards, one after the other, on the clock. */
export function joustRoutes(loadCatalogIndex: CatalogIndexLoader) {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser);
  routes.use(playerRateLimit);
  routes.use(refuseLockedWrites);

  routes.get("/", async (c) => {
    const now = Date.now();
    const catalog = await loadCatalogIndex(c.var.db, now);
    const { response, settled } = await listJousts(c.var.db, c.var.userId, catalog, now);
    sendGameEvents(c, settledEvents(settled, settled.joustIds));
    c.header("Cache-Control", "no-store");
    return c.json<JoustsResponse>(response);
  });

  routes.get("/deck", async (c) => {
    const now = Date.now();
    const catalog = await loadCatalogIndex(c.var.db, now);
    c.header("Cache-Control", "no-store");
    return c.json<JoustDeckResponse>(await readDeck(c.var.db, c.var.userId, catalog, now));
  });

  routes.put("/deck", async (c) => {
    const body = saveDeckRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const result = await saveDeck(c.var.db, {
      userId: c.var.userId,
      cardIds: body.data.cardIds,
      catalog: await loadCatalogIndex(c.var.db, now),
      now,
    });
    if (result.kind === "refused") return c.json({ error: result.reason }, 409);
    return c.body(null, 204);
  });

  routes.get("/opponents", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json<JoustOpponentsResponse>(await listOpponents(c.var.db, c.var.userId, Date.now()));
  });

  routes.post("/", async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = launchJoustRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const now = Date.now();
    const result = await launchJoust(c.var.db, {
      userId: c.var.userId,
      target: body.data,
      launchKey: key.data,
      seed: generateSeed(),
      catalog: await loadCatalogIndex(c.var.db, now),
      now,
    });
    switch (result.kind) {
      case "launched":
        return c.json({ joustId: result.joustId }, 201);
      case "refused":
        return c.json({ error: result.reason }, 409);
      case "not_found":
        return c.json({ error: "joust_not_found" }, 404);
    }
  });

  routes.get("/:id", async (c) => {
    const joustId = joustIdSchema.safeParse(c.req.param("id"));
    if (!joustId.success) return c.json({ error: "joust_not_found" }, 404);
    const found = await readJoust(c.var.db, {
      userId: c.var.userId,
      joustId: joustId.data,
      now: Date.now(),
    });
    if (found === null) return c.json({ error: "joust_not_found" }, 404);
    sendGameEvents(c, settledEvents(found.settled, [joustId.data]));
    c.header("Cache-Control", "no-store");
    return c.json<JoustView>(found.view);
  });

  routes.post("/:id/next", async (c) => {
    const joustId = joustIdSchema.safeParse(c.req.param("id"));
    if (!joustId.success) return c.json({ error: "joust_not_found" }, 404);
    const result = await nextQuestion(c.var.db, {
      userId: c.var.userId,
      joustId: joustId.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "question":
        return c.json<JoustQuestionResponse>({
          kind: "question",
          position: result.position,
          definition: result.definition,
          choices: [...result.choices],
          servedAt: new Date(result.servedAt).toISOString(),
          deadline: new Date(result.deadline).toISOString(),
        });
      case "run_over":
        await settleAfterRun(c, joustId.data);
        return c.json<JoustQuestionResponse>({ kind: "run_over" });
      case "refused":
        return c.json({ error: result.reason }, 409);
      case "not_found":
        return c.json({ error: "joust_not_found" }, 404);
    }
  });

  routes.post("/:id/answer", async (c) => {
    const joustId = joustIdSchema.safeParse(c.req.param("id"));
    if (!joustId.success) return c.json({ error: "joust_not_found" }, 404);
    const body = answerJoustRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await answerQuestion(c.var.db, {
      userId: c.var.userId,
      joustId: joustId.data,
      ...body.data,
      now: Date.now(),
    });
    switch (result.kind) {
      case "answered":
        if (result.runOver) await settleAfterRun(c, joustId.data);
        return c.json<AnswerJoustResponse>({
          correct: result.correct,
          rightCardId: result.rightCardId,
          late: result.late,
          runOver: result.runOver,
        });
      case "refused":
        return c.json({ error: result.reason }, 409);
      case "not_found":
        return c.json({ error: "joust_not_found" }, 404);
    }
  });

  return routes;
}
