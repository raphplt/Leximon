import {
  boosterStockEmptySchema,
  IDEMPOTENCY_KEY_HEADER,
  openBoosterResponseSchema,
} from "@leximon/contract";
import {
  byRarity,
  createSeededRandom,
  DRAW_SCHEDULE,
  drawBooster,
  drawRulesAt,
  RARITIES,
  REFILL_SCHEDULE,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { count, eq, isNull, type Logger, sum } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { createCardPoolLoader, fingerprintPool } from "./card-pool";
import { openBooster as openBoosterService } from "./open-booster";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 2 });
const CAPACITY = REFILL_SCHEDULE[0].capacity;

beforeAll(async () => {
  await db
    .insert(schema.cards)
    .values(
      RARITIES.flatMap((rarity) =>
        [1, 2, 3].map((n) => ({ id: `${rarity}-${n}`, lemma: `${rarity} ${n}`, rarity })),
      ),
    )
    .onConflictDoNothing();
});

afterAll(close);

interface Guest {
  readonly cookie: string;
  readonly userId: string;
}

async function signInAsGuest(): Promise<Guest> {
  const response = await app.request(
    "/api/auth/sign-in/anonymous",
    {
      method: "POST",
      headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
      body: "{}",
    },
    env,
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  const body = (await response.json()) as { user: { id: string } };
  return { cookie, userId: body.user.id };
}

function openBooster(guest: Guest | null, key: string | null = crypto.randomUUID()) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN };
  if (guest !== null) headers["cookie"] = guest.cookie;
  if (key !== null) headers[IDEMPOTENCY_KEY_HEADER] = key;
  return app.request("/boosters/open", { method: "POST", headers }, env);
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
    const guest = await signInAsGuest();
    expect((await openBooster(guest, null)).status).toBe(400);
    expect((await openBooster(guest, "retry-1")).status).toBe(400);
  });

  it("opens a booster for a new player, who starts with a full stock", async () => {
    const guest = await signInAsGuest();
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
    const guest = await signInAsGuest();
    const key = crypto.randomUUID();

    const first = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());
    const retry = openBoosterResponseSchema.parse(await (await openBooster(guest, key)).json());

    expect(retry.openId).toBe(first.openId);
    expect(retry.cards).toEqual(first.cards);
    expect(retry.wallet.stored).toBe(CAPACITY - 1);
    expect(await openCount(guest.userId)).toBe(1);
  });

  it("refuses to open once the stock is empty, with the next refill time", async () => {
    const guest = await signInAsGuest();
    for (let i = 0; i < CAPACITY; i++) {
      expect((await openBooster(guest)).status).toBe(200);
    }

    const response = await openBooster(guest);
    expect(response.status).toBe(409);
    const body = boosterStockEmptySchema.parse(await response.json());
    expect(Date.parse(body.nextRefillAt)).toBeGreaterThan(Date.now());
  });

  it("serializes concurrent opens: never more boosters than the stock", async () => {
    const guest = await signInAsGuest();
    const attempts = CAPACITY + 4;

    const responses = await Promise.all(Array.from({ length: attempts }, () => openBooster(guest)));
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses.filter((status) => status === 200)).toHaveLength(CAPACITY);
    expect(statuses.filter((status) => status === 409)).toHaveLength(attempts - CAPACITY);
    expect(await openCount(guest.userId)).toBe(CAPACITY);
    expect(await ownedCopies(guest.userId)).toBe(CAPACITY * 5);
  });

  it("opens only once when the same key is sent concurrently", async () => {
    const guest = await signInAsGuest();
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

describe("booster draws", () => {
  it("record the request with its idempotency key", async () => {
    const guest = await signInAsGuest();
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
    const guest = await signInAsGuest();
    const body = openBoosterResponseSchema.parse(await (await openBooster(guest)).json());

    const [open] = await db
      .select()
      .from(schema.boosterOpens)
      .where(eq(schema.boosterOpens.id, body.openId));
    if (open === undefined) throw new Error("open not recorded");

    const rows = await db
      .select({ id: schema.cards.id, rarity: schema.cards.rarity })
      .from(schema.cards)
      .where(isNull(schema.cards.retiredAt));
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
    const guest = await signInAsGuest();
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
    const guest = await signInAsGuest();
    const freshApp = createApp(); // empty pool cache
    await db
      .update(schema.cards)
      .set({ retiredAt: new Date() })
      .where(isNull(schema.cards.retiredAt));
    try {
      const response = await freshApp.request(
        "/boosters/open",
        {
          method: "POST",
          headers: {
            origin: TEST_ORIGIN,
            cookie: guest.cookie,
            [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
          },
        },
        env,
      );
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
