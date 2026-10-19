import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { IDEMPOTENCY_RETENTION_MS, runMaintenance } from "./maintenance";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
afterAll(close);

async function insertOpenWithRequest(userId: string, openedAt: Date): Promise<string> {
  const openId = crypto.randomUUID();
  await db.insert(schema.boosterOpens).values({
    id: openId,
    userId,
    seed: "0".repeat(32),
    poolFingerprint: "test",
    pityCounterBefore: 0,
    cards: [],
    openedAt,
  });
  await db
    .insert(schema.boosterOpenRequests)
    .values({ userId, idempotencyKey: crypto.randomUUID(), openId, openedAt });
  return openId;
}

describe("runMaintenance", () => {
  it("purges idempotency keys older than the retention, keeps recent ones and the journal", async () => {
    const userId = `maintenance-${crypto.randomUUID()}`;
    await db
      .insert(schema.users)
      .values({ id: userId, name: "Test", email: `${userId}@test.invalid` });
    const now = Date.now();
    const oldOpen = await insertOpenWithRequest(
      userId,
      new Date(now - IDEMPOTENCY_RETENTION_MS - 60_000),
    );
    const recentOpen = await insertOpenWithRequest(userId, new Date(now - 60_000));

    const report = await runMaintenance(db, now);
    expect(report.purgedRequests).toBeGreaterThanOrEqual(1);

    const remaining = await db
      .select({ openId: schema.boosterOpenRequests.openId })
      .from(schema.boosterOpenRequests)
      .where(eq(schema.boosterOpenRequests.userId, userId));
    expect(remaining.map((row) => row.openId)).toEqual([recentOpen]);

    const journal = await db
      .select({ id: schema.boosterOpens.id })
      .from(schema.boosterOpens)
      .where(eq(schema.boosterOpens.userId, userId));
    expect(journal.map((row) => row.id).sort()).toEqual([oldOpen, recentOpen].sort());
  });

  it("is idempotent", async () => {
    const now = Date.now();
    await runMaintenance(db, now);
    expect((await runMaintenance(db, now)).purgedRequests).toBe(0);
  });
});
