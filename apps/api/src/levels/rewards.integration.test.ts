import {
  boosterWalletSchema,
  cardChoiceResponseSchema,
  claimLevelRewardResponseSchema,
  levelRewardsResponseSchema,
} from "@leximon/contract";
import { BONUS_SCHEDULE, REFILL_SCHEDULE, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  type Guest,
  seedTestCatalog,
  setOwnedCards,
  setXp,
  signInAsGuest,
  TEST_COLLECTIONS,
} from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 2 });
const CAPACITY = REFILL_SCHEDULE[0].capacity;
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

// The level is the key of a claim, and the level again the key of a choice: no idempotency header.
const claim = (guest: Guest, level: number) => post(guest, `/me/level-rewards/${level}`);
const choose = (guest: Guest, level: number, cardId: string) =>
  post(guest, "/me/card-choices", { level, cardId });

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

async function copies(userId: string, cardId: string) {
  const [row] = await db
    .select({ quantity: schema.userCards.quantity })
    .from(schema.userCards)
    .where(and(eq(schema.userCards.userId, userId), eq(schema.userCards.cardId, cardId)));
  return row?.quantity ?? 0;
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
      cardChoices: [],
    });
  });
});

describe("POST /me/level-rewards/:level (P58)", () => {
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
    expect(state).toEqual({ claimed: [3], cardChoices: [] });
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

  it("refills the free stock, and keeps the coffret closed while the stock is full", async () => {
    const full = await playerAt(2, { stored: CAPACITY });
    const refused = await claim(full, 2);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "stock_full" });

    const guest = await playerAt(2, { stored: 1 });
    const body = claimLevelRewardResponseSchema.parse(await (await claim(guest, 2)).json());
    expect(body.rewards).toEqual([{ kind: "refill" }]);
    expect(body.wallet).toMatchObject({ stored: CAPACITY, nextRefillAt: null });
    expect((await walletOf(guest.userId))?.stored).toBe(CAPACITY);
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

  it("adds a reserve slot and a card choice every 10 levels", async () => {
    const guest = await playerAt(10);
    const body = claimLevelRewardResponseSchema.parse(await (await claim(guest, 10)).json());
    expect(body.rewards.map((reward) => reward.kind)).toEqual([
      "card_choice",
      "reserve_slot",
      "avatar",
      "pinned_slot",
    ]);
    expect(body.wallet.bonusCap).toBe(CAP + 1);
    const wallet = boosterWalletSchema.parse(await (await get(guest, "/me/wallet")).json());
    expect(wallet.bonusCap).toBe(CAP + 1);
    const state = levelRewardsResponseSchema.parse(
      await (await get(guest, "/me/level-rewards")).json(),
    );
    expect(state.cardChoices).toEqual([10]);
  });
});

describe("POST /me/card-choices (P58)", () => {
  async function withChoice() {
    const guest = await playerAt(10);
    expect((await claim(guest, 10)).status).toBe(200);
    return guest;
  }

  it("refuses a level without a card choice claimed", async () => {
    const guest = await playerAt(10);
    const response = await choose(guest, 10, "test-a-common-1");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "no_card_choice" });
    expect((await post(guest, "/me/card-choices", { level: 10 })).status).toBe(400);
  });

  it("gives the chosen card, once per level", async () => {
    const guest = await withChoice();
    const response = await choose(guest, 10, "test-a-common-1");
    expect(response.status).toBe(200);
    expect(cardChoiceResponseSchema.parse(await response.json())).toEqual({
      level: 10,
      cardId: "test-a-common-1",
    });
    expect(await copies(guest.userId, "test-a-common-1")).toBe(1);

    // A retry replays it; another card is refused.
    expect((await choose(guest, 10, "test-a-common-1")).status).toBe(200);
    expect(await copies(guest.userId, "test-a-common-1")).toBe(1);
    const other = await choose(guest, 10, "test-a-uncommon-1");
    expect(other.status).toBe(409);
    expect(await other.json()).toEqual({ error: "already_chosen" });

    const state = levelRewardsResponseSchema.parse(
      await (await get(guest, "/me/level-rewards")).json(),
    );
    expect(state.cardChoices).toEqual([]);
  });

  it.each([
    ["too rare", "test-a-rare-1"],
    ["unpublished", "test-hidden-common-1"],
    ["unknown", "does-not-exist"],
  ])("refuses a card %s", async (_label, cardId) => {
    const guest = await withChoice();
    const response = await choose(guest, 10, cardId);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "card_not_choosable" });
  });

  it("refuses a card already owned while another one is missing", async () => {
    const guest = await withChoice();
    await setOwnedCards(db, guest.userId, [{ cardId: "test-a-common-2", quantity: 1 }]);
    const response = await choose(guest, 10, "test-a-common-2");
    expect(response.status).toBe(422);
  });

  it("allows an owned card once every choosable card is owned", async () => {
    const guest = await withChoice();
    const choosable = TEST_COLLECTIONS.filter((c) => c.published).flatMap((c) =>
      ["common", "uncommon"].flatMap((rarity) => [1, 2, 3].map((n) => `${c.id}-${rarity}-${n}`)),
    );
    await setOwnedCards(
      db,
      guest.userId,
      choosable.map((cardId) => ({ cardId, quantity: 1 })),
    );
    expect((await choose(guest, 10, "test-b-uncommon-3")).status).toBe(200);
    expect(await copies(guest.userId, "test-b-uncommon-3")).toBe(2);
  });

  it("takes only one card when choices race", async () => {
    const guest = await withChoice();
    const cardIds = ["test-a-common-1", "test-a-common-2", "test-a-common-3", "test-b-common-1"];
    const responses = await Promise.all(cardIds.map((cardId) => choose(guest, 10, cardId)));
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
    let total = 0;
    for (const cardId of cardIds) total += await copies(guest.userId, cardId);
    expect(total).toBe(1);
  });
});
