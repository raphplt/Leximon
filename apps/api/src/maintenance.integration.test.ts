import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq, inArray, lt, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  ABANDONED_GUEST_AGE_MS,
  IDEMPOTENCY_RETENTION_MS,
  RESOLVED_REPORT_RETENTION_MS,
  runMaintenance,
} from "./maintenance";
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

  it("erases expired sessions, and the guests no session can reach once they are old", async () => {
    const now = Date.now();
    const old = new Date(now - ABANDONED_GUEST_AGE_MS - 60_000);
    const guest = async (createdAt: Date) => {
      const id = `maintenance-${crypto.randomUUID()}`;
      await db.insert(schema.users).values({
        id,
        name: "",
        email: `${id}@guest.invalid`,
        isAnonymous: true,
        createdAt,
      });
      return id;
    };
    const session = (userId: string, expiresAt: Date) =>
      db.insert(schema.sessions).values({
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        userId,
        expiresAt,
        ipAddress: "203.0.113.7",
      });
    const gone = await guest(old);
    await session(gone, new Date(now - 60_000));
    const stillIn = await guest(old);
    await session(stillIn, new Date(now + 60_000));
    const young = await guest(new Date(now - 60_000));
    const linked = await guest(old);
    const account = await guest(new Date(now));
    await db.update(schema.users).set({ isAnonymous: false }).where(eq(schema.users.id, account));
    await db.insert(schema.guestLinks).values({
      guestId: linked,
      accountId: account,
      outcome: "transfer",
      cards: 0,
      words: 0,
      linkedAt: new Date(now),
    });

    const report = await runMaintenance(db, now);

    expect(report.erasedSessions).toBeGreaterThanOrEqual(1);
    expect(report.erasedGuests).toBeGreaterThanOrEqual(1);
    const left = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.id, [gone, stillIn, young, linked]));
    expect(left.map((row) => row.id).sort()).toEqual([stillIn, young, linked].sort());
    const sessions = await db
      .select({ userId: schema.sessions.userId })
      .from(schema.sessions)
      .where(inArray(schema.sessions.userId, [gone, stillIn]));
    expect(sessions.map((row) => row.userId)).toEqual([stillIn]);
  });

  it("erases reports handled more than a year ago, not the open ones", async () => {
    const now = Date.now();
    const ids: string[] = [];
    for (const suffix of ["a", "b"]) {
      const id = `maintenance-${crypto.randomUUID()}-${suffix}`;
      await db.insert(schema.users).values({ id, name: "", email: `${id}@test.invalid` });
      ids.push(id);
    }
    const [reporterId, reportedId] = ids as [string, string];
    const report = (resolvedAt: Date | null, targetKey: string) =>
      db
        .insert(schema.moderationReports)
        .values({
          id: crypto.randomUUID(),
          reporterId,
          reportedId,
          pseudo: "Quelqu'un",
          targetKey,
          createdAt: new Date(now - RESOLVED_REPORT_RETENTION_MS * 2),
          resolvedAt,
          resolution: resolvedAt === null ? null : "dismissed",
        })
        .returning({ id: schema.moderationReports.id });
    const [old] = await report(new Date(now - RESOLVED_REPORT_RETENTION_MS - 60_000), "old");
    const [open] = await report(null, "open");

    await runMaintenance(db, now);

    const left = await db
      .select({ id: schema.moderationReports.id })
      .from(schema.moderationReports)
      .where(eq(schema.moderationReports.reporterId, reporterId));
    expect(left.map((row) => row.id)).toEqual([open?.id]);
    expect(old).toBeDefined();
  });

  it("is idempotent", async () => {
    const now = Date.now();
    await runMaintenance(db, now);
    expect((await runMaintenance(db, now)).purgedRequests).toBe(0);
  });
});
