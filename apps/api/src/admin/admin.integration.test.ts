import {
  adminActionsResponseSchema,
  adminCardStatsSchema,
  adminCatalogSchema,
  adminGrantBonusResponseSchema,
  adminMeSchema,
  adminOverviewSchema,
  adminPlayerDetailSchema,
  adminPlayersResponseSchema,
  adminTradesResponseSchema,
  adminWaitlistResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
} from "@leximon/contract";
import { BONUS_SCHEDULE } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  type Guest,
  STARTER_COLLECTION,
  seedTestCatalog,
  setOwnedCards,
  signInAsGuest,
  signInAsMember,
} from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 4 });
const DAY = 86_400_000;
const BONUS_CAP = BONUS_SCHEDULE[0].reserveCap;

const { boosterWallets, players, sessions, tradeItems, trades, users, waitlistSignups } = schema;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

async function signInAsAdmin(): Promise<Guest> {
  const admin = await signInAsMember(app, env, db);
  await db.update(users).set({ role: "admin" }).where(eq(users.id, admin.userId));
  return admin;
}

/** A member with a real address, so that searches can find it. */
async function signInAsNamedMember(): Promise<Guest & { email: string }> {
  const member = await signInAsMember(app, env, db);
  const email = `joueur-${crypto.randomUUID().slice(0, 8)}@example.com`;
  await db.update(users).set({ email }).where(eq(users.id, member.userId));
  return { ...member, email };
}

async function namePlayer(userId: string, pseudo: string): Promise<void> {
  const name = {
    pseudo,
    pseudoKey: pseudo.toLowerCase(),
    pseudoChangedAt: new Date(),
  };
  await db
    .insert(players)
    .values({ userId, code: crypto.randomUUID().slice(0, 8).toUpperCase(), ...name })
    .onConflictDoUpdate({ target: players.userId, set: name });
}

function request(who: Guest | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", TEST_ORIGIN);
  if (who !== null) headers.set("cookie", who.cookie);
  return app.request(path, { ...init, headers }, env);
}

function post(who: Guest, path: string, body: unknown, headers: Record<string, string> = {}) {
  return request(who, path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function grant(admin: Guest, userId: string, amount: number, key = crypto.randomUUID()) {
  return post(
    admin,
    `/admin/players/${userId}/bonus`,
    { amount, reason: "compensation" },
    { [IDEMPOTENCY_KEY_HEADER]: key },
  );
}

async function bonusOf(userId: string): Promise<number> {
  const [row] = await db
    .select({ bonus: boosterWallets.bonusBoosters })
    .from(boosterWallets)
    .where(eq(boosterWallets.userId, userId));
  return row?.bonus ?? 0;
}

describe("access", () => {
  it("is refused without a session, and to players who are not admins", async () => {
    expect((await request(null, "/admin/overview")).status).toBe(401);
    expect((await request(await signInAsGuest(app, env), "/admin/overview")).status).toBe(403);
    expect((await request(await signInAsMember(app, env, db), "/admin/overview")).status).toBe(403);
  });

  it("is refused as soon as the role is taken back, despite the cookie cache", async () => {
    const admin = await signInAsAdmin();
    expect((await request(admin, "/admin/overview")).status).toBe(200);
    await db.update(users).set({ role: "user" }).where(eq(users.id, admin.userId));
    expect((await request(admin, "/admin/overview")).status).toBe(403);
  });

  it("tells the client whether to show the back office", async () => {
    const admin = await signInAsAdmin();
    const account = await (await request(admin, "/me/account")).json();
    expect(account).toMatchObject({ kind: "member", isAdmin: true });
  });

  it("tells the back office who is browsing, from the role as it is now", async () => {
    const member = await signInAsNamedMember();
    expect((await request(member, "/admin/me")).status).toBe(403);
    await db.update(users).set({ role: "admin" }).where(eq(users.id, member.userId));
    const response = await request(member, "/admin/me");
    expect(response.status).toBe(200);
    expect(adminMeSchema.parse(await response.json())).toEqual({ email: member.email });
  });

  it("keeps Better Auth's own admin endpoints unreachable", async () => {
    const admin = await signInAsAdmin();
    const response = await post(admin, "/api/auth/admin/set-role", {
      userId: admin.userId,
      role: "admin",
    });
    expect(response.status).toBe(404);
  });
});

describe("GET /admin/overview", () => {
  it("counts players, boosters and the waiting list", async () => {
    const admin = await signInAsAdmin();
    const overview = adminOverviewSchema.parse(
      await (await request(admin, "/admin/overview")).json(),
    );
    expect(overview.players.members).toBeGreaterThan(0);
    expect(overview.players.guests).toBeGreaterThanOrEqual(0);
  });
});

describe("players", () => {
  it("finds a member by part of their address, and by player code", async () => {
    const admin = await signInAsAdmin();
    const member = await signInAsNamedMember();
    const [, local] = member.email.match(/^(joueur-[0-9a-f]{8})/) ?? [];
    const found = adminPlayersResponseSchema.parse(
      await (await request(admin, `/admin/players?q=${local}`)).json(),
    );
    expect(found.players.map((player) => player.id)).toEqual([member.userId]);
    expect(found.players[0]).toMatchObject({ email: member.email, isGuest: false, level: 1 });
  });

  it("searches `%` and `_` literally", async () => {
    const admin = await signInAsAdmin();
    const found = adminPlayersResponseSchema.parse(
      await (await request(admin, "/admin/players?q=%25")).json(),
    );
    expect(found.players).toEqual([]);
  });

  it("lists guests without their placeholder address", async () => {
    const admin = await signInAsAdmin();
    const guest = await signInAsGuest(app, env);
    const found = adminPlayersResponseSchema.parse(
      await (await request(admin, `/admin/players?kind=guest&q=${guest.userId}`)).json(),
    );
    expect(found.players).toHaveLength(1);
    expect(found.players[0]).toMatchObject({ id: guest.userId, email: null, isGuest: true });
  });

  it("pages through the list with a cursor", async () => {
    const admin = await signInAsAdmin();
    const first = adminPlayersResponseSchema.parse(
      await (await request(admin, "/admin/players?kind=member")).json(),
    );
    expect((await request(admin, "/admin/players?cursor=nope")).status).toBe(400);
    if (first.nextCursor !== null) {
      const second = adminPlayersResponseSchema.parse(
        await (await request(admin, `/admin/players?cursor=${first.nextCursor}`)).json(),
      );
      const seen = new Set(first.players.map((player) => player.id));
      expect(second.players.some((player) => seen.has(player.id))).toBe(false);
    }
  });

  it("finds players by pseudo and sorts them by any column", async () => {
    const admin = await signInAsAdmin();
    const tag = crypto.randomUUID().slice(0, 6);
    const first = await signInAsNamedMember();
    const second = await signInAsNamedMember();
    await namePlayer(first.userId, `Tri${tag}a`);
    await namePlayer(second.userId, `Tri${tag}b`);
    const card = `${STARTER_COLLECTION}-common-1`;
    await setOwnedCards(db, first.userId, [{ cardId: card, quantity: 2 }]);
    const list = async (query: string) =>
      adminPlayersResponseSchema.parse(
        await (await request(admin, `/admin/players?q=tri${tag}&${query}`)).json(),
      );

    const byPseudo = await list("sort=pseudo&dir=asc");
    expect(byPseudo.total).toBe(2);
    expect(byPseudo.players.map((player) => player.pseudo)).toEqual([`Tri${tag}a`, `Tri${tag}b`]);
    expect((await list("sort=pseudo&dir=desc")).players[0]?.id).toBe(second.userId);
    const byCards = await list("sort=cards&dir=desc");
    expect(byCards.players[0]).toMatchObject({ id: first.userId, cards: 1, boosters: 0 });
    expect((await list("sort=cards&dir=asc")).players[0]?.id).toBe(second.userId);
    expect((await request(admin, "/admin/players?sort=nope")).status).toBe(400);
  });

  it("pages through a sort, players without a pseudo last, and refuses a cursor of another sort", async () => {
    const admin = await signInAsAdmin();
    const tag = `page${crypto.randomUUID().slice(0, 6)}`;
    const ids = Array.from({ length: 60 }, (_, n) => `${tag}-${String(n).padStart(2, "0")}`);
    await db.insert(users).values(ids.map((id) => ({ id, name: id, email: `${id}@example.com` })));
    // Every other player has a pseudo, written backwards so that ids and pseudos disagree.
    await db.insert(players).values(
      ids.flatMap((id, n) =>
        n % 2 === 0
          ? [
              {
                userId: id,
                code: crypto.randomUUID().slice(0, 8).toUpperCase(),
                pseudo: `P${tag}${99 - n}`,
                pseudoKey: `p${tag}${99 - n}`,
                pseudoChangedAt: new Date(),
              },
            ]
          : [],
      ),
    );
    const path = `/admin/players?q=${tag}&sort=pseudo&dir=asc`;
    const first = adminPlayersResponseSchema.parse(await (await request(admin, path)).json());
    expect(first.total).toBe(60);
    expect(first.nextCursor).not.toBeNull();
    const second = adminPlayersResponseSchema.parse(
      await (await request(admin, `${path}&cursor=${first.nextCursor}`)).json(),
    );
    expect(second.total).toBe(60);
    expect(second.nextCursor).toBeNull();

    const seen = [...first.players, ...second.players];
    expect(new Set(seen.map((player) => player.id)).size).toBe(60);
    const pseudos = seen.map((player) => player.pseudo);
    const named = pseudos.slice(0, 30);
    expect(named).toEqual([...named].sort());
    expect(pseudos.slice(30).every((pseudo) => pseudo === null)).toBe(true);
    expect(
      (await request(admin, `/admin/players?q=${tag}&cursor=${first.nextCursor}`)).status,
    ).toBe(400);
  });

  it("shows a player's game", async () => {
    const admin = await signInAsAdmin();
    const member = await signInAsNamedMember();
    expect((await request(admin, "/admin/players/unknown")).status).toBe(404);
    const detail = adminPlayerDetailSchema.parse(
      await (await request(admin, `/admin/players/${member.userId}`)).json(),
    );
    expect(detail.player.email).toBe(member.email);
    expect(detail.wallet).toMatchObject({ bonus: 0, bonusCap: BONUS_CAP });
    expect(detail.opens.total).toBe(0);
  });
});

describe("POST /admin/players/:id/bonus", () => {
  it("adds bonus boosters, up to the reserve's cap, and logs the gift", async () => {
    const admin = await signInAsAdmin();
    const member = await signInAsMember(app, env, db);

    const first = adminGrantBonusResponseSchema.parse(
      await (await grant(admin, member.userId, 3)).json(),
    );
    expect(first).toEqual({ added: 3, bonus: 3 });
    const capped = adminGrantBonusResponseSchema.parse(
      await (await grant(admin, member.userId, 10)).json(),
    );
    expect(capped).toEqual({ added: BONUS_CAP - 3, bonus: BONUS_CAP });

    const detail = adminPlayerDetailSchema.parse(
      await (await request(admin, `/admin/players/${member.userId}`)).json(),
    );
    expect(detail.actions.map((action) => action.details["added"])).toEqual([BONUS_CAP - 3, 3]);
  });

  it("applies a retried request once", async () => {
    const admin = await signInAsAdmin();
    const member = await signInAsMember(app, env, db);
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([
      grant(admin, member.userId, 2, key),
      grant(admin, member.userId, 2, key),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await bonusOf(member.userId)).toBe(2);
  });

  it("never overfills the reserve under concurrent gifts", async () => {
    const admin = await signInAsAdmin();
    const member = await signInAsMember(app, env, db);
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => grant(admin, member.userId, 4)),
    );
    const added = await Promise.all(
      responses.map(async (response) => adminGrantBonusResponseSchema.parse(await response.json())),
    );
    expect(added.reduce((total, gift) => total + gift.added, 0)).toBe(BONUS_CAP);
    expect(await bonusOf(member.userId)).toBe(BONUS_CAP);
  });

  it("refuses a missing key, a bad amount and an unknown player", async () => {
    const admin = await signInAsAdmin();
    const member = await signInAsMember(app, env, db);
    const noKey = await post(admin, `/admin/players/${member.userId}/bonus`, {
      amount: 1,
      reason: "x",
    });
    expect(noKey.status).toBe(400);
    expect((await grant(admin, member.userId, 0)).status).toBe(400);
    expect((await grant(admin, member.userId, 11)).status).toBe(400);
    expect((await grant(admin, "unknown", 1)).status).toBe(404);
  });
});

describe("bans", () => {
  it("bans a player, deletes their sessions, and lifts the ban", async () => {
    const admin = await signInAsAdmin();
    const member = await signInAsMember(app, env, db);

    const banned = await post(admin, `/admin/players/${member.userId}/ban`, {
      reason: "triche",
      days: 7,
    });
    expect(banned.status).toBe(200);
    expect(await db.select().from(sessions).where(eq(sessions.userId, member.userId))).toEqual([]);
    const detail = adminPlayerDetailSchema.parse(
      await (await request(admin, `/admin/players/${member.userId}`)).json(),
    );
    expect(detail.player).toMatchObject({ banned: true, banReason: "triche" });
    expect(Date.parse(detail.player.banExpires ?? "")).toBeGreaterThan(Date.now() + 6 * DAY);

    expect((await post(admin, `/admin/players/${member.userId}/unban`, {})).status).toBe(200);
    const lifted = adminPlayerDetailSchema.parse(
      await (await request(admin, `/admin/players/${member.userId}`)).json(),
    );
    expect(lifted.player).toMatchObject({ banned: false, banReason: null, banExpires: null });
  });

  it("never bans an admin", async () => {
    const admin = await signInAsAdmin();
    const other = await signInAsAdmin();
    const response = await post(admin, `/admin/players/${other.userId}/ban`, {
      reason: "x",
      days: null,
    });
    expect(response.status).toBe(409);
  });

  it("keeps a banned admin out of the back office", async () => {
    const admin = await signInAsAdmin();
    await db.update(users).set({ banned: true }).where(eq(users.id, admin.userId));
    expect((await request(admin, "/admin/overview")).status).toBe(403);
  });
});

describe("waiting list", () => {
  it("lists addresses and exports them as CSV, formulas neutralised", async () => {
    const admin = await signInAsAdmin();
    const email = `=attente-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await db.insert(waitlistSignups).values({ email });

    const page = adminWaitlistResponseSchema.parse(
      await (await request(admin, "/admin/waitlist")).json(),
    );
    expect(page.total).toBeGreaterThan(0);
    expect(page.entries.map((entry) => entry.email)).toContain(email);

    const csv = await request(admin, "/admin/waitlist/export");
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    expect(text.startsWith("email,inscrit_le\n")).toBe(true);
    expect(text).toContain(`'${email},`);

    const log = adminActionsResponseSchema.parse(
      await (await request(admin, "/admin/actions")).json(),
    );
    expect(log.actions[0]).toMatchObject({ action: "export_waitlist" });
  });
});

describe("trades", () => {
  async function pendingTrade(proposerId: string, recipientId: string): Promise<string> {
    const id = crypto.randomUUID();
    await db.insert(trades).values({
      id,
      proposerId,
      recipientId,
      idempotencyKey: crypto.randomUUID(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DAY),
    });
    await db.insert(tradeItems).values([
      { tradeId: id, side: "give", cardId: "test-a-common-1" },
      { tradeId: id, side: "want", cardId: "test-a-common-2" },
    ]);
    return id;
  }

  it("lists offers and cancels a pending one once", async () => {
    const admin = await signInAsAdmin();
    const [a, b] = await Promise.all([signInAsMember(app, env, db), signInAsMember(app, env, db)]);
    const id = await pendingTrade(a.userId, b.userId);

    const list = adminTradesResponseSchema.parse(
      await (await request(admin, "/admin/trades?status=pending")).json(),
    );
    const listed = list.trades.find((trade) => trade.id === id);
    expect(listed).toMatchObject({ give: ["test-a-common-1"], want: ["test-a-common-2"] });

    expect((await post(admin, `/admin/trades/${id}/cancel`, { reason: "abus" })).status).toBe(200);
    expect((await post(admin, `/admin/trades/${id}/cancel`, { reason: "abus" })).status).toBe(409);
    expect(
      (await post(admin, `/admin/trades/${crypto.randomUUID()}/cancel`, { reason: "x" })).status,
    ).toBe(404);
    const [row] = await db.select({ status: trades.status }).from(trades).where(eq(trades.id, id));
    expect(row?.status).toBe("cancelled");
  });
});

describe("GET /admin/catalog", () => {
  it("counts the cards of each collection by rarity", async () => {
    const admin = await signInAsAdmin();
    const catalog = adminCatalogSchema.parse(await (await request(admin, "/admin/catalog")).json());
    const testA = catalog.collections.find((collection) => collection.id === "test-a");
    expect(testA).toMatchObject({ published: true });
    expect(testA?.byRarity.common).toBe(3);
  });
});

describe("GET /admin/cards/:id", () => {
  // A card of the hidden collection: no booster draws it while other test files run.
  const cardId = "test-hidden-epic-2";

  it("counts a card's owners and copies", async () => {
    const admin = await signInAsAdmin();
    const read = async () =>
      adminCardStatsSchema.parse(await (await request(admin, `/admin/cards/${cardId}`)).json());
    const before = await read();
    const owner = await signInAsMember(app, env, db);
    await setOwnedCards(db, owner.userId, [{ cardId, quantity: 2 }]);
    const after = await read();
    expect(after.owners - before.owners).toBe(1);
    expect(after.copies - before.copies).toBe(2);
    expect(after.retired).toBe(false);
  });

  it("does not know a card missing from the server", async () => {
    const admin = await signInAsAdmin();
    expect((await request(admin, "/admin/cards/inconnue")).status).toBe(404);
  });
});
