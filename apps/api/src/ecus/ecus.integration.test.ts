import {
  IDEMPOTENCY_KEY_HEADER,
  missingWordRefusalSchema,
  missingWordResponseSchema,
  profileResponseSchema,
  recycleRefusalSchema,
  recycleResponseSchema,
  tradeSchema,
} from "@leximon/contract";
import {
  capacityAt,
  ECU_SCHEDULE,
  REFILL_SCHEDULE,
  TRADE_SCHEDULE,
  UNLOCK_SCHEDULE,
  XP_SCHEDULE,
  xpToReach,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  type Guest,
  type OwnedCard,
  STARTER_COLLECTION,
  seedTestCatalog,
  setOwnedCards,
  setXp,
  signInAsGuest,
} from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 4 });
const RULES = ECU_SCHEDULE[0];
const XP = XP_SCHEDULE[0];
const CAPACITY = capacityAt(REFILL_SCHEDULE, Date.now());

beforeAll(() => seedTestCatalog(db));
afterAll(close);

const card = (rarity: string, n: number, collection: string = STARTER_COLLECTION) =>
  `${collection}-${rarity}-${n}`;

/** A guest with some cards and écus. */
async function player(owned: readonly OwnedCard[] = [], ecus = 0): Promise<Guest> {
  const guest = await signInAsGuest(app, env);
  if (owned.length > 0) await setOwnedCards(db, guest.userId, owned);
  await db.insert(schema.boosterWallets).values({
    userId: guest.userId,
    stored: CAPACITY,
    progressMs: 0,
    asOf: new Date(),
    ecus,
  });
  return guest;
}

function post(guest: Guest | null, path: string, body: unknown = {}, key?: string | null) {
  const headers: Record<string, string> = {
    origin: TEST_ORIGIN,
    "content-type": "application/json",
  };
  if (guest !== null) headers["cookie"] = guest.cookie;
  if (key !== null) headers[IDEMPOTENCY_KEY_HEADER] = key ?? crypto.randomUUID();
  return app.request(path, { method: "POST", headers, body: JSON.stringify(body) }, env);
}

const recycle = (guest: Guest, key?: string) => post(guest, "/me/recycle", {}, key);
const recycleOne = (guest: Guest, cardId: string, key?: string) =>
  post(guest, `/me/cards/${cardId}/recycle`, {}, key);
const buy = (guest: Guest, collectionId: string, rarity: string, key?: string) =>
  post(guest, "/me/missing-word", { collectionId, rarity }, key);

async function quantity(userId: string, cardId: string): Promise<number | null> {
  const [row] = await db
    .select({ quantity: schema.userCards.quantity })
    .from(schema.userCards)
    .where(and(eq(schema.userCards.userId, userId), eq(schema.userCards.cardId, cardId)));
  return row?.quantity ?? null;
}

async function ecusOf(userId: string): Promise<number | undefined> {
  const [row] = await db
    .select({ ecus: schema.boosterWallets.ecus })
    .from(schema.boosterWallets)
    .where(eq(schema.boosterWallets.userId, userId));
  return row?.ecus;
}

async function movementsOf(userId: string) {
  return db
    .select({ kind: schema.ecuMovements.kind, amount: schema.ecuMovements.amount })
    .from(schema.ecuMovements)
    .where(eq(schema.ecuMovements.userId, userId));
}

describe("POST /me/recycle", () => {
  it("requires a session and an idempotency key", async () => {
    expect((await post(null, "/me/recycle")).status).toBe(401);
    const guest = await player();
    expect((await post(guest, "/me/recycle", {}, null)).status).toBe(400);
  });

  it("keeps two copies of each card and never touches the rarest ones", async () => {
    const guest = await player([
      { cardId: card("common", 1), quantity: 5 },
      { cardId: card("uncommon", 1), quantity: 3 },
      { cardId: card("rare", 1), quantity: 2 },
      { cardId: card("precious", 1), quantity: 4 },
      { cardId: card("epic", 1), quantity: 6 },
      { cardId: card("legendary", 1), quantity: 3 },
    ]);
    const response = await recycle(guest);
    expect(response.status).toBe(200);
    const body = recycleResponseSchema.parse(await response.json());
    const expected = 3 * RULES.recycleValue.common + RULES.recycleValue.uncommon;
    const ecus = expected + 2 * RULES.recycleValue.precious;
    expect(body).toMatchObject({ copies: 6, ecus, wallet: { ecus } });
    expect(body.cards.map((recycled) => recycled.cardId)).toEqual([
      card("common", 1),
      card("precious", 1),
      card("uncommon", 1),
    ]);

    expect(await quantity(guest.userId, card("common", 1))).toBe(2);
    expect(await quantity(guest.userId, card("uncommon", 1))).toBe(2);
    expect(await quantity(guest.userId, card("rare", 1))).toBe(2);
    expect(await quantity(guest.userId, card("precious", 1))).toBe(2);
    expect(await quantity(guest.userId, card("epic", 1))).toBe(6);
    expect(await quantity(guest.userId, card("legendary", 1))).toBe(3);
    expect(await ecusOf(guest.userId)).toBe(ecus);
    expect(await movementsOf(guest.userId)).toEqual([{ kind: "recycle", amount: ecus }]);
  });

  it("returns the first result when a request is repeated", async () => {
    const guest = await player([{ cardId: card("common", 1), quantity: 4 }]);
    const key = crypto.randomUUID();
    const first = recycleResponseSchema.parse(await (await recycle(guest, key)).json());
    await setOwnedCards(db, guest.userId, [{ cardId: card("common", 1), quantity: 4 }]);
    const second = recycleResponseSchema.parse(await (await recycle(guest, key)).json());
    expect(second.cards).toEqual(first.cards);
    expect(second.ecus).toBe(2);
    expect(await ecusOf(guest.userId)).toBe(2);
    expect(await quantity(guest.userId, card("common", 1))).toBe(4);
  });

  it("recycles nothing when there is no extra duplicate", async () => {
    const guest = await player([{ cardId: card("common", 1), quantity: 2 }]);
    const body = recycleResponseSchema.parse(await (await recycle(guest)).json());
    expect(body).toMatchObject({ cards: [], copies: 0, ecus: 0, wallet: { ecus: 0 } });
    expect(await movementsOf(guest.userId)).toEqual([]);
  });

  it("recycles each copy once under concurrent requests", async () => {
    const guest = await player([
      { cardId: card("common", 1), quantity: 7 },
      { cardId: card("rare", 2), quantity: 4 },
    ]);
    const responses = await Promise.all(Array.from({ length: 5 }, () => recycle(guest)));
    const bodies = await Promise.all(
      responses.map(async (response) => recycleResponseSchema.parse(await response.json())),
    );
    const total = 5 * RULES.recycleValue.common + 2 * RULES.recycleValue.rare;
    expect(bodies.reduce((sum, body) => sum + body.ecus, 0)).toBe(total);
    expect(await ecusOf(guest.userId)).toBe(total);
    expect(await quantity(guest.userId, card("common", 1))).toBe(2);
    expect(await quantity(guest.userId, card("rare", 2))).toBe(2);
  });

  it("stays consistent with a trade accepted at the same time", async () => {
    const minLevel = xpToReach(TRADE_SCHEDULE[0].minLevel);
    const bob = await player([{ cardId: card("common", 3, "test-a"), quantity: 3 }]);
    const alice = await player([{ cardId: card("common", 1, "test-a"), quantity: 2 }]);
    await setXp(db, bob.userId, minLevel);
    await setXp(db, alice.userId, minLevel);
    const bobCode = profileResponseSchema.parse(
      await (
        await app.request(
          "/me/profile",
          { headers: { origin: TEST_ORIGIN, cookie: bob.cookie } },
          env,
        )
      ).json(),
    ).playerCode;
    const offered = await post(alice, "/trades", {
      recipientCode: bobCode,
      give: [card("common", 1, "test-a")],
      want: [card("common", 3, "test-a")],
    });
    expect(offered.status).toBe(201);
    const trade = tradeSchema.parse(await offered.json());

    const [accepted, recycled] = await Promise.all([
      post(bob, `/trades/${trade.id}/accept`, undefined, null),
      recycle(bob),
    ]);
    expect(accepted.status).toBe(200);
    expect(recycled.status).toBe(200);
    // Traded first: 2 left, nothing to recycle. Recycled first: one écu, then 1 left.
    const left = await quantity(bob.userId, card("common", 3, "test-a"));
    const ecus = await ecusOf(bob.userId);
    expect((left ?? 0) + (ecus ?? 0)).toBe(2);
    expect(await quantity(alice.userId, card("common", 3, "test-a"))).toBe(1);
  });
});

describe("POST /me/cards/:cardId/recycle", () => {
  it("recycles one copy of a rare card, never the last one", async () => {
    const guest = await player([{ cardId: card("epic", 1), quantity: 2 }]);
    const body = recycleResponseSchema.parse(
      await (await recycleOne(guest, card("epic", 1))).json(),
    );
    expect(body).toMatchObject({ copies: 1, ecus: RULES.recycleValue.epic });
    expect(await quantity(guest.userId, card("epic", 1))).toBe(1);

    const last = await recycleOne(guest, card("epic", 1));
    expect(last.status).toBe(409);
    expect(recycleRefusalSchema.parse(await last.json()).error).toBe("no_duplicate");
    const unknown = await recycleOne(guest, card("epic", 2));
    expect(unknown.status).toBe(409);
    expect(await ecusOf(guest.userId)).toBe(RULES.recycleValue.epic);
  });

  it("recycles a single copy under concurrent requests on the last duplicate", async () => {
    const guest = await player([{ cardId: card("legendary", 1), quantity: 2 }]);
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => recycleOne(guest, card("legendary", 1))),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409, 409, 409]);
    expect(await quantity(guest.userId, card("legendary", 1))).toBe(1);
    expect(await ecusOf(guest.userId)).toBe(RULES.recycleValue.legendary);
  });
});

describe("POST /me/missing-word", () => {
  const price = RULES.missingWordPrice.common;

  it("draws a word the player lacks and spends its price", async () => {
    const guest = await player(
      [
        { cardId: card("common", 1), quantity: 1 },
        { cardId: card("common", 2), quantity: 1 },
      ],
      price + 3,
    );
    const response = await buy(guest, STARTER_COLLECTION, "common");
    expect(response.status).toBe(200);
    const body = missingWordResponseSchema.parse(await response.json());
    expect(body.cardId).toBe(card("common", 3));
    expect(body.price).toBe(price);
    expect(body.wallet.ecus).toBe(3);
    expect(body.completions).toEqual([
      { collectionId: STARTER_COLLECTION, rarity: "common", xp: XP.rarityCompleted.common },
    ]);
    expect(body.progress.xpGained).toBe(XP.newWord.common + XP.rarityCompleted.common);
    expect(await quantity(guest.userId, card("common", 3))).toBe(1);
    expect(await movementsOf(guest.userId)).toEqual([{ kind: "missing_word", amount: -price }]);
  });

  it("returns the same word when a request is repeated", async () => {
    const guest = await player([], 2 * price);
    const key = crypto.randomUUID();
    const first = missingWordResponseSchema.parse(
      await (await buy(guest, STARTER_COLLECTION, "common", key)).json(),
    );
    const second = missingWordResponseSchema.parse(
      await (await buy(guest, STARTER_COLLECTION, "common", key)).json(),
    );
    expect(second.cardId).toBe(first.cardId);
    expect(second.price).toBe(price);
    expect(second.progress.xpGained).toBe(0);
    expect(await ecusOf(guest.userId)).toBe(price);
  });

  it("gives no new-word XP for a word held before and traded away", async () => {
    const guest = await player(
      [
        { cardId: card("rare", 1), quantity: 1 },
        { cardId: card("rare", 2), quantity: 1 },
        { cardId: card("rare", 3), quantity: 0 },
      ],
      RULES.missingWordPrice.rare,
    );
    const body = missingWordResponseSchema.parse(
      await (await buy(guest, STARTER_COLLECTION, "rare")).json(),
    );
    expect(body.cardId).toBe(card("rare", 3));
    expect(body.progress.xpGained).toBe(0);
    expect(body.completions).toEqual([]);
    expect(await quantity(guest.userId, card("rare", 3))).toBe(1);
  });

  it("refuses a price above the player's écus, and an owned choice", async () => {
    const guest = await player(
      [1, 2, 3].map((n) => ({ cardId: card("uncommon", n), quantity: 1 })),
      price - 1,
    );
    const poor = await buy(guest, STARTER_COLLECTION, "common");
    expect(poor.status).toBe(409);
    expect(missingWordRefusalSchema.parse(await poor.json()).error).toBe("not_enough_ecus");
    const owned = await buy(guest, STARTER_COLLECTION, "uncommon");
    expect(missingWordRefusalSchema.parse(await owned.json()).error).toBe("nothing_missing");
    expect(await ecusOf(guest.userId)).toBe(price - 1);
  });

  it("opens the other collections at the level of the choice of collection", async () => {
    const guest = await player([], 1_000);
    const locked = await buy(guest, "test-a", "common");
    expect(missingWordRefusalSchema.parse(await locked.json()).error).toBe("collection_locked");
    const hidden = await buy(guest, "test-hidden", "common");
    expect(missingWordRefusalSchema.parse(await hidden.json()).error).toBe("collection_not_found");
    await setXp(db, guest.userId, xpToReach(UNLOCK_SCHEDULE[0].levels.choose_collection));
    expect((await buy(guest, "test-a", "common")).status).toBe(200);
  });

  it("never spends the same écus twice under concurrent purchases", async () => {
    const guest = await player([], price + 1);
    const responses = await Promise.all(
      Array.from({ length: 3 }, () => buy(guest, STARTER_COLLECTION, "common")),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409, 409]);
    expect(await ecusOf(guest.userId)).toBe(1);
  });
});
