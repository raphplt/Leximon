import {
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeySchema,
  type MissingWordRefusal,
  type MissingWordResponse,
  missingWordRequestSchema,
  type RecycleRefusal,
  type RecycleResponse,
  slugSchema,
} from "@leximon/contract";
import type { RecyclePlan } from "@leximon/core";
import { type Context, Hono } from "hono";
import { generateSeed } from "../boosters/seed";
import { sendGameEvents } from "../clans/events";
import type { AppEnv } from "../context";
import { refuseLockedWrites } from "../moderation/restrictions";
import { buyMissingWord, type RecycleResult, recycleCopy, recycleDuplicates } from "./ecus";

/** Recycling duplicates and buying a missing word, under `/me` (signed-in player, rate limited). */
export function ecuRoutes() {
  const routes = new Hono<AppEnv>();

  routes.post("/recycle", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const result = await recycleDuplicates(c.var.db, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      now: Date.now(),
    });
    return recycleResponse(c, result);
  });

  routes.post("/cards/:cardId/recycle", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const cardId = slugSchema.safeParse(c.req.param("cardId"));
    if (!cardId.success) return c.json({ error: "invalid_request" }, 400);
    const result = await recycleCopy(c.var.db, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      cardId: cardId.data,
      now: Date.now(),
    });
    return recycleResponse(c, result);
  });

  routes.post("/missing-word", refuseLockedWrites, async (c) => {
    const key = idempotencyKeySchema.safeParse(c.req.header(IDEMPOTENCY_KEY_HEADER));
    if (!key.success) return c.json({ error: "invalid_idempotency_key" }, 400);
    const body = missingWordRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const result = await buyMissingWord(c.var.db, {
      userId: c.var.userId,
      idempotencyKey: key.data,
      collectionId: body.data.collectionId,
      rarity: body.data.rarity,
      now: Date.now(),
      seed: generateSeed(),
    });
    switch (result.kind) {
      case "guest_archived":
        return c.json({ error: "guest_archived" }, 409);
      case "refused":
        return c.json<{ error: MissingWordRefusal }>({ error: result.reason }, 409);
      case "bought":
        sendGameEvents(c, [
          { type: "cards_obtained", userId: c.var.userId },
          ...(result.progress.levelUp ? [{ type: "level_up" as const, userId: c.var.userId }] : []),
        ]);
        return c.json<MissingWordResponse>({
          cardId: result.cardId,
          price: result.price,
          wallet: result.wallet,
          progress: result.progress,
          completions: [...result.completions],
        });
    }
  });

  return routes;
}

function recycleResponse(c: Context<AppEnv>, result: RecycleResult) {
  switch (result.kind) {
    case "guest_archived":
      return c.json({ error: "guest_archived" }, 409);
    case "refused":
      return c.json<{ error: RecycleRefusal }>({ error: result.reason }, 409);
    case "recycled":
      return c.json<RecycleResponse>({ ...planResponse(result.plan), wallet: result.wallet });
  }
}

function planResponse(plan: RecyclePlan): Omit<RecycleResponse, "wallet"> {
  return { cards: [...plan.cards], copies: plan.copies, ecus: plan.ecus };
}
