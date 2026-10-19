import {
  type BoosterStockEmptyResponse,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type OpenBoosterResponse,
} from "@leximon/contract";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { requireUser } from "../middleware/require-user";
import type { CardPoolLoader } from "./card-pool";
import { openBooster } from "./open-booster";
import { generateSeed } from "./seed";

export function boosterRoutes(loadCardPool: CardPoolLoader) {
  const routes = new Hono<AppEnv>();

  routes.post("/open", requireUser, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) {
      return c.json({ error: "invalid_idempotency_key" }, 400);
    }

    const result = await openBooster(c.var.db, loadCardPool, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      now: Date.now(),
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
          },
        });
      case "stock_empty":
        return c.json<BoosterStockEmptyResponse>(
          {
            error: "booster_stock_empty",
            nextRefillAt: new Date(result.nextRefillAt).toISOString(),
          },
          409,
        );
      case "catalog_empty":
        return c.json({ error: "catalog_unavailable" }, 503);
    }
  });

  return routes;
}

function toIso(time: number | null): string | null {
  return time === null ? null : new Date(time).toISOString();
}
