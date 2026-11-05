import {
  claimWelcomeDayResponseSchema,
  profileResponseSchema,
  welcomeRefusalSchema,
  welcomeWeekResponseSchema,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  capacityAt,
  REFILL_SCHEDULE,
  WELCOME_SCHEDULE,
  welcomeRulesAt,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, signInAsGuest, signInAsMember } from "../test-support";
import { claimWelcomeDay } from "./welcome";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 2 });
const CAPACITY = capacityAt(REFILL_SCHEDULE, Date.now());
const CAP = BONUS_SCHEDULE[0].reserveCap;
const DAY = 86_400_000;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

function headers(guest: Guest | null): Record<string, string> {
  const base: Record<string, string> = { origin: TEST_ORIGIN };
  return guest === null ? base : { ...base, cookie: guest.cookie };
}

const week = (guest: Guest | null) => app.request("/me/welcome", { headers: headers(guest) }, env);
// The day is the key of a claim: no idempotency header.
const claim = (guest: Guest, day: number) =>
  app.request(`/me/welcome/${day}`, { method: "POST", headers: headers(guest) }, env);

/** A member with `bonus` boosters in reserve. */
async function member(bonus = 0) {
  const player = await signInAsMember(app, env, db);
  await db.insert(schema.boosterWallets).values({
    userId: player.userId,
    stored: CAPACITY,
    progressMs: 0,
    asOf: new Date(),
    bonusBoosters: bonus,
  });
  return player;
}

async function walletOf(userId: string) {
  const [row] = await db
    .select()
    .from(schema.boosterWallets)
    .where(eq(schema.boosterWallets.userId, userId));
  return row;
}

/** Claims the days `from` to `to`, a calendar day apart, the first one `start`. */
async function claimDays(userId: string, from: number, to: number, start: number) {
  for (let day = from; day <= to; day++) {
    const result = await claimWelcomeDay(db, {
      userId,
      day,
      now: start + (day - from) * DAY,
    });
    expect(result.kind).toBe("claimed");
  }
}

describe("GET /me/welcome", () => {
  it("requires a session", async () => {
    expect((await week(null)).status).toBe(401);
  });

  it("opens the first day to a member who claimed nothing", async () => {
    const player = await member();
    const response = await week(player);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(welcomeWeekResponseSchema.parse(await response.json())).toEqual({
      days: welcomeRulesAt(WELCOME_SCHEDULE, Date.now()).days,
      claimed: 0,
      open: true,
      account: true,
    });
  });

  it("shows the week to a guest, who needs an account to claim it", async () => {
    const guest = await signInAsGuest(app, env);
    const body = welcomeWeekResponseSchema.parse(await (await week(guest)).json());
    expect(body).toMatchObject({ claimed: 0, account: false });

    const response = await claim(guest, 1);
    expect(response.status).toBe(409);
    expect(welcomeRefusalSchema.parse(await response.json())).toEqual({
      error: "account_required",
    });
  });
});

describe("POST /me/welcome/:day", () => {
  it("gives the first day's sachets to the reserve, then waits for tomorrow", async () => {
    const player = await member(1);
    const response = await claim(player, 1);
    expect(response.status).toBe(200);
    const body = claimWelcomeDayResponseSchema.parse(await response.json());
    expect(body.rewards).toEqual([{ kind: "bonus_booster" }, { kind: "bonus_booster" }]);
    expect(body.wallet).toMatchObject({ bonus: 3, garni: 0 });
    expect((await walletOf(player.userId))?.bonusBoosters).toBe(3);

    const after = welcomeWeekResponseSchema.parse(await (await week(player)).json());
    expect(after).toMatchObject({ claimed: 1, open: false });
    const second = await claim(player, 2);
    expect(second.status).toBe(409);
    expect(welcomeRefusalSchema.parse(await second.json())).toEqual({ error: "not_open" });
  });

  it("replays a day already claimed, without giving it twice", async () => {
    const player = await member();
    const first = claimWelcomeDayResponseSchema.parse(await (await claim(player, 1)).json());
    const again = claimWelcomeDayResponseSchema.parse(await (await claim(player, 1)).json());
    expect(again.rewards).toEqual(first.rewards);
    expect((await walletOf(player.userId))?.bonusBoosters).toBe(2);
  });

  it("claims a day once under concurrent requests", async () => {
    const player = await member();
    const responses = await Promise.all(Array.from({ length: 6 }, () => claim(player, 1)));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect((await walletOf(player.userId))?.bonusBoosters).toBe(2);
    const rows = await db
      .select()
      .from(schema.userWelcomeDays)
      .where(eq(schema.userWelcomeDays.userId, player.userId));
    expect(rows).toHaveLength(1);
  });

  it("refuses a day out of order", async () => {
    const player = await member();
    const response = await claim(player, 3);
    expect(response.status).toBe(409);
    expect(welcomeRefusalSchema.parse(await response.json())).toEqual({ error: "not_open" });
  });

  it("keeps the day closed while its sachets do not fit in the reserve", async () => {
    const player = await member(CAP - 1);
    const response = await claim(player, 1);
    expect(response.status).toBe(409);
    expect(welcomeRefusalSchema.parse(await response.json())).toEqual({ error: "reserve_full" });
    expect((await walletOf(player.userId))?.bonusBoosters).toBe(CAP - 1);
  });

  it("rejects a malformed day", async () => {
    const player = await member();
    expect((await claim(player, 0)).status).toBe(400);
  });
});

describe("the whole week", () => {
  it("gives a day each day the player comes, skipped days included, the best one last", async () => {
    const player = await member();
    const start = Date.now() - 20 * DAY;
    await claimDays(player.userId, 1, 3, start);
    // Days 4 to 7 come after a week away.
    await claimDays(player.userId, 4, 6, start + 10 * DAY);

    const wallet = await walletOf(player.userId);
    expect(wallet).toMatchObject({ bonusBoosters: 8, garniBoosters: 2, preciousBoosters: 0 });
    // Spent meanwhile, so that the last day fits.
    await db
      .update(schema.boosterWallets)
      .set({ bonusBoosters: 0, garniBoosters: 0 })
      .where(eq(schema.boosterWallets.userId, player.userId));

    const last = await claim(player, 7);
    expect(last.status).toBe(200);
    expect(claimWelcomeDayResponseSchema.parse(await last.json()).wallet).toMatchObject({
      bonus: 1,
      garni: 1,
    });
    expect((await walletOf(player.userId))?.preciousBoosters).toBe(1);
    expect(welcomeWeekResponseSchema.parse(await (await week(player)).json())).toMatchObject({
      claimed: 7,
      open: false,
    });
  });

  it("adds its avatar and its title to the profile", async () => {
    const player = await member();
    await claimDays(player.userId, 1, 7, Date.now() - 6 * DAY);
    const response = await app.request("/me/profile", { headers: headers(player) }, env);
    const profile = profileResponseSchema.parse(await response.json());
    expect(profile.wardrobe.avatars).toContain("bejaune");
    expect(profile.wardrobe.titles).toContain("Habitué des rayons");
    expect(profile.title).toBe("Habitué des rayons");
  });
});
