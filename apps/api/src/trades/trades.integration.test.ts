import {
  IDEMPOTENCY_KEY_HEADER,
  profileResponseSchema,
  type Trade,
  tradeableCardsResponseSchema,
  tradeSchema,
  tradesResponseSchema,
} from "@leximon/contract";
import { TRADE_SCHEDULE, XP_SCHEDULE, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, count, eq, inArray, type Logger } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  ageAccount,
  type Guest,
  type OwnedCard,
  seedTestCatalog,
  setOwnedCards,
  setXp,
  signInAsGuest,
} from "../test-support";
import { acceptTrade } from "./trades";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 2 });
const RULES = TRADE_SCHEDULE[0];
const DAY = 86_400_000;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

const COMMON_1 = "test-a-common-1";
const COMMON_2 = "test-a-common-2";
const COMMON_3 = "test-a-common-3";
const EPIC_1 = "test-a-epic-1";

interface Player extends Guest {
  readonly code: string;
}

/** A guest old enough and of a high enough level to trade, with a player code and some cards. */
async function player(
  owned: readonly OwnedCard[] = [],
  ageMs = RULES.minAccountAgeMs + DAY,
  xp = xpToReach(RULES.minLevel),
) {
  const guest = await signInAsGuest(app, env);
  await ageAccount(db, guest.userId, ageMs);
  await setXp(db, guest.userId, xp);
  if (owned.length > 0) await setOwnedCards(db, guest.userId, owned);
  const profile = profileResponseSchema.parse(await (await get(guest, "/me/profile")).json());
  return { ...guest, code: profile.playerCode } satisfies Player;
}

function get(guest: Guest | null, path: string) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN };
  if (guest !== null) headers["cookie"] = guest.cookie;
  return app.request(path, { headers }, env);
}

function post(guest: Guest | null, path: string, body?: unknown, key?: string | null) {
  const headers: Record<string, string> = {
    origin: TEST_ORIGIN,
    "content-type": "application/json",
  };
  if (guest !== null) headers["cookie"] = guest.cookie;
  if (key !== undefined && key !== null) headers[IDEMPOTENCY_KEY_HEADER] = key;
  return app.request(
    path,
    { method: "POST", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    env,
  );
}

function propose(
  from: Guest,
  to: Player | string,
  give: string[],
  want: string[],
  key: string = crypto.randomUUID(),
) {
  const recipientCode = typeof to === "string" ? to : to.code;
  return post(from, "/trades", { recipientCode, give, want }, key);
}

async function offer(from: Guest, to: Player, give: string[], want: string[]): Promise<Trade> {
  const response = await propose(from, to, give, want);
  expect(response.status).toBe(201);
  return tradeSchema.parse(await response.json());
}

async function quantity(userId: string, cardId: string): Promise<number | null> {
  const [row] = await db
    .select({ quantity: schema.userCards.quantity })
    .from(schema.userCards)
    .where(and(eq(schema.userCards.userId, userId), eq(schema.userCards.cardId, cardId)));
  return row?.quantity ?? null;
}

async function storedStatus(tradeId: string) {
  const [row] = await db
    .select({ status: schema.trades.status })
    .from(schema.trades)
    .where(eq(schema.trades.id, tradeId));
  return row?.status;
}

async function tradesSentBy(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(schema.trades)
    .where(eq(schema.trades.proposerId, userId));
  return row?.total ?? 0;
}

async function expire(tradeId: string): Promise<void> {
  await db
    .update(schema.trades)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(schema.trades.id, tradeId));
}

describe("GET /players/:code/tradeable", () => {
  it("requires a session", async () => {
    expect((await get(null, "/players/ABCDEFGH/tradeable")).status).toBe(401);
  });

  it("lists the duplicates another player can give, rare ones once held long enough", async () => {
    const yesterday = new Date(Date.now() - DAY);
    const other = await player(
      [
        { cardId: COMMON_2, quantity: 3 },
        { cardId: COMMON_1, quantity: 2 },
        { cardId: COMMON_3, quantity: 1 },
        { cardId: EPIC_1, quantity: 2, lastObtainedAt: yesterday },
        { cardId: "test-b-epic-1", quantity: 2, lastObtainedAt: new Date(Date.now() - 8 * DAY) },
      ],
      undefined,
      xpToReach(12),
    );
    const me = await player();

    const response = await get(me, `/players/${other.code.toLowerCase()}/tradeable`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(tradeableCardsResponseSchema.parse(await response.json())).toEqual({
      playerCode: other.code,
      cardIds: [COMMON_1, COMMON_2, "test-b-epic-1"],
      level: 12,
      player: expect.objectContaining({ code: other.code, level: 12 }),
      // The lower level of the two decides: one card for one below level 10.
      maxCardsPerSide: 1,
      held: [
        { cardId: EPIC_1, tradeableFrom: new Date(yesterday.getTime() + 7 * DAY).toISOString() },
      ],
    });
  });

  it("allows three cards per side between two players of level 10 or more", async () => {
    const other = await player([], undefined, xpToReach(10));
    const me = await player([], undefined, xpToReach(11));
    const body = tradeableCardsResponseSchema.parse(
      await (await get(me, `/players/${other.code}/tradeable`)).json(),
    );
    expect(body.maxCardsPerSide).toBe(3);
  });

  it("answers 404 for an unknown code and 400 for a malformed one", async () => {
    const me = await player();
    const unknown = await get(me, "/players/00000000/tradeable");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "player_not_found" });
    expect((await get(me, "/players/not-a-code/tradeable")).status).toBe(400);
  });
});

describe("POST /trades", () => {
  it("requires a session, an idempotency key and a valid body", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    expect((await post(null, "/trades", {}, crypto.randomUUID())).status).toBe(401);
    expect((await propose(alice, bob, [COMMON_1], [COMMON_2], "retry-1")).status).toBe(400);
    const body = { recipientCode: bob.code, give: [COMMON_1], want: [COMMON_2] };
    expect((await post(alice, "/trades", body, null)).status).toBe(400);
    expect((await propose(alice, bob, [], [COMMON_2])).status).toBe(400);
    expect((await propose(alice, bob, ["Not A Slug"], [COMMON_2])).status).toBe(400);
    expect((await propose(alice, "short", [COMMON_1], [COMMON_2])).status).toBe(400);
  });

  it("creates an offer without moving or reserving any card", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 3 }]);

    const before = Date.now();
    const response = await propose(alice, bob, [COMMON_1], [COMMON_2]);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const trade = tradeSchema.parse(await response.json());
    expect(trade).toMatchObject({
      proposerCode: alice.code,
      recipientCode: bob.code,
      give: [COMMON_1],
      want: [COMMON_2],
      status: "pending",
      resolvedAt: null,
    });
    const createdAt = Date.parse(trade.createdAt);
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(Date.parse(trade.expiresAt) - createdAt).toBe(RULES.offerTtlMs);

    expect(await quantity(alice.userId, COMMON_1)).toBe(2);
    expect(await quantity(bob.userId, COMMON_2)).toBe(3);
  });

  it("returns the offer already created when a request is retried with the same key", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    const key = crypto.randomUUID();

    const first = tradeSchema.parse(
      await (await propose(alice, bob, [COMMON_1], [COMMON_2], key)).json(),
    );
    const retry = await propose(alice, bob, [COMMON_1], [COMMON_2], key);
    expect(retry.status).toBe(201);
    expect(tradeSchema.parse(await retry.json())).toEqual(first);

    const concurrent = await Promise.all(
      Array.from({ length: 4 }, () => propose(alice, bob, [COMMON_1], [COMMON_2], key)),
    );
    for (const response of concurrent) {
      expect(tradeSchema.parse(await response.json()).id).toBe(first.id);
    }
    expect(await tradesSentBy(alice.userId)).toBe(1);
  });

  it("allows one card for one before level 10, three per side from level 10", async () => {
    const twoEach = (xp: number) =>
      player(
        [
          { cardId: COMMON_1, quantity: 2 },
          { cardId: COMMON_2, quantity: 2 },
          { cardId: COMMON_3, quantity: 2 },
        ],
        undefined,
        xp,
      );
    const alice = await twoEach(xpToReach(10));
    const bob = await twoEach(xpToReach(9));
    const refused = await propose(alice, bob, [COMMON_1, COMMON_2], [COMMON_2, COMMON_3]);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ error: "too_many_cards" });

    const carol = await twoEach(xpToReach(10));
    const sent = await propose(alice, carol, [COMMON_1, COMMON_2], [COMMON_2, COMMON_3]);
    expect(sent.status).toBe(201);
  });

  it("answers 404 for an unknown recipient", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const response = await propose(alice, "ZZZZZZZZ", [COMMON_1], [COMMON_2]);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "player_not_found" });
  });

  it.each([
    ["the proposer", "proposer"],
    ["the recipient", "recipient"],
  ])("refuses when %s has a recent account", async (_label, recent) => {
    const young = RULES.minAccountAgeMs - DAY;
    const alice = await player(
      [{ cardId: COMMON_1, quantity: 2 }],
      recent === "proposer" ? young : undefined,
    );
    const bob = await player(
      [{ cardId: COMMON_2, quantity: 2 }],
      recent === "recipient" ? young : undefined,
    );
    const response = await propose(alice, bob, [COMMON_1], [COMMON_2]);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "account_too_recent" });
  });

  it.each([
    ["the proposer", "proposer"],
    ["the recipient", "recipient"],
  ])("refuses when %s is below the minimum level", async (_label, low) => {
    const below = xpToReach(RULES.minLevel) - 1;
    const alice = await player(
      [{ cardId: COMMON_1, quantity: 2 }],
      undefined,
      low === "proposer" ? below : undefined,
    );
    const bob = await player(
      [{ cardId: COMMON_2, quantity: 2 }],
      undefined,
      low === "recipient" ? below : undefined,
    );
    const response = await propose(alice, bob, [COMMON_1], [COMMON_2]);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "level_too_low" });
  });

  it.each([
    ["a card given that is not a duplicate", [COMMON_1], [COMMON_2]],
    ["a card wanted that is not a duplicate", [COMMON_2], [COMMON_3]],
    ["a card nobody owns", [COMMON_2], ["test-b-common-1"]],
    ["an epic card obtained too recently", [EPIC_1], [COMMON_2]],
  ])("refuses an offer with %s", async (_label, give, want) => {
    const alice = await player([
      { cardId: COMMON_1, quantity: 1 },
      { cardId: COMMON_2, quantity: 2 },
      { cardId: EPIC_1, quantity: 2, lastObtainedAt: new Date(Date.now() - DAY) },
    ]);
    const bob = await player([
      { cardId: COMMON_2, quantity: 2 },
      { cardId: COMMON_3, quantity: 1 },
    ]);
    const response = await propose(alice, bob, give, want);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "card_not_tradeable" });
    expect(await tradesSentBy(alice.userId)).toBe(0);
  });

  it("refuses an offer to oneself", async () => {
    const alice = await player([
      { cardId: COMMON_1, quantity: 2 },
      { cardId: COMMON_2, quantity: 2 },
    ]);
    const response = await propose(alice, alice, [COMMON_1], [COMMON_2]);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "self_trade" });
  });

  it("caps the offers sent over 24 hours, even under concurrent requests", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    const attempts = RULES.offersPerDay + 3;

    const responses = await Promise.all(
      Array.from({ length: attempts }, () => propose(alice, bob, [COMMON_1], [COMMON_2])),
    );
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(RULES.offersPerDay);
    expect(statuses.filter((status) => status === 422)).toHaveLength(3);
    const refused = responses.find((response) => response.status === 422);
    expect(await refused?.json()).toEqual({ error: "daily_limit_reached" });
    expect(await tradesSentBy(alice.userId)).toBe(RULES.offersPerDay);
  });

  it("counts only the last 24 hours, cancelled offers included", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    for (let i = 0; i < RULES.offersPerDay; i++) {
      const trade = await offer(alice, bob, [COMMON_1], [COMMON_2]);
      expect((await post(alice, `/trades/${trade.id}/cancel`)).status).toBe(200);
    }
    expect((await propose(alice, bob, [COMMON_1], [COMMON_2])).status).toBe(422);

    await db
      .update(schema.trades)
      .set({ createdAt: new Date(Date.now() - DAY - 1000) })
      .where(eq(schema.trades.proposerId, alice.userId));
    expect((await propose(alice, bob, [COMMON_1], [COMMON_2])).status).toBe(201);
  });
});

describe("GET /trades", () => {
  it("requires a session and a box", async () => {
    expect((await get(null, "/trades?box=incoming")).status).toBe(401);
    const alice = await player();
    expect((await get(alice, "/trades")).status).toBe(400);
    expect((await get(alice, "/trades?box=incoming&cursor=%%%")).status).toBe(400);
  });

  it("lists offers received and sent, newest first, across pages", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([
      { cardId: COMMON_2, quantity: 2 },
      { cardId: COMMON_3, quantity: 2 },
    ]);
    const sent = [];
    for (const want of [COMMON_2, COMMON_3, COMMON_2]) {
      sent.push(await offer(alice, bob, [COMMON_1], [want]));
    }

    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor === null ? "" : `&cursor=${cursor}`;
      const response = await get(bob, `/trades?box=incoming&limit=2${query}`);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const page = tradesResponseSchema.parse(await response.json());
      ids.push(...page.trades.map((trade) => trade.id));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(ids).toEqual(sent.map((trade) => trade.id).reverse());

    const outgoing = tradesResponseSchema.parse(
      await (await get(alice, "/trades?box=outgoing")).json(),
    );
    expect(outgoing.trades.map((trade) => trade.id)).toEqual(ids);
    expect(outgoing.trades[0]).toEqual(sent[2]);
    const empty = tradesResponseSchema.parse(
      await (await get(alice, "/trades?box=incoming")).json(),
    );
    expect(empty).toEqual({ trades: [], nextCursor: null });
  });

  it("shows a pending offer past its delay as expired, without storing it", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    const trade = await offer(alice, bob, [COMMON_1], [COMMON_2]);
    await expire(trade.id);

    const body = tradesResponseSchema.parse(await (await get(bob, "/trades?box=incoming")).json());
    expect(body.trades[0]?.status).toBe("expired");
    expect(await storedStatus(trade.id)).toBe("pending");
  });
});

describe("POST /trades/:id/accept", () => {
  async function pendingTrade() {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([
      { cardId: COMMON_2, quantity: 3 },
      { cardId: COMMON_1, quantity: 1 },
    ]);
    const trade = await offer(alice, bob, [COMMON_1], [COMMON_2]);
    return { alice, bob, trade };
  }

  it("moves one copy of each card and concludes the offer", async () => {
    const { alice, bob, trade } = await pendingTrade();
    const before = Date.now();

    const response = await post(bob, `/trades/${trade.id}/accept`);
    expect(response.status).toBe(200);
    const accepted = tradeSchema.parse(await response.json());
    expect(accepted).toMatchObject({ id: trade.id, status: "completed" });
    expect(Date.parse(accepted.resolvedAt ?? "")).toBeGreaterThanOrEqual(before);

    expect(await quantity(alice.userId, COMMON_1)).toBe(1);
    expect(await quantity(bob.userId, COMMON_1)).toBe(2);
    expect(await quantity(bob.userId, COMMON_2)).toBe(2);
    expect(await quantity(alice.userId, COMMON_2)).toBe(1);
    expect(await storedStatus(trade.id)).toBe("completed");

    // A new copy starts its holding period now; an existing row keeps its first date.
    const rows = await db
      .select()
      .from(schema.userCards)
      .where(eq(schema.userCards.cardId, COMMON_2));
    const received = rows.find((row) => row.userId === alice.userId);
    expect(received?.firstObtainedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(received?.lastObtainedAt.getTime()).toBe(received?.firstObtainedAt.getTime());
    const [bobRow] = await db
      .select()
      .from(schema.userCards)
      .where(and(eq(schema.userCards.userId, bob.userId), eq(schema.userCards.cardId, COMMON_1)));
    expect(bobRow?.firstObtainedAt.getTime()).toBeLessThan(before);
    expect(bobRow?.lastObtainedAt.getTime()).toBeGreaterThanOrEqual(before);

    // Both players earn the XP of a concluded trade.
    const xpRows = await db
      .select({ userId: schema.userProgress.userId, xp: schema.userProgress.xp })
      .from(schema.userProgress)
      .where(inArray(schema.userProgress.userId, [alice.userId, bob.userId]));
    const levelXp = xpToReach(RULES.minLevel);
    const reward = XP_SCHEDULE[0].tradeCompleted;
    expect(new Map(xpRows.map((row) => [row.userId, row.xp]))).toEqual(
      new Map([
        [alice.userId, levelXp + reward],
        [bob.userId, levelXp + reward],
      ]),
    );

    // Mastery belongs to the player, never to a copy.
    const [mastery] = await db
      .select({ total: count() })
      .from(schema.userMastery)
      .where(eq(schema.userMastery.userId, alice.userId));
    expect(mastery?.total).toBe(0);
  });

  it("returns the concluded offer when accepted again, without moving anything", async () => {
    const { alice, bob, trade } = await pendingTrade();
    const first = tradeSchema.parse(await (await post(bob, `/trades/${trade.id}/accept`)).json());
    const again = await post(bob, `/trades/${trade.id}/accept`);
    expect(again.status).toBe(200);
    expect(tradeSchema.parse(await again.json())).toEqual(first);
    expect(await quantity(alice.userId, COMMON_1)).toBe(1);
    expect(await quantity(bob.userId, COMMON_2)).toBe(2);
  });

  it("is reserved to the recipient: others get 404", async () => {
    const { alice, trade } = await pendingTrade();
    const stranger = await player();
    for (const who of [alice, stranger]) {
      const response = await post(who, `/trades/${trade.id}/accept`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "trade_not_found" });
    }
    expect((await post(stranger, `/trades/${crypto.randomUUID()}/accept`)).status).toBe(404);
    expect((await post(stranger, "/trades/not-a-uuid/accept")).status).toBe(404);
    expect(await storedStatus(trade.id)).toBe("pending");
  });

  it("fails cleanly when a card is no longer tradeable, and the offer stays pending", async () => {
    const { alice, bob, trade } = await pendingTrade();
    await setOwnedCards(db, alice.userId, [{ cardId: COMMON_1, quantity: 1 }]);

    const response = await post(bob, `/trades/${trade.id}/accept`);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "card_not_tradeable" });
    expect(await storedStatus(trade.id)).toBe("pending");
    expect(await quantity(bob.userId, COMMON_2)).toBe(3);
  });

  it("refuses an expired offer", async () => {
    const { bob, trade } = await pendingTrade();
    await expire(trade.id);
    const response = await post(bob, `/trades/${trade.id}/accept`);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "trade_expired" });
  });

  it("concludes only once when the same offer is accepted concurrently", async () => {
    const { alice, bob, trade } = await pendingTrade();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => post(bob, `/trades/${trade.id}/accept`)),
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(tradeSchema.parse(await response.json()).status).toBe("completed");
    }
    expect(await quantity(alice.userId, COMMON_1)).toBe(1);
    expect(await quantity(bob.userId, COMMON_1)).toBe(2);
    expect(await quantity(bob.userId, COMMON_2)).toBe(2);
    expect(await quantity(alice.userId, COMMON_2)).toBe(1);
  });

  it("lets only one of two offers wanting the same last duplicate succeed", async () => {
    const bob = await player([{ cardId: COMMON_3, quantity: 2 }]);
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const carol = await player([{ cardId: COMMON_2, quantity: 2 }]);
    const fromAlice = await offer(alice, bob, [COMMON_1], [COMMON_3]);
    const fromCarol = await offer(carol, bob, [COMMON_2], [COMMON_3]);

    const responses = await Promise.all([
      post(bob, `/trades/${fromAlice.id}/accept`),
      post(bob, `/trades/${fromCarol.id}/accept`),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409]);
    const refused = responses.find((response) => response.status === 409);
    expect(await refused?.json()).toEqual({ error: "card_not_tradeable" });

    // Bob keeps his last copy; exactly one of Alice and Carol received the card.
    expect(await quantity(bob.userId, COMMON_3)).toBe(1);
    const received = [
      await quantity(alice.userId, COMMON_3),
      await quantity(carol.userId, COMMON_3),
    ];
    expect(received.filter((value) => value === 1)).toHaveLength(1);
    expect(received.filter((value) => value === null)).toHaveLength(1);
  });

  it("does not deadlock on concurrent trades between the same players in both directions", async () => {
    const alice = await player([
      { cardId: COMMON_1, quantity: 3 },
      { cardId: COMMON_2, quantity: 3 },
    ]);
    const bob = await player([
      { cardId: COMMON_1, quantity: 3 },
      { cardId: COMMON_2, quantity: 3 },
    ]);
    const toBob = await offer(alice, bob, [COMMON_1], [COMMON_2]);
    const toAlice = await offer(bob, alice, [COMMON_1], [COMMON_2]);

    const responses = await Promise.all([
      post(bob, `/trades/${toBob.id}/accept`),
      post(alice, `/trades/${toAlice.id}/accept`),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    // Each trade moved a COMMON_1 one way and a COMMON_2 the other: everyone is back to 3.
    for (const who of [alice, bob]) {
      expect(await quantity(who.userId, COMMON_1)).toBe(3);
      expect(await quantity(who.userId, COMMON_2)).toBe(3);
    }
  });
});

describe("POST /trades/:id/decline and /cancel", () => {
  async function pendingTrade() {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    const trade = await offer(alice, bob, [COMMON_1], [COMMON_2]);
    return { alice, bob, trade };
  }

  it("lets the recipient decline, idempotently, after which it cannot be accepted", async () => {
    const { alice, bob, trade } = await pendingTrade();
    const declined = await post(bob, `/trades/${trade.id}/decline`);
    expect(declined.status).toBe(200);
    const body = tradeSchema.parse(await declined.json());
    expect(body.status).toBe("declined");
    expect(body.resolvedAt).not.toBeNull();

    const again = await post(bob, `/trades/${trade.id}/decline`);
    expect(again.status).toBe(200);
    expect(tradeSchema.parse(await again.json())).toEqual(body);

    for (const [who, action] of [
      [bob, "accept"],
      [alice, "cancel"],
    ] as const) {
      const response = await post(who, `/trades/${trade.id}/${action}`);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "trade_not_pending" });
    }
  });

  it("lets the proposer cancel, idempotently", async () => {
    const { alice, bob, trade } = await pendingTrade();
    const cancelled = await post(alice, `/trades/${trade.id}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(tradeSchema.parse(await cancelled.json()).status).toBe("cancelled");
    expect((await post(alice, `/trades/${trade.id}/cancel`)).status).toBe(200);
    expect((await post(bob, `/trades/${trade.id}/decline`)).status).toBe(409);
  });

  it("hides the offer from anyone in the wrong role", async () => {
    const { alice, bob, trade } = await pendingTrade();
    const stranger = await player();
    for (const [who, action] of [
      [stranger, "decline"],
      [stranger, "cancel"],
      [alice, "decline"],
      [bob, "cancel"],
    ] as const) {
      const response = await post(who, `/trades/${trade.id}/${action}`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "trade_not_found" });
    }
    expect(await storedStatus(trade.id)).toBe("pending");
  });

  it("refuses to decline an expired offer", async () => {
    const { bob, trade } = await pendingTrade();
    await expire(trade.id);
    const response = await post(bob, `/trades/${trade.id}/decline`);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "trade_expired" });
  });

  it("lets exactly one of a concurrent acceptance and cancellation win", async () => {
    const { alice, bob, trade } = await pendingTrade();
    const [accepted, cancelled] = await Promise.all([
      post(bob, `/trades/${trade.id}/accept`),
      post(alice, `/trades/${trade.id}/cancel`),
    ]);
    expect([accepted.status, cancelled.status].sort()).toEqual([200, 409]);
    const status = await storedStatus(trade.id);
    expect(await quantity(alice.userId, COMMON_1)).toBe(status === "completed" ? 1 : 2);
  });
});

describe("accept latency", () => {
  it("uses five statements: BEGIN, lock offer, lock cards, combined write, COMMIT", async () => {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    const trade = await offer(alice, bob, [COMMON_1], [COMMON_2]);

    const queries: string[] = [];
    const logger: Logger = { logQuery: (query) => queries.push(query) };
    const counted = createDb(url, { maxConnections: 1, logger });
    try {
      const result = await acceptTrade(counted.db, {
        userId: bob.userId,
        tradeId: trade.id,
        now: Date.now(),
      });
      expect(result.kind).toBe("completed");
      // Each statement is one round trip, all while holding the locks.
      expect(queries).toHaveLength(5);
    } finally {
      await counted.close();
    }
  });
});
