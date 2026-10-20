import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq, sql } from "drizzle-orm";
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

  it("drops the months of the event log past their retention, and only them", async () => {
    await db.execute(sql`
      create table if not exists analytics_events_2001_01 partition of analytics_events
      for values from ('2001-01-01T00:00:00Z') to ('2001-02-01T00:00:00Z')`);
    const report = await runMaintenance(db, Date.now());
    expect(report.droppedAnalyticsMonths).toBe(1);
    const { rows } = await db.execute<{ name: string }>(sql`
      select child.relname as name from pg_inherits
      join pg_class parent on parent.oid = pg_inherits.inhparent
      join pg_class child on child.oid = pg_inherits.inhrelid
      where parent.relname = 'analytics_events'`);
    const names = rows.map((row) => row.name);
    expect(names).not.toContain("analytics_events_2001_01");
    expect(names).toContain(
      `analytics_events_${new Date().toISOString().slice(0, 7).replace("-", "_")}`,
    );
  });

  it("is idempotent", async () => {
    const now = Date.now();
    await runMaintenance(db, now);
    expect((await runMaintenance(db, now)).purgedRequests).toBe(0);
  });
});
