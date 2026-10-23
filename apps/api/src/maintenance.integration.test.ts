import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq, lt, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { IDEMPOTENCY_RETENTION_MS, runMaintenance } from "./maintenance";
import { purgeRows } from "./purge";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
afterAll(close);

async function insertOpenWithRequest(userId: string, openedAt: Date): Promise<string> {
  const openId = crypto.randomUUID();
  await db.insert(schema.boosterOpens).values({
    id: openId,
    userId,
    seed: "0".repeat(32),
    poolFingerprint: "test",
    pityCountersBefore: {},
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

  it("purges a batch at a time and counts what went", async () => {
    const userId = `maintenance-${crypto.randomUUID()}`;
    await db
      .insert(schema.users)
      .values({ id: userId, name: "Test", email: `${userId}@test.invalid` });
    const now = Date.now();
    for (let i = 0; i < 5; i++) await insertOpenWithRequest(userId, new Date(now - (i + 1) * 1000));
    await insertOpenWithRequest(userId, new Date(now + 60_000));
    const requests = schema.boosterOpenRequests;
    const mine = eq(requests.userId, userId);

    const purged = await purgeRows(
      db,
      requests,
      sql`${mine} and ${lt(requests.openedAt, new Date(now))}`,
      2,
    );
    expect(purged).toBe(5);
    expect(await db.select().from(requests).where(mine)).toHaveLength(1);
  });

  it("is idempotent", async () => {
    const now = Date.now();
    await runMaintenance(db, now);
    expect((await runMaintenance(db, now)).purgedRequests).toBe(0);
  });
});
