import {
  carnetRefusalSchema,
  carnetResponseSchema,
  claimCarnetCaseResponseSchema,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  CARNET_SCHEDULE,
  capacityAt,
  carnetPeriodOf,
  carnetRulesAt,
  gameDayOf,
  REFILL_SCHEDULE,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, signInAsGuest, signInAsMember } from "../test-support";
import { claimCarnetCase, readCarnet } from "./carnet";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 4 });
const CAPACITY = capacityAt(REFILL_SCHEDULE, Date.now());
const CAP = BONUS_SCHEDULE[0].reserveCap;
const DAY = 86_400_000;
const RULES = carnetRulesAt(CARNET_SCHEDULE, Date.now());
const SEED = "0123456789abcdef0123456789abcdef";

beforeAll(() => seedTestCatalog(db));
afterAll(close);

function headers(guest: Guest | null): Record<string, string> {
  const base: Record<string, string> = { origin: TEST_ORIGIN };
  return guest === null ? base : { ...base, cookie: guest.cookie };
}

const read = (guest: Guest | null) => app.request("/me/carnet", { headers: headers(guest) }, env);
const claim = (guest: Guest, period: number, caseNumber: number) =>
  app.request(
    `/me/carnet/${period}/${caseNumber}`,
    { method: "POST", headers: headers(guest) },
    env,
  );

/** A member with `bonus` sachets in reserve, whose welcome week ended `endedDaysAgo` days ago. */
async function member(bonus = 0, endedDaysAgo: number | null = 10) {
  const player = await signInAsMember(app, env, db);
  await db.insert(schema.boosterWallets).values({
    userId: player.userId,
    stored: CAPACITY,
    progressMs: 0,
    asOf: new Date(),
    bonusBoosters: bonus,
  });
  if (endedDaysAgo !== null) {
    const ended = Date.now() - endedDaysAgo * DAY;
    await db.insert(schema.userWelcomeDays).values({
      userId: player.userId,
      day: 7,
      rewards: [],
      claimedAt: new Date(ended),
      claimedOn: gameDayOf(ended).key,
    });
  }
  return player;
}

/** One sachet opened on each of these days ago. */
async function playOn(guest: Guest, ...daysAgo: number[]) {
  await db.insert(schema.boosterOpens).values(
    daysAgo.map((ago) => ({
      id: crypto.randomUUID(),
      userId: guest.userId,
      seed: SEED,
      poolFingerprint: "test",
      cards: [],
      openedAt: new Date(Date.now() - ago * DAY),
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

/** Days ago that fall in the current period, today first, at most `count`. */
function daysInPeriod(count: number): number[] {
  const period = carnetPeriodOf(RULES, gameDayOf(Date.now()).key);
  const days: number[] = [];
  for (let ago = 0; days.length < count && ago < RULES.periodDays; ago++) {
    if (gameDayOf(Date.now() - ago * DAY).key >= period.firstDay) days.push(ago);
  }
  return days;
}

describe("GET /me/carnet", () => {
  it("requires a session", async () => {
    expect((await read(null)).status).toBe(401);
  });

  it("is closed to a guest, who needs an account", async () => {
    const guest = await signInAsGuest(app, env);
    await playOn(guest, 0);
    const body = carnetResponseSchema.parse(await (await read(guest)).json());
    expect(body).toMatchObject({ account: false, started: false, next: null, waiting: 0 });
    const response = await claim(guest, body.period.index, 1);
    expect(response.status).toBe(409);
    expect(carnetRefusalSchema.parse(await response.json())).toEqual({
      error: "account_required",
    });
  });

  it("waits for the end of the welcome week", async () => {
    const player = await member(0, null);
    await playOn(player, 0, 1);
    const body = carnetResponseSchema.parse(await (await read(player)).json());
    expect(body).toMatchObject({ account: true, started: false, earned: 0, next: null });
    expect(body.cases).toHaveLength(RULES.periodDays);
  });

  it("fills a case per day played after the welcome week, not the day it ended", async () => {
    const days = daysInPeriod(2);
    const player = await member(0, 0);
    await playOn(player, ...days);
    const today = carnetResponseSchema.parse(await (await read(player)).json());
    expect(today).toMatchObject({ started: true, earned: 0, next: null });
  });
});

describe("POST /me/carnet/:period/:case", () => {
  it("gives a case's écus, in order, once, and logs them", async () => {
    const days = daysInPeriod(2);
    const player = await member(0, 20);
    await playOn(player, ...days, ...days);
    const before = carnetResponseSchema.parse(await (await read(player)).json());
    const { index } = before.period;
    expect(before).toMatchObject({
      earned: days.length,
      claimed: 0,
      next: { period: index, case: 1 },
    });

    if (days.length > 1) {
      expect((await claim(player, index, 2)).status).toBe(409);
    }
    const response = await claim(player, index, 1);
    expect(response.status).toBe(200);
    const body = claimCarnetCaseResponseSchema.parse(await response.json());
    expect(body.rewards).toEqual([{ kind: "ecus", amount: 10 }]);
    expect(body.wallet.ecus).toBe(10);
    const replay = claimCarnetCaseResponseSchema.parse(
      await (await claim(player, index, 1)).json(),
    );
    expect(replay.rewards).toEqual(body.rewards);
    expect((await walletOf(player))?.ecus).toBe(10);
    const movements = await db
      .select()
      .from(schema.ecuMovements)
      .where(eq(schema.ecuMovements.userId, player.userId));
    expect(movements.map((m) => [m.kind, m.amount])).toEqual([["carnet", 10]]);
  });

  it("refuses a case not earned yet", async () => {
    const player = await member(0, 20);
    await playOn(player, ...daysInPeriod(1));
    const { period } = carnetResponseSchema.parse(await (await read(player)).json());
    expect((await claim(player, period.index, 1)).status).toBe(200);
    const response = await claim(player, period.index, 2);
    expect(response.status).toBe(409);
    expect(carnetRefusalSchema.parse(await response.json())).toEqual({ error: "not_open" });
  });

  it("keeps the cases of an ended period to claim, oldest first", async () => {
    const player = await member(0, 60);
    const period = carnetPeriodOf(RULES, gameDayOf(Date.now()).key);
    const lastDayBefore = Math.round(
      (Date.now() - Date.parse(`${period.firstDay}T12:00:00Z`)) / DAY + 1,
    );
    await playOn(player, lastDayBefore, lastDayBefore + 1, 0);
    const body = carnetResponseSchema.parse(await (await read(player)).json());
    expect(body.next).toEqual({ period: period.index - 1, case: 1 });
    expect(body.waiting).toBe(3);
    expect((await claim(player, period.index - 1, 1)).status).toBe(200);
  });

  it("keeps a sachet case closed while the reserve is full", async () => {
    const player = await member(CAP, 20);
    const userId = player.userId;
    const { index } = carnetPeriodOf(RULES, gameDayOf(Date.now()).key);
    await db
      .insert(schema.userCarnetCases)
      .values(
        [1, 2].map((n) => ({ userId, period: index, case: n, rewards: [], claimedAt: new Date() })),
      );
    const days = daysInPeriod(3);
    // Too early in a period to have played three of its days: nothing to check.
    if (days.length < 3) return;
    await playOn(player, ...days);
    const response = await claim(player, index, 3);
    expect(response.status).toBe(409);
    expect(carnetRefusalSchema.parse(await response.json())).toEqual({ error: "reserve_full" });
    expect((await walletOf(player))?.bonusBoosters).toBe(CAP);
  });

  it("gives a case once when claims race", async () => {
    const player = await member(0, 20);
    await playOn(player, ...daysInPeriod(1));
    const now = Date.now();
    const { index } = carnetPeriodOf(RULES, gameDayOf(now).key);
    const results = await Promise.all(
      [1, 2, 3, 4].map(() =>
        claimCarnetCase(db, { userId: player.userId, period: index, case: 1, now }),
      ),
    );
    expect(results.every((result) => result.kind === "claimed")).toBe(true);
    expect((await walletOf(player))?.ecus).toBe(10);
    const after = await readCarnet(db, player.userId, now);
    expect(after).toMatchObject({ claimed: 1, waiting: 0 });
  });
});
