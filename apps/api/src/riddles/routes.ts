import {
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type PublicRiddle,
  type RiddleAnswerResponse,
  type RiddleResponse,
  riddleAnswerRequestSchema,
} from "@leximon/contract";
import { Hono } from "hono";
import { z } from "zod";
import { generateSeed } from "../boosters/seed";
import type { CatalogIndexLoader } from "../challenges/catalog-index";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import { refuseLockedWrites } from "../moderation/restrictions";
import { answerRiddle, publicRiddle, todayRiddle } from "./riddles";

/** A century of riddles: past that, a number can only be a typing accident. */
const riddleNumberSchema = z.coerce.number().int().min(1).max(36_500);

const PUBLIC_MAX_AGE_SECONDS = 300;

/** The riddle of the day, and the public page of each riddle. */
export function riddleRoutes(loadCatalogIndex: CatalogIndexLoader) {
  const routes = new Hono<AppEnv>();

  routes.get("/today", requireUser, playerRateLimit, async (c) => {
    const riddle = await todayRiddle(c.var.db, {
      userId: c.var.userId,
      now: Date.now(),
      seed: generateSeed(),
    });
    c.header("Cache-Control", "no-store");
    if (riddle === null) return c.json({ error: "riddle_unavailable" }, 404);
    return c.json<RiddleResponse>(riddle);
  });

  routes.post("/today/answer", requireUser, playerRateLimit, refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) {
      return c.json({ error: "invalid_idempotency_key" }, 400);
    }
    const body = riddleAnswerRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const now = Date.now();
    const catalog = await loadCatalogIndex(c.var.db, now);
    const result = await answerRiddle(c.var.db, catalog.words, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      ...body.data,
      now,
    });
    switch (result.kind) {
      case "answered":
        sendGameEvents(c, [
          ...(result.cardGiven ? [{ type: "cards_obtained" as const, userId: c.var.userId }] : []),
          ...(result.progress.levelUp ? [{ type: "level_up" as const, userId: c.var.userId }] : []),
        ]);
        return c.json<RiddleAnswerResponse>({
          riddle: result.riddle,
          progress: result.progress,
        });
      case "riddle_over":
        return c.json({ error: "riddle_over" }, 409);
    }
  });

  /** Readable without an account: the page a shared result leads to. The CDN keeps it a while. */
  routes.get("/:number", async (c) => {
    const number = riddleNumberSchema.safeParse(c.req.param("number"));
    if (!number.success) {
      return c.json({ error: "riddle_not_found" }, 404);
    }
    const riddle = await publicRiddle(c.var.db, {
      number: number.data,
      now: Date.now(),
      seed: generateSeed(),
    });
    if (riddle === null) return c.json({ error: "riddle_not_found" }, 404);
    c.header("Cache-Control", `public, max-age=${PUBLIC_MAX_AGE_SECONDS}`);
    return c.json<PublicRiddle>(riddle);
  });

  return routes;
}
