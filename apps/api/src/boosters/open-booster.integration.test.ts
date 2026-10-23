import {
  accountResponseSchema,
  type BoosterSource,
  boosterStockEmptySchema,
  IDEMPOTENCY_KEY_HEADER,
  levelRequiredSchema,
  openBoosterResponseSchema,
  progressResponseSchema,
  signupRequiredSchema,
} from "@leximon/contract";
import {
  byRarity,
  createSeededRandom,
  DRAW_SCHEDULE,
  drawBooster,
  drawRulesAt,
  GUEST_SCHEDULE,
  isAtLeast,
  REFILL_SCHEDULE,
  XP_SCHEDULE,
  xpToReach,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, count, eq, isNotNull, isNull, type Logger, sum } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  type Guest,
  STARTER_COLLECTION,
  seedTestCatalog,
  setXp,
  signInAsGuest,
  signInAsMember,
} from "../test-support";
import { createCardPoolLoader, fingerprintPool } from "./card-pool";
import { openBooster as openBoosterService } from "./open-booster";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 2 });
const CAPACITY = REFILL_SCHEDULE[0].capacity;

beforeAll(() => seedTestCatalog(db));

afterAll(close);

const STARTER: BoosterSource = { kind: "collection", collectionId: STARTER_COLLECTION };
/** Level 3 opens the choice of collection. */
const LEVEL_3_XP = xpToReach(3);
const signInAsPlayer = () => signInAsMember(app, env, db);

function openBooster(
  guest: Guest | null,
  key: string | null = crypto.randomUUID(),
  body: unknown = STARTER,
  target = app,
) {
  const headers: Record<string, string> = {
    origin: TEST_ORIGIN,
    "content-type": "application/json",
  };
  if (guest !== null) headers["cookie"] = guest.cookie;
  if (key !== null) headers[IDEMPOTENCY_KEY_HEADER] = key;
  return target.request(
    "/boosters/open",
    { method: "POST", headers, body: JSON.stringify(body) },
    env,
  );
}

async function ownedCopies(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(schema.userCards.quantity) })
    .from(schema.userCards)
    .where(eq(schema.userCards.userId, userId));
  return Number(row?.total ?? 0);
}

async function openCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(schema.boosterOpens)
    .where(eq(schema.boosterOpens.userId, userId));
  return row?.total ?? 0;
}

describe("POST /boosters/open", () => {
  it("requires a session", async () => {
    const response = await openBooster(null);
    expect(response.status).toBe(401);
  });

  it("requires a UUID idempotency key", async () => {
    const guest = await signInAsPlayer();
    expect((await openBooster(guest, null)).status).toBe(400);
    expect((await openBooster(guest, "retry-1")).status).toBe(400);
  });

  it("opens a booster for a new player, who starts with a full stock", async () => {
    const guest = await signInAsPlayer();
    const response = await openBooster(guest);

    expect(response.status).toBe(200);
    const body = openBoosterResponseSchema.parse(await response.json());
    expect(body.cards).toHaveLength(5);
    expect(body.wallet.stored).toBe(CAPACITY - 1);
    expect(body.wallet.nextRefillAt).not.toBeNull();
    expect(await ownedCopies(guest.userId)).toBe(5);
    expect(await openCount(guest.userId)).toBe(1);
  });

  it("returns the same booster when a request is retried with the same key", async () => {
    const guest = await signInAsPlayer();
    const key = crypto.randomUUID();

    const first = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());
    const retry = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());

    expect(retry.openId).toBe(first.openId);
    expect(retry.cards).toEqual(first.cards);
    expect(retry.wallet.stored).toBe(CAPACITY - 1);
    expect(await openCount(guest.userId)).toBe(1);
    // The XP is counted once: the retry shows the same total, without a new gain.
    expect(retry.progress).toEqual({ ...first.progress, xpGained: 0, levelUp: false });
  });

  it("refuses to open once the stock is empty, with the next refill time", async () => {
    const guest = await signInAsPlayer();
    for (let i = 0; i < CAPACITY; i++) {
      expect((await openBooster(guest)).status).toBe(200);
    }

    const response = await openBooster(guest);
    expect(response.status).toBe(409);
    const body = boosterStockEmptySchema.parse(await response.json());
    expect(Date.parse(body.nextRefillAt)).toBeGreaterThan(Date.now());
  });

  it("serializes concurrent opens: never more boosters than the stock", async () => {
    const guest = await signInAsPlayer();
    const attempts = CAPACITY + 4;

    const responses = await Promise.all(Array.from({ length: attempts }, () => openBooster(guest)));
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses.filter((status) => status === 200)).toHaveLength(CAPACITY);
    expect(statuses.filter((status) => status === 409)).toHaveLength(attempts - CAPACITY);
    expect(await openCount(guest.userId)).toBe(CAPACITY);
    expect(await ownedCopies(guest.userId)).toBe(CAPACITY * 5);
  });

  it("opens only once when the same key is sent concurrently", async () => {
    const guest = await signInAsPlayer();
    const key = crypto.randomUUID();

    const responses = await Promise.all(Array.from({ length: 5 }, () => openBooster(guest, key)));
    const bodies = await Promise.all(
      responses.map(async (response) => {
        expect(response.status).toBe(200);
        return openBoosterResponseSchema.parse(await response.json());
      }),
    );

    expect(new Set(bodies.map((body) => body.openId)).size).toBe(1);
    expect(await openCount(guest.userId)).toBe(1);
    expect(await ownedCopies(guest.userId)).toBe(5);
  });
});

describe("experience", () => {
  const XP = XP_SCHEDULE[0];

  it("pays the open, the first open of the day and every word new to the player", async () => {
    const guest = await signInAsPlayer();
    const first = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
    const firstWords = new Map(first.cards.map((card) => [card.cardId, card.rarity]));
    const expected =
      XP.boosterOpened +
      XP.firstBoosterOfDay +
      [...firstWords.values()].reduce((sum, rarity) => sum + XP.newWord[rarity], 0);
    expect(first.progress).toMatchObject({ xp: expected, xpGained: expected });

    const second = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
    const newWords = [...new Map(second.cards.map((card) => [card.cardId, card.rarity]))].filter(
      ([cardId]) => !firstWords.has(cardId),
    );
    const gained =
      XP.boosterOpened + newWords.reduce((sum, [, rarity]) => sum + XP.newWord[rarity], 0);
    expect(second.progress).toMatchObject({ xp: expected + gained, xpGained: gained });
  });

  it("is shown by GET /me/progress, at level 1 before any gain", async () => {
    const guest = await signInAsPlayer();
    const read = async () =>
      progressResponseSchema.parse(
        await (
          await app.request(
            "/me/progress",
            { headers: { origin: TEST_ORIGIN, cookie: guest.cookie } },
            env,
          )
        ).json(),
      );
    expect(await read()).toEqual({ xp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: xpToReach(2) });

    const opened = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
    const { xpGained: _gained, levelUp: _levelUp, ...progress } = opened.progress;
    expect(await read()).toEqual(progress);
  });

  it("adds up exactly under concurrent opens", async () => {
    const guest = await signInAsPlayer();
    const responses = await Promise.all(
      Array.from({ length: 3 }, async () =>
        openBoosterResponseSchema.parse(await (await openBooster(guest)).json()),
      ),
    );
    const gained = responses.reduce((sum, response) => sum + response.progress.xpGained, 0);
    const [row] = await db
      .select({ xp: schema.userProgress.xp })
      .from(schema.userProgress)
      .where(eq(schema.userProgress.userId, guest.userId));
    expect(row?.xp).toBe(gained);
    expect(Math.max(...responses.map((response) => response.progress.xp))).toBe(gained);
  });
});

describe("bonus reserve", () => {
  /** A player whose free stock is `stored` (timer just started) with `bonus` in reserve. */
  async function playerWith(stored: number, bonus: number, garni = 0) {
    const guest = await signInAsPlayer();
    await db.insert(schema.boosterWallets).values({
      userId: guest.userId,
      stored,
      progressMs: 0,
      asOf: new Date(),
      bonusBoosters: bonus,
      garniBoosters: garni,
    });
    return guest;
  }

  async function fromBonus(openId: string) {
    const [row] = await db
      .select({ fromBonus: schema.boosterOpens.fromBonus })
      .from(schema.boosterOpens)
      .where(eq(schema.boosterOpens.id, openId));
    return row?.fromBonus;
  }

  it("is kept while the free stock has boosters", async () => {
    const guest = await playerWith(1, 2);
    const body = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
    expect(body.wallet).toMatchObject({ stored: 0, bonus: 2 });
    expect(await fromBonus(body.openId)).toBe(false);
  });

  it("is spent once the free stock is empty, then the stock is empty", async () => {
    const guest = await playerWith(0, 2);
    const first = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
    expect(first.wallet).toMatchObject({ stored: 0, bonus: 1 });
    expect(first.wallet.nextRefillAt).not.toBeNull();
    expect(await fromBonus(first.openId)).toBe(true);

    const key = crypto.randomUUID();
    const second = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());
    expect(second.wallet).toMatchObject({ stored: 0, bonus: 0 });
    const replay = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());
    expect(replay.openId).toBe(second.openId);
    expect(replay.wallet.bonus).toBe(0);

    expect((await openBooster(guest)).status).toBe(409);
    expect(await openCount(guest.userId)).toBe(2);
  });

  it("opens the garni boosters first, each with at least a Rare", async () => {
    const guest = await playerWith(0, 3, 2);
    for (const garniLeft of [1, 0]) {
      const body = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
      expect(body.wallet).toMatchObject({ garni: garniLeft });
      expect(body.cards.some((card) => isAtLeast(card.rarity, "rare"))).toBe(true);
      const [row] = await db
        .select({ garni: schema.boosterOpens.garni })
        .from(schema.boosterOpens)
        .where(eq(schema.boosterOpens.id, body.openId));
      expect(row?.garni).toBe(true);
    }
    const plain = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
    expect(plain.wallet).toMatchObject({ bonus: 0, garni: 0 });
  });

  it("is never overspent by concurrent opens", async () => {
    const guest = await playerWith(0, 3);
    const responses = await Promise.all(Array.from({ length: 6 }, () => openBooster(guest)));
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 200, 200, 409, 409, 409]);
    const [wallet] = await db
      .select({ bonus: schema.boosterWallets.bonusBoosters })
      .from(schema.boosterWallets)
      .where(eq(schema.boosterWallets.userId, guest.userId));
    expect(wallet?.bonus).toBe(0);
    expect(await openCount(guest.userId)).toBe(3);
  });
});

describe("booster draws", () => {
  it("record the request with its idempotency key", async () => {
    const guest = await signInAsPlayer();
    const key = crypto.randomUUID();
    const body = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());

    const [request] = await db
      .select()
      .from(schema.boosterOpenRequests)
      .where(eq(schema.boosterOpenRequests.idempotencyKey, key));
    expect(request?.openId).toBe(body.openId);
    expect(request?.userId).toBe(guest.userId);
  });

  it("can be replayed exactly from the journal", async () => {
    const guest = await signInAsPlayer();
    const body = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());

    const [open] = await db
      .select()
      .from(schema.boosterOpens)
      .where(eq(schema.boosterOpens.id, body.openId));
    if (open === undefined) throw new Error("open not recorded");

    const rows = await db
      .select({ id: schema.cards.id, rarity: schema.cards.rarity })
      .from(schema.cards)
      .innerJoin(schema.collections, eq(schema.collections.id, schema.cards.collectionId))
      .where(
        and(
          isNull(schema.cards.retiredAt),
          isNotNull(schema.collections.publishedAt),
          eq(schema.cards.collectionId, STARTER_COLLECTION),
        ),
      );
    const { pool, fingerprint } = await fingerprintPool(
      byRarity((rarity) => rows.filter((row) => row.rarity === rarity).map((row) => row.id)),
    );
    expect(fingerprint).toBe(open.poolFingerprint);

    const replay = drawBooster(
      drawRulesAt(DRAW_SCHEDULE, open.openedAt.getTime()),
      pool,
      open.pityCountersBefore,
      createSeededRandom(open.seed),
    );
    expect(replay.cards).toEqual(open.cards);
  });

  it("persist the guarantee counters and honour them on the next booster", async () => {
    const guest = await signInAsPlayer();
    expect((await openBooster(guest)).status).toBe(200);
    await db
      .update(schema.boosterWallets)
      .set({ pityCounters: { epic: 39, legendary: 149 } })
      .where(eq(schema.boosterWallets.userId, guest.userId));

    const body = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());
    expect(body.cards.some((card) => card.rarity === "legendary")).toBe(true);

    const [wallet] = await db
      .select({ pityCounters: schema.boosterWallets.pityCounters })
      .from(schema.boosterWallets)
      .where(eq(schema.boosterWallets.userId, guest.userId));
    expect(wallet?.pityCounters).toEqual({ epic: 0, legendary: 0 });
  });

  it("answer 503 without consuming anything when no card can be drawn", async () => {
    const guest = await signInAsPlayer();
    const freshApp = createApp(); // empty pool cache
    await db
      .update(schema.cards)
      .set({ retiredAt: new Date() })
      .where(isNull(schema.cards.retiredAt));
    try {
      const response = await openBooster(guest, crypto.randomUUID(), STARTER, freshApp);
      expect(response.status).toBe(503);
      expect(await openCount(guest.userId)).toBe(0);
    } finally {
      await db.update(schema.cards).set({ retiredAt: null });
    }
  });
});

describe("open latency budget", () => {
  it("uses five statements per open: BEGIN, lock, key lookup, combined write, COMMIT", async () => {
    const queries: string[] = [];
    const logger: Logger = { logQuery: (query) => queries.push(query) };
    const counted = createDb(url, { maxConnections: 1, logger });
    const loadCardPool = createCardPoolLoader();
    const userId = `budget-${crypto.randomUUID()}`;
    await db
      .insert(schema.users)
      .values({ id: userId, name: "Budget", email: `${userId}@test.invalid` });

    const open = () =>
      openBoosterService(counted.db, loadCardPool, {
        userId,
        idempotencyKey: crypto.randomUUID(),
        source: STARTER,
        now: Date.now(),
        seed: "0123456789abcdef0123456789abcdef",
      });
    try {
      await open(); // loads the card pool cache
      queries.length = 0;
      expect((await open()).kind).toBe("opened");
      // Each statement is one round trip to the database. Raising this number slows every open.
      expect(queries).toHaveLength(5);
    } finally {
      await counted.close();
    }
  });
});

describe("booster sources", () => {
  it("draw a collection booster only from that collection, and record it", async () => {
    const guest = await signInAsPlayer();
    await setXp(db, guest.userId, LEVEL_3_XP);
    const response = await openBooster(guest, crypto.randomUUID(), {
      kind: "collection",
      collectionId: "test-b",
    });
    const body = openBoosterResponseSchema.parse(await response.json());
    expect(body.cards.every((card) => card.cardId.startsWith("test-b-"))).toBe(true);

    const [open] = await db
      .select({ collectionId: schema.boosterOpens.collectionId })
      .from(schema.boosterOpens)
      .where(eq(schema.boosterOpens.id, body.openId));
    expect(open?.collectionId).toBe("test-b");
  });

  it("refuse a collection booster before level 3, without consuming anything", async () => {
    const guest = await signInAsPlayer();
    await setXp(db, guest.userId, LEVEL_3_XP - 1);
    const response = await openBooster(guest, crypto.randomUUID(), {
      kind: "collection",
      collectionId: "test-b",
    });
    expect(response.status).toBe(403);
    expect(levelRequiredSchema.parse(await response.json())).toEqual({
      error: "level_required",
      level: 3,
    });
    expect(await openCount(guest.userId)).toBe(0);
    // The starter collection is never closed.
    expect((await openBooster(guest)).status).toBe(200);
  });

  it("draw a collection's booster from that collection only", async () => {
    const loaded = await createCardPoolLoader()(db, STARTER, Date.now());
    const ids = Object.values(loaded?.pool ?? {}).flat();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith(`${STARTER_COLLECTION}-`))).toBe(true);
  });

  it.each([
    ["unknown", "does-not-exist"],
    ["unpublished", "test-hidden"],
  ])(
    "answer 404 for an %s collection, without consuming anything",
    async (_label, collectionId) => {
      const guest = await signInAsPlayer();
      const response = await openBooster(guest, crypto.randomUUID(), {
        kind: "collection",
        collectionId,
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "collection_not_found" });
      expect(await openCount(guest.userId)).toBe(0);
    },
  );

  it.each([
    ["null body", null],
    ["unknown kind", { kind: "mystery" }],
    ["collection without id", { kind: "collection" }],
  ])("reject an invalid request: %s", async (_label, body) => {
    const guest = await signInAsPlayer();
    const response = await openBooster(guest, crypto.randomUUID(), body);
    expect(response.status).toBe(400);
  });

  it("reject a body that is not JSON", async () => {
    const guest = await signInAsPlayer();
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
        body: "{not json",
      },
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe("guest limit", () => {
  const LIMIT = GUEST_SCHEDULE[0].boostersBeforeSignup;

  async function boostersLeft(guest: Guest): Promise<number> {
    const response = await app.request(
      "/me/account",
      { headers: { origin: TEST_ORIGIN, cookie: guest.cookie } },
      env,
    );
    const account = accountResponseSchema.parse(await response.json());
    if (account.kind !== "guest") throw new Error("expected a guest");
    return account.boostersLeft;
  }

  it("lets a guest open its boosters, then asks for an account", async () => {
    const guest = await signInAsGuest(app, env);
    expect(await boostersLeft(guest)).toBe(LIMIT);
    for (let i = 0; i < LIMIT; i++) {
      expect((await openBooster(guest)).status).toBe(200);
    }
    expect(await boostersLeft(guest)).toBe(0);

    const refused = await openBooster(guest);
    expect(refused.status).toBe(403);
    expect(signupRequiredSchema.parse(await refused.json())).toEqual({ error: "signup_required" });
    expect(await openCount(guest.userId)).toBe(LIMIT);
  });

  it("still replays a booster opened before the limit", async () => {
    const guest = await signInAsGuest(app, env);
    const key = crypto.randomUUID();
    const first = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());
    for (let i = 1; i < LIMIT; i++) await openBooster(guest);

    const replay = await openBooster(guest, key);
    expect(replay.status).toBe(200);
    expect(openBoosterResponseSchema.parse(await replay.json()).openId).toBe(first.openId);
  });

  it("never opens one booster too many under concurrent requests", async () => {
    const guest = await signInAsGuest(app, env);
    const statuses = await Promise.all(
      Array.from({ length: LIMIT + 3 }, async () => (await openBooster(guest)).status),
    );
    expect(statuses.filter((status) => status === 200)).toHaveLength(LIMIT);
    expect(statuses.filter((status) => status === 403)).toHaveLength(3);
    expect(await openCount(guest.userId)).toBe(LIMIT);
  });

  it("does not limit a player with an account", async () => {
    const member = await signInAsPlayer();
    for (let i = 0; i <= LIMIT; i++) {
      expect((await openBooster(member)).status).toBe(200);
    }
  });
});
