import {
  boosterWalletSchema,
  IDEMPOTENCY_KEY_HEADER,
  type OwnedCardsResponse,
  ownedCardsResponseSchema,
  profileResponseSchema,
  tradeableCardsResponseSchema,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  capacityAt,
  computeRefill,
  createFullWallet,
  REFILL_SCHEDULE,
  xpToReach,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { count, eq, sum } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  type Guest,
  STARTER_COLLECTION,
  seedTestCatalog,
  setOwnedCards,
  setXp,
  signInAsGuest,
  signInAsMember,
} from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 1 });
const CAPACITY = capacityAt(REFILL_SCHEDULE, Date.now());

beforeAll(() => seedTestCatalog(db));
afterAll(close);

function get(guest: Guest | null, path: string) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN };
  if (guest !== null) headers["cookie"] = guest.cookie;
  return app.request(path, { headers }, env);
}

async function open(guest: Guest, collectionId?: string) {
  const response = await app.request(
    "/boosters/open",
    {
      method: "POST",
      headers: {
        origin: TEST_ORIGIN,
        cookie: guest.cookie,
        "content-type": "application/json",
        [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
      },
      body: JSON.stringify({
        kind: "collection",
        collectionId: collectionId ?? STARTER_COLLECTION,
      }),
    },
    env,
  );
  expect(response.status).toBe(200);
}

/** When a full stock gains its next booster, as the rules compute it: `null` unless the capacity rises. */
function fullStockRefill(): string | null {
  const now = Date.now();
  const { nextRefillAt } = computeRefill(
    createFullWallet(REFILL_SCHEDULE, now),
    REFILL_SCHEDULE,
    now,
  );
  return nextRefillAt === null ? null : new Date(nextRefillAt).toISOString();
}

describe("GET /me/wallet", () => {
  it("requires a session", async () => {
    expect((await get(null, "/me/wallet")).status).toBe(401);
  });

  it("shows a full stock to a new player, without writing anything", async () => {
    const guest = await signInAsGuest(app, env);
    const response = await get(guest, "/me/wallet");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(boosterWalletSchema.parse(await response.json())).toEqual({
      stored: CAPACITY,
      // Full, so nothing is pending, unless a raised capacity is already scheduled.
      nextRefillAt: fullStockRefill(),
      bonus: 0,
      garni: 0,
      bonusCap: BONUS_SCHEDULE[0].reserveCap,
      capacity: CAPACITY,
    });
    const [row] = await db
      .select({ total: count() })
      .from(schema.boosterWallets)
      .where(eq(schema.boosterWallets.userId, guest.userId));
    expect(row?.total).toBe(0);
  });

  it("reflects opened boosters and the next refill", async () => {
    const guest = await signInAsGuest(app, env);
    await open(guest);
    const body = boosterWalletSchema.parse(await (await get(guest, "/me/wallet")).json());
    expect(body.stored).toBe(CAPACITY - 1);
    expect(Date.parse(body.nextRefillAt ?? "")).toBeGreaterThan(Date.now());
  });
});

describe("GET /me/cards", () => {
  it("requires a session", async () => {
    expect((await get(null, "/me/cards")).status).toBe(401);
  });

  it("lists every owned copy, across pages, in a stable order", async () => {
    const guest = await signInAsMember(app, env, db);
    for (let i = 0; i < 3; i++) await open(guest);

    const pages: OwnedCardsResponse[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor === null ? "limit=2" : `limit=2&cursor=${cursor}`;
      const page = ownedCardsResponseSchema.parse(
        await (await get(guest, `/me/cards?${query}`)).json(),
      );
      pages.push(page);
      cursor = page.nextCursor;
    } while (cursor !== null);

    const listed = pages.flatMap((page) => page.cards);
    const ids = listed.map((card) => card.cardId);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(new Set(ids).size).toBe(ids.length);

    const [owned] = await db
      .select({ total: sum(schema.userCards.quantity) })
      .from(schema.userCards)
      .where(eq(schema.userCards.userId, guest.userId));
    expect(listed.reduce((total, card) => total + card.quantity, 0)).toBe(Number(owned?.total));
  });

  it("filters by collection", async () => {
    const guest = await signInAsGuest(app, env);
    // Choosing the collection of a booster opens at level 3.
    await setXp(db, guest.userId, xpToReach(3));
    await open(guest, "test-a");
    await open(guest, "test-b");

    const body = ownedCardsResponseSchema.parse(
      await (await get(guest, "/me/cards?collectionId=test-a")).json(),
    );
    expect(body.cards.length).toBeGreaterThan(0);
    expect(body.cards.every((card) => card.cardId.startsWith("test-a-"))).toBe(true);
  });

  it("returns an empty first page to a new player", async () => {
    const guest = await signInAsGuest(app, env);
    const body = ownedCardsResponseSchema.parse(await (await get(guest, "/me/cards")).json());
    expect(body).toEqual({ cards: [], nextCursor: null });
  });

  it.each([
    ["limit too high", "/me/cards?limit=10000"],
    ["invalid collection id", "/me/cards?collectionId=Not%20A%20Slug"],
    ["malformed cursor", "/me/cards?cursor=%%%"],
  ])("rejects an invalid query: %s", async (_label, path) => {
    const guest = await signInAsGuest(app, env);
    expect((await get(guest, path)).status).toBe(400);
  });
});

describe("POST /me/cards/:cardId/read", () => {
  function markRead(guest: Guest | null, cardId: string) {
    const headers: Record<string, string> = { origin: TEST_ORIGIN };
    if (guest !== null) headers["cookie"] = guest.cookie;
    return app.request(`/me/cards/${cardId}/read`, { method: "POST", headers }, env);
  }

  async function ownedCards(guest: Guest) {
    return ownedCardsResponseSchema.parse(await (await get(guest, "/me/cards")).json()).cards;
  }

  it("requires a session", async () => {
    expect((await markRead(null, "test-a-common-1")).status).toBe(401);
  });

  it("lists the cards of a booster as new, until their sheet is opened", async () => {
    const guest = await signInAsGuest(app, env);
    await open(guest);
    const before = await ownedCards(guest);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((card) => card.readAt === null)).toBe(true);

    const [first] = before;
    if (first === undefined) throw new Error("no card");
    expect((await markRead(guest, first.cardId)).status).toBe(204);

    const after = await ownedCards(guest);
    for (const card of after) {
      if (card.cardId === first.cardId) expect(card.readAt).not.toBeNull();
      else expect(card.readAt).toBeNull();
    }
  });

  it("keeps the first read mark when asked again, even at the same time", async () => {
    const guest = await signInAsGuest(app, env);
    await setOwnedCards(db, guest.userId, [{ cardId: "test-a-common-1", quantity: 1 }]);

    const answers = await Promise.all(
      Array.from({ length: 5 }, () => markRead(guest, "test-a-common-1")),
    );
    expect(answers.map((answer) => answer.status)).toEqual([204, 204, 204, 204, 204]);
    const [first] = await ownedCards(guest);
    expect(first?.readAt).not.toBeNull();

    await markRead(guest, "test-a-common-1");
    const [again] = await ownedCards(guest);
    expect(again?.readAt).toBe(first?.readAt);
  });

  it("writes nothing for a card the player does not own", async () => {
    const guest = await signInAsGuest(app, env);
    expect((await markRead(guest, "test-a-common-1")).status).toBe(204);
    const [row] = await db
      .select({ total: count() })
      .from(schema.userCards)
      .where(eq(schema.userCards.userId, guest.userId));
    expect(row?.total).toBe(0);
  });

  it("rejects a malformed card id", async () => {
    const guest = await signInAsGuest(app, env);
    expect((await markRead(guest, "Not%20A%20Slug")).status).toBe(400);
  });
});

describe("GET /me/profile", () => {
  it("requires a session", async () => {
    expect((await get(null, "/me/profile")).status).toBe(401);
  });

  it("creates the player code on first request and keeps it", async () => {
    const guest = await signInAsGuest(app, env);
    const response = await get(guest, "/me/profile");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const profile = profileResponseSchema.parse(await response.json());
    expect(profile.playerCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);

    const again = profileResponseSchema.parse(await (await get(guest, "/me/profile")).json());
    expect(again).toEqual(profile);
  });

  it("creates a single code under concurrent first requests", async () => {
    const guest = await signInAsGuest(app, env);
    const responses = await Promise.all(Array.from({ length: 5 }, () => get(guest, "/me/profile")));
    const codes = await Promise.all(
      responses.map(
        async (response) => profileResponseSchema.parse(await response.json()).playerCode,
      ),
    );
    expect(new Set(codes).size).toBe(1);
    const [row] = await db
      .select({ total: count() })
      .from(schema.players)
      .where(eq(schema.players.userId, guest.userId));
    expect(row?.total).toBe(1);
  });
});

describe("GET /me/tradeable", () => {
  it("requires a session", async () => {
    expect((await get(null, "/me/tradeable")).status).toBe(401);
  });

  it("lists the player's own duplicates that can be given now, sorted by card", async () => {
    const guest = await signInAsGuest(app, env);
    const recently = new Date(Date.now() - 60_000);
    await setOwnedCards(db, guest.userId, [
      { cardId: "test-b-common-1", quantity: 2 },
      { cardId: "test-a-rare-1", quantity: 5, lastObtainedAt: recently },
      { cardId: "test-a-common-1", quantity: 1 },
      { cardId: "test-a-legendary-1", quantity: 2, lastObtainedAt: recently },
      { cardId: "test-a-epic-1", quantity: 2 },
    ]);

    const response = await get(guest, "/me/tradeable");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = tradeableCardsResponseSchema.parse(await response.json());
    const profile = profileResponseSchema.parse(await (await get(guest, "/me/profile")).json());
    expect(body).toEqual({
      playerCode: profile.playerCode,
      cardIds: ["test-a-epic-1", "test-a-rare-1", "test-b-common-1"],
      level: 1,
      player: expect.objectContaining({ code: profile.playerCode, pseudo: null, level: 1 }),
      maxCardsPerSide: 0,
      held: [
        {
          cardId: "test-a-legendary-1",
          tradeableFrom: new Date(recently.getTime() + 7 * 86_400_000).toISOString(),
        },
      ],
    });
  });
});

describe("player rate limit", () => {
  it("answers 429 once the player is over the limit, keyed by player", async () => {
    const guest = await signInAsGuest(app, env);
    const keys: string[] = [];
    const limited: Env = {
      ...env,
      PLAYER_RATE_LIMITER: {
        limit: async ({ key }) => {
          keys.push(key);
          return { success: false };
        },
      },
    };
    const response = await app.request(
      "/me/wallet",
      { headers: { origin: TEST_ORIGIN, cookie: guest.cookie } },
      limited,
    );
    expect(response.status).toBe(429);
    expect(keys).toEqual([`PLAYER_RATE_LIMITER:${guest.userId}`]);
  });
});
