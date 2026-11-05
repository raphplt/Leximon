import {
  boosterWalletSchema,
  claimLevelRewardResponseSchema,
  levelRewardsResponseSchema,
} from "@leximon/contract";
import { BONUS_SCHEDULE, capacityAt, REFILL_SCHEDULE, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, setXp, signInAsGuest } from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 2 });
const CAPACITY = capacityAt(REFILL_SCHEDULE, Date.now());
const CAP = BONUS_SCHEDULE[0].reserveCap;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

function headers(guest: Guest | null): Record<string, string> {
  const base: Record<string, string> = { origin: TEST_ORIGIN, "content-type": "application/json" };
  return guest === null ? base : { ...base, cookie: guest.cookie };
}

const get = (guest: Guest | null, path: string) =>
  app.request(path, { headers: headers(guest) }, env);
const post = (guest: Guest, path: string, body?: unknown) =>
  app.request(
    path,
    {
      method: "POST",
      headers: headers(guest),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

// The level is the key of a claim: no idempotency header.
const claim = (guest: Guest, level: number) => post(guest, `/me/level-rewards/${level}`);

/** A guest at `level`, with a wallet of `stored` boosters and `bonus` in reserve. */
async function playerAt(level: number, wallet: { stored?: number; bonus?: number } = {}) {
  const guest = await signInAsGuest(app, env);
  await setXp(db, guest.userId, xpToReach(level));
  await db.insert(schema.boosterWallets).values({
    userId: guest.userId,
    stored: wallet.stored ?? CAPACITY - 1,
    progressMs: 0,
    asOf: new Date(),
    bonusBoosters: wallet.bonus ?? 0,
  });
  return guest;
}

async function walletOf(userId: string) {
  const [row] = await db
    .select()
    .from(schema.boosterWallets)
    .where(eq(schema.boosterWallets.userId, userId));
  return row;
}

describe("GET /me/level-rewards", () => {
  it("requires a session and starts empty", async () => {
    expect((await get(null, "/me/level-rewards")).status).toBe(401);
    const guest = await signInAsGuest(app, env);
    const response = await get(guest, "/me/level-rewards");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(levelRewardsResponseSchema.parse(await response.json())).toEqual({
      claimed: [],
    });
  });
});

describe("POST /me/level-rewards/:level", () => {
  it("rejects a malformed level and refuses one not reached", async () => {
    const guest = await playerAt(3);
    expect((await claim(guest, 1)).status).toBe(400);
    expect((await post(guest, "/me/level-rewards/abc")).status).toBe(400);
    const response = await claim(guest, 4);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "level_not_reached" });
  });

  it("puts a bonus booster in the reserve, once, whatever the retries", async () => {
    const guest = await playerAt(3, { bonus: 2 });
    const first = claimLevelRewardResponseSchema.parse(await (await claim(guest, 3)).json());
    expect(first).toMatchObject({ level: 3, rewards: [{ kind: "bonus_booster" }] });
    expect(first.wallet).toMatchObject({ bonus: 3, garni: 0, bonusCap: CAP });

    const replay = claimLevelRewardResponseSchema.parse(await (await claim(guest, 3)).json());
    expect(replay.rewards).toEqual(first.rewards);
    expect((await walletOf(guest.userId))?.bonusBoosters).toBe(3);

    const state = levelRewardsResponseSchema.parse(
      await (await get(guest, "/me/level-rewards")).json(),
    );
    expect(state).toEqual({ claimed: [3] });
  });

  it("is applied once when claims race", async () => {
    const guest = await playerAt(3);
    const responses = await Promise.all(Array.from({ length: 6 }, () => claim(guest, 3)));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect((await walletOf(guest.userId))?.bonusBoosters).toBe(1);
    const rows = await db
      .select()
      .from(schema.userLevelRewards)
      .where(eq(schema.userLevelRewards.userId, guest.userId));
    expect(rows).toHaveLength(1);
  });

  it("leaves the free stock alone: a level never refills it", async () => {
    const guest = await playerAt(2, { stored: 1 });
    const body = claimLevelRewardResponseSchema.parse(await (await claim(guest, 2)).json());
    expect(body.rewards).toEqual([{ kind: "bonus_booster" }]);
    expect(body.wallet).toMatchObject({ stored: 1, bonus: 1 });
    expect((await walletOf(guest.userId))?.stored).toBe(1);
  });

  it("keeps the coffret closed when its boosters do not fit in the reserve", async () => {
    const guest = await playerAt(3, { bonus: CAP });
    const response = await claim(guest, 3);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "reserve_full" });
    expect((await walletOf(guest.userId))?.bonusBoosters).toBe(CAP);
  });

  it("gives a garni booster and a title every 5 levels", async () => {
    const guest = await playerAt(5);
    const body = claimLevelRewardResponseSchema.parse(await (await claim(guest, 5)).json());
    expect(body.rewards).toEqual([
      { kind: "garni_booster" },
      { kind: "title", title: "Lexicographe en herbe" },
    ]);
    expect(body.wallet).toMatchObject({ bonus: 1, garni: 1 });
  });

  it("gives a garni booster and a reserve slot every 10 levels", async () => {
    const guest = await playerAt(10);
    const body = claimLevelRewardResponseSchema.parse(await (await claim(guest, 10)).json());
    expect(body.rewards.map((reward) => reward.kind)).toEqual([
      "garni_booster",
      "reserve_slot",
      "avatar",
      "frame",
      "pinned_slot",
    ]);
    expect(body.rewards).toContainEqual({ kind: "avatar", avatar: "metoposcope" });
    expect(body.wallet).toMatchObject({ bonus: 1, garni: 1, bonusCap: CAP + 1 });
    const wallet = boosterWalletSchema.parse(await (await get(guest, "/me/wallet")).json());
    expect(wallet.bonusCap).toBe(CAP + 1);
  });
});
