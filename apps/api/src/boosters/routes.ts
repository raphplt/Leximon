import {
  type BoosterStockEmptyResponse,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type LevelRequiredResponse,
  type OpenBoosterResponse,
  openBoosterRequestSchema,
  type SignupRequiredResponse,
} from "@leximon/contract";
import { capacityAt, REFILL_SCHEDULE } from "@leximon/core";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { playerRateLimit } from "../middleware/rate-limit";
import { requireUser } from "../middleware/require-user";
import type { CardPoolLoader } from "./card-pool";
import { openBooster } from "./open-booster";
import { generateSeed } from "./seed";

export function boosterRoutes(loadCardPool: CardPoolLoader) {
  const routes = new Hono<AppEnv>();

  routes.post("/open", requireUser, playerRateLimit, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) {
      return c.json({ error: "invalid_idempotency_key" }, 400);
    }
    const body = openBoosterRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }

    const now = Date.now();
    const result = await openBooster(c.var.db, loadCardPool, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      source: body.data,
      now,
      seed: generateSeed(),
    });

    switch (result.kind) {
      case "opened":
        return c.json<OpenBoosterResponse>({
          openId: result.openId,
          cards: [...result.cards],
          wallet: {
            stored: result.wallet.stored,
            nextRefillAt: toIso(result.wallet.nextRefillAt),
            bonus: result.wallet.bonus,
            garni: result.wallet.garni,
            bonusCap: result.wallet.bonusCap,
            capacity: capacityAt(REFILL_SCHEDULE, now),
          },
          progress: result.progress,
        });
      case "stock_empty":
        return c.json<BoosterStockEmptyResponse>(
          {
            error: "booster_stock_empty",
            nextRefillAt: new Date(result.nextRefillAt).toISOString(),
          },
          409,
        );
      case "collection_not_found":
        return c.json({ error: "collection_not_found" }, 404);
      case "level_required":
        return c.json<LevelRequiredResponse>({ error: "level_required", level: result.level }, 403);
      case "guest_archived":
        return c.json({ error: "guest_archived" }, 409);
      case "signup_required":
        return c.json<SignupRequiredResponse>({ error: "signup_required" }, 403);
      case "catalog_empty":
        return c.json({ error: "catalog_unavailable" }, 503);
    }
  });

  return routes;
}

function toIso(time: number | null): string | null {
  return time === null ? null : new Date(time).toISOString();
}
