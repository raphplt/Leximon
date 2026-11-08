import {
  changeMissionRefusalSchema,
  claimMissionsResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  missionsResponseSchema,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  capacityAt,
  gameDayOf,
  MISSION_SCHEDULE,
  type Mission,
  missionRulesAt,
  REFILL_SCHEDULE,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, setXp, signInAsGuest } from "../test-support";
import { changeDailyMission, claimMissions, readMissions } from "./missions";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 4 });
const CAPACITY = capacityAt(REFILL_SCHEDULE, Date.now());
const CAP = BONUS_SCHEDULE[0].reserveCap;
const DAY = 86_400_000;
const RULES = missionRulesAt(MISSION_SCHEDULE, Date.now());
const SEED = "0123456789abcdef0123456789abcdef";

beforeAll(() => seedTestCatalog(db));
afterAll(close);

function headers(guest: Guest | null, key?: string): Record<string, string> {
  const base: Record<string, string> = { origin: TEST_ORIGIN, "content-type": "application/json" };
  if (guest !== null) base["cookie"] = guest.cookie;
  if (key !== undefined) base[IDEMPOTENCY_KEY_HEADER] = key;
  return base;
}

const read = (guest: Guest | null) => app.request("/me/missions", { headers: headers(guest) }, env);
const claim = (guest: Guest, key = crypto.randomUUID()) =>
  app.request("/me/missions/claim", { method: "POST", headers: headers(guest, key) }, env);
const change = (guest: Guest, slot: number, key = crypto.randomUUID()) =>
  app.request(
    "/me/missions/change",
    { method: "POST", headers: headers(guest, key), body: JSON.stringify({ slot }) },
    env,
  );

/** A guest of level 2 or more, with `bonus` sachets in reserve. */
async function player(bonus = 0) {
  const guest = await signInAsGuest(app, env);
  await setXp(db, guest.userId, 500);
  await db.insert(schema.boosterWallets).values({
    userId: guest.userId,
    stored: CAPACITY,
    progressMs: 0,
    asOf: new Date(),
    bonusBoosters: bonus,
  });
  return guest;
}

/** Sets the missions of a day, as if drawn. */
async function setMissions(guest: Guest, missions: readonly Mission[], time = Date.now()) {
  await db
    .insert(schema.userMissions)
    .values({ userId: guest.userId, day: gameDayOf(time).key, missions, drawnAt: new Date(time) })
    .onConflictDoUpdate({
      target: [schema.userMissions.userId, schema.userMissions.day],
      set: { missions },
    });
}

async function openSachets(guest: Guest, count: number, time = Date.now()) {
  await db.insert(schema.boosterOpens).values(
    Array.from({ length: count }, () => ({
      id: crypto.randomUUID(),
      userId: guest.userId,
      seed: SEED,
      poolFingerprint: "test",
      cards: [],
      openedAt: new Date(time),
    })),
  );
}

async function recycleOnce(guest: Guest, time = Date.now()) {
  await db.insert(schema.ecuMovements).values({
    id: crypto.randomUUID(),
    userId: guest.userId,
    kind: "recycle",
    amount: 1,
    idempotencyKey: crypto.randomUUID(),
    details: { kind: "recycle", cards: [] },
    createdAt: new Date(time),
  });
  await db
    .update(schema.boosterWallets)
    .set({ ecus: 1 })
    .where(eq(schema.boosterWallets.userId, guest.userId));
}

async function rightAnswers(guest: Guest, cardIds: readonly string[], time = Date.now()) {
  await db.insert(schema.reviewLogs).values(
    cardIds.map((cardId) => ({
      id: crypto.randomUUID(),
      userId: guest.userId,
      cardId,
      challengeId: crypto.randomUUID(),
      format: "definition" as const,
      correct: true,
      rating: 3,
      levelAfter: "sketch" as const,
      reviewedAt: new Date(time),
    })),
  );
}

async function walletOf(guest: Guest) {
  const [row] = await db
    .select()
    .from(schema.boosterWallets)
    .where(eq(schema.boosterWallets.userId, guest.userId));
  return row;
}

async function xpOf(guest: Guest) {
  const [row] = await db
    .select({ xp: schema.userProgress.xp })
    .from(schema.userProgress)
    .where(eq(schema.userProgress.userId, guest.userId));
  return row?.xp ?? 0;
}

const THREE: readonly Mission[] = [
  { kind: "open_sachets", target: 3 },
  { kind: "review_collection", target: 3, collectionId: "test-a" },
  { kind: "recycle", target: 1 },
];

describe("GET /me/missions", () => {
  it("requires a session", async () => {
    expect((await read(null)).status).toBe(401);
  });

  it("draws nothing below the level that opens missions", async () => {
    const guest = await signInAsGuest(app, env);
    const response = await read(guest);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(missionsResponseSchema.parse(await response.json())).toMatchObject({
      opensAtLevel: RULES.opensAtLevel,
      day: null,
      missions: [],
    });
  });

  it("draws the day's missions once, the same on every request", async () => {
    const guest = await player();
    const [first, second] = await Promise.all([read(guest), read(guest)]);
    const a = missionsResponseSchema.parse(await first?.json());
    const b = missionsResponseSchema.parse(await second?.json());
    expect(a.day).toBe(gameDayOf(Date.now()).key);
    expect(a.missions.length).toBeGreaterThan(0);
    expect(b.missions).toEqual(a.missions);
    expect(a.canChange).toBe(true);
    expect(a.rewards).toEqual({ xp: 30, ecus: RULES.ecus, allDoneBoosters: 1 });
    const rows = await db
      .select()
      .from(schema.userMissions)
      .where(eq(schema.userMissions.userId, guest.userId));
    expect(rows).toHaveLength(1);
  });

  it("never draws a trade or a joust for a guest, nor a recycling without duplicates", async () => {
    for (let n = 0; n < 5; n++) {
      const guest = await player();
      const body = missionsResponseSchema.parse(await (await read(guest)).json());
      for (const mission of body.missions) {
        expect(["trade", "joust", "recycle"]).not.toContain(mission.kind);
      }
    }
  });

  it("counts the joust runs the player finished today, on either side", async () => {
    const guest = await player();
    const other = await player();
    await setMissions(guest, [{ kind: "joust", target: 2 }]);
    const now = Date.now();
    const joust = (challengerId: string, opponentId: string) => ({
      kind: "friendly" as const,
      challengerId,
      opponentId,
      launchKey: crypto.randomUUID(),
      createdAt: new Date(now - DAY),
    });
    await db.insert(schema.jousts).values([
      { ...joust(guest.userId, other.userId), challengerDoneAt: new Date(now) },
      { ...joust(other.userId, guest.userId), opponentDoneAt: new Date(now) },
      { ...joust(guest.userId, other.userId), challengerDoneAt: new Date(now - 2 * DAY) },
      { ...joust(other.userId, guest.userId), challengerDoneAt: new Date(now) },
    ]);
    const body = missionsResponseSchema.parse(await (await read(guest)).json());
    expect(body.missions.map((m) => [m.kind, m.progress])).toEqual([["joust", 2]]);
  });

  it("reads progress from what the player did today", async () => {
    const guest = await player();
    await setMissions(guest, THREE);
    await openSachets(guest, 4);
    await rightAnswers(guest, ["test-a-common-1", "test-b-common-1"]);
    const body = missionsResponseSchema.parse(await (await read(guest)).json());
    expect(body.missions.map((m) => [m.kind, m.progress, m.claimed])).toEqual([
      ["open_sachets", 3, false],
      ["review_collection", 1, false],
      ["recycle", 0, false],
    ]);
    expect(body.claimable).toEqual({ missions: 1, bonus: 0 });
  });
});

describe("POST /me/missions/claim", () => {
  it("gives XP and écus for each mission done, once, and logs the écus", async () => {
    const guest = await player();
    await setMissions(guest, THREE);
    await openSachets(guest, 3);
    const xp = await xpOf(guest);
    const key = crypto.randomUUID();
    const response = await claim(guest, key);
    expect(response.status).toBe(200);
    const body = claimMissionsResponseSchema.parse(await response.json());
    expect(body).toMatchObject({ missions: 1, ecus: RULES.ecus, boosters: 0, bonusWaiting: false });
    expect(body.progress.xpGained).toBe(30);
    expect(await xpOf(guest)).toBe(xp + 30);
    expect((await walletOf(guest))?.ecus).toBe(RULES.ecus);

    const replay = claimMissionsResponseSchema.parse(await (await claim(guest, key)).json());
    expect(replay).toMatchObject({ missions: 1, ecus: RULES.ecus });
    const again = claimMissionsResponseSchema.parse(await (await claim(guest)).json());
    expect(again).toMatchObject({ missions: 0, ecus: 0 });
    expect((await walletOf(guest))?.ecus).toBe(RULES.ecus);
    const movements = await db
      .select()
      .from(schema.ecuMovements)
      .where(eq(schema.ecuMovements.userId, guest.userId));
    expect(movements.map((m) => [m.kind, m.amount])).toEqual([["mission", 10]]);
  });

  it("adds a bonus sachet once the three missions are claimed", async () => {
    const guest = await player(2);
    await setMissions(guest, THREE);
    await openSachets(guest, 3);
    await rightAnswers(guest, ["test-a-common-1", "test-a-common-2", "test-a-rare-1"]);
    await recycleOnce(guest);
    const body = claimMissionsResponseSchema.parse(await (await claim(guest)).json());
    expect(body).toMatchObject({
      missions: 3,
      ecus: 3 * RULES.ecus,
      boosters: 1,
      bonusWaiting: false,
    });
    expect(body.wallet.bonus).toBe(3);
    expect(await walletOf(guest)).toMatchObject({ bonusBoosters: 3, ecus: 1 + 3 * RULES.ecus });

    const after = missionsResponseSchema.parse(await (await read(guest)).json());
    expect(after.bonusClaimed).toBe(true);
    expect(after.missions.every((m) => m.claimed)).toBe(true);
    expect(after.claimable).toEqual({ missions: 0, bonus: 0 });
  });

  it("keeps the bonus waiting while the reserve is full", async () => {
    const guest = await player(CAP);
    await setMissions(guest, [{ kind: "open_sachets", target: 3 }]);
    await openSachets(guest, 3);
    const body = claimMissionsResponseSchema.parse(await (await claim(guest)).json());
    expect(body).toMatchObject({ missions: 1, boosters: 0, bonusWaiting: true });
    expect(missionsResponseSchema.parse(await (await read(guest)).json()).claimable).toEqual({
      missions: 0,
      bonus: 1,
    });

    await db
      .update(schema.boosterWallets)
      .set({ bonusBoosters: CAP - 1 })
      .where(eq(schema.boosterWallets.userId, guest.userId));
    const later = claimMissionsResponseSchema.parse(await (await claim(guest)).json());
    expect(later).toMatchObject({ missions: 0, ecus: 0, boosters: 1, bonusWaiting: false });
    expect((await walletOf(guest))?.bonusBoosters).toBe(CAP);
  });

  it("still gives a mission done yesterday and not claimed", async () => {
    const guest = await player();
    const yesterday = Date.now() - DAY;
    await setMissions(guest, THREE, yesterday);
    await openSachets(guest, 3, yesterday);
    const body = missionsResponseSchema.parse(await (await read(guest)).json());
    expect(body.claimable.missions).toBe(1);
    const claimed = claimMissionsResponseSchema.parse(await (await claim(guest)).json());
    expect(claimed).toMatchObject({ missions: 1, ecus: RULES.ecus });
  });

  it("gives each mission once when claims race", async () => {
    const guest = await player();
    await setMissions(guest, THREE);
    await openSachets(guest, 3);
    await recycleOnce(guest);
    const bodies = await Promise.all(
      [1, 2, 3, 4].map(async () =>
        claimMissionsResponseSchema.parse(await (await claim(guest)).json()),
      ),
    );
    expect(bodies.reduce((sum, body) => sum + body.missions, 0)).toBe(2);
    expect((await walletOf(guest))?.ecus).toBe(1 + 2 * RULES.ecus);
  });
});

describe("POST /me/missions/change", () => {
  it("changes one mission of the day for another kind, once", async () => {
    const guest = await player();
    await setMissions(guest, THREE);
    const key = crypto.randomUUID();
    const response = await change(guest, 2, key);
    expect(response.status).toBe(200);
    const body = missionsResponseSchema.parse(await response.json());
    expect(body.canChange).toBe(false);
    const kinds = body.missions.map((m) => m.kind);
    expect(kinds.slice(0, 2)).toEqual(["open_sachets", "review_collection"]);
    expect(THREE.map((m) => m.kind)).not.toContain(kinds[2]);

    expect((await change(guest, 2, key)).status).toBe(200);
    const second = await change(guest, 1);
    expect(second.status).toBe(409);
    expect(changeMissionRefusalSchema.parse(await second.json())).toEqual({
      error: "already_changed",
    });
  });

  it("keeps a mission already done", async () => {
    const guest = await player();
    await setMissions(guest, THREE);
    await openSachets(guest, 3);
    const response = await change(guest, 0);
    expect(response.status).toBe(409);
    expect(changeMissionRefusalSchema.parse(await response.json())).toEqual({
      error: "mission_done",
    });
  });

  it("refuses a slot that does not exist", async () => {
    const guest = await player();
    await setMissions(guest, THREE);
    expect((await change(guest, 5)).status).toBe(400);
  });

  it("never loses a claim to a change racing it", async () => {
    const guest = await player();
    await setMissions(guest, THREE);
    await openSachets(guest, 3);
    const now = Date.now();
    const [claimed] = await Promise.all([
      claimMissions(db, { userId: guest.userId, idempotencyKey: crypto.randomUUID(), now }),
      changeDailyMission(db, {
        userId: guest.userId,
        slot: 0,
        idempotencyKey: crypto.randomUUID(),
        now,
        seed: SEED,
      }),
    ]);
    expect(claimed).toMatchObject({ kind: "claimed", missions: 1 });
    const [row] = await db
      .select()
      .from(schema.userMissions)
      .where(
        and(
          eq(schema.userMissions.userId, guest.userId),
          eq(schema.userMissions.day, gameDayOf(now).key),
        ),
      );
    expect(row?.missions[0]?.kind).toBe("open_sachets");
    expect(row?.claimed).toEqual([0]);
    const view = await readMissions(db, guest.userId, { now, seed: SEED });
    expect(view.missions[0]).toMatchObject({ kind: "open_sachets", claimed: true });
  });
});
