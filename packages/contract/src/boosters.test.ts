import { describe, expect, it } from "vitest";
import {
  boosterStockEmptySchema,
  openBoosterRequestSchema,
  openBoosterResponseSchema,
} from "./boosters";
import { idempotencyKeySchema } from "./common";

describe("booster contract", () => {
  it("accepts a valid open response", () => {
    const response = {
      openId: "0b5d5a8e-8c5c-4a52-9a43-0f2b7f7d1e10",
      cards: [{ cardId: "galimatias", rarity: "precious" }],
      wallet: { stored: 4, nextRefillAt: "2026-10-19T12:30:00.000Z", bonus: 2 },
      progress: {
        xp: 130,
        level: 2,
        xpIntoLevel: 30,
        xpForNextLevel: 120,
        xpGained: 35,
        levelUp: true,
      },
    };
    expect(openBoosterResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects an unknown rarity", () => {
    const result = openBoosterResponseSchema.safeParse({
      openId: "0b5d5a8e-8c5c-4a52-9a43-0f2b7f7d1e10",
      cards: [{ cardId: "galimatias", rarity: "mythic" }],
      wallet: { stored: 4, nextRefillAt: null },
    });
    expect(result.success).toBe(false);
  });

  it("requires a refill time on an empty stock", () => {
    expect(boosterStockEmptySchema.safeParse({ error: "booster_stock_empty" }).success).toBe(false);
  });

  it("only accepts UUIDs as idempotency keys", () => {
    expect(idempotencyKeySchema.safeParse("0b5d5a8e-8c5c-4a52-9a43-0f2b7f7d1e10").success).toBe(
      true,
    );
    expect(idempotencyKeySchema.safeParse("retry-1").success).toBe(false);
  });

  it("accepts a collection or discovery request, and nothing else", () => {
    expect(openBoosterRequestSchema.safeParse({ kind: "discovery" }).success).toBe(true);
    expect(
      openBoosterRequestSchema.safeParse({ kind: "collection", collectionId: "grand-siecle" })
        .success,
    ).toBe(true);
    expect(openBoosterRequestSchema.safeParse({ kind: "collection" }).success).toBe(false);
    expect(
      openBoosterRequestSchema.safeParse({ kind: "collection", collectionId: "Grand Siècle" })
        .success,
    ).toBe(false);
    expect(openBoosterRequestSchema.safeParse({ kind: "mystery" }).success).toBe(false);
  });
});
