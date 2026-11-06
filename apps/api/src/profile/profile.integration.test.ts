import {
  blocksResponseSchema,
  playersResponseSchema,
  preferencesSchema,
  profileResponseSchema,
  publicProfileSchema,
  tradesResponseSchema,
} from "@leximon/contract";
import {
  LEVEL_REWARD_SCHEDULE,
  levelRewardRulesAt,
  levelRewards,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
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
  seedTestCatalog,
  setOwnedCards,
  setXp,
  signInAsGuest,
  signInAsMember,
} from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 4 });
/** The level of the public profile today: it comes down on dated changes, the tests follow it. */
const PROFILE_LEVEL = unlockRulesAt(UNLOCK_SCHEDULE, Date.now()).levels.public_profile;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

function call(player: Guest | null, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN };
  if (player !== null) headers["cookie"] = player.cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  return app.request(
    path,
    { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    env,
  );
}

async function profile(player: Guest) {
  const response = await call(player, "GET", "/me/profile");
  expect(response.status).toBe(200);
  return profileResponseSchema.parse(await response.json());
}

async function errorOf(response: Response) {
  return ((await response.json()) as { error: string }).error;
}

/** A unique pseudo per test run: the test database keeps players between files. */
function pseudo(base: string) {
  return `${base}${crypto.randomUUID().slice(0, 6)}`;
}

/** Records a claimed coffret, as `POST /me/level-rewards/:level` would. */
async function claim(userId: string, level: number) {
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.now());
  await setXp(db, userId, xpToReach(level));
  await db
    .insert(schema.userLevelRewards)
    .values({ userId, level, rewards: levelRewards(rules, level), claimedAt: new Date() })
    .onConflictDoNothing();
}

describe("GET /me/profile", () => {
  it("shows a guest what an account would have, with a starting avatar", async () => {
    const guest = await signInAsGuest(app, env);
    const own = await profile(guest);
    const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.now());

    expect(own.member).toBe(false);
    expect(own.pseudo).toBeNull();
    expect(rules.startingAvatars).toContain(own.avatar);
    expect(own.frame).toBe(rules.startingFrame);
    expect(own.pinnedSlots).toBe(3);
    expect(own.stats).toEqual({
      words: 0,
      legendaries: 0,
      gilded: 0,
      tradesCompleted: 0,
      completeCollections: 0,
      daysPlayed: 0,
    });
  });

  it("refuses to edit a guest's profile", async () => {
    const guest = await signInAsGuest(app, env);
    const response = await call(guest, "PATCH", "/me/profile", { pseudo: pseudo("Invite") });
    expect(response.status).toBe(403);
    expect(await errorOf(response)).toBe("account_required");
  });
});

describe("PATCH /me/profile: pseudo", () => {
  it("takes a pseudo, then refuses another change within the month", async () => {
    const member = await signInAsMember(app, env, db);
    const chosen = pseudo("Plume");
    const response = await call(member, "PATCH", "/me/profile", { pseudo: `  ${chosen} ` });
    expect(response.status).toBe(200);
    const own = profileResponseSchema.parse(await response.json());
    expect(own.pseudo).toBe(chosen);
    expect(own.pseudoChangeableFrom).not.toBeNull();

    const again = await call(member, "PATCH", "/me/profile", { pseudo: pseudo("Autre") });
    expect(again.status).toBe(409);
    expect(await errorOf(again)).toBe("pseudo_too_soon");
    // Sending the same pseudo again changes nothing and is not a change.
    expect((await call(member, "PATCH", "/me/profile", { pseudo: chosen })).status).toBe(200);
  });

  it("refuses a pseudo that reads like another, an insult, or a bad shape", async () => {
    const first = await signInAsMember(app, env, db);
    const second = await signInAsMember(app, env, db);
    const chosen = pseudo("Eloise");
    expect((await call(first, "PATCH", "/me/profile", { pseudo: chosen })).status).toBe(200);

    const taken = await call(second, "PATCH", "/me/profile", {
      pseudo: chosen.toUpperCase().replace("E", "É"),
    });
    expect(taken.status).toBe(409);
    expect(await errorOf(taken)).toBe("pseudo_taken");

    for (const [raw, error] of [
      ["Connard", "pseudo_refused"],
      ["Al", "pseudo_too_short"],
      ["Raph!", "pseudo_invalid"],
    ] as const) {
      const response = await call(second, "PATCH", "/me/profile", { pseudo: raw });
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toBe(error);
    }
  });

  it("gives a pseudo claimed at the same time to one player only", async () => {
    const players = await Promise.all([1, 2, 3].map(() => signInAsMember(app, env, db)));
    const chosen = pseudo("Course");
    const statuses = await Promise.all(
      players.map(async (player) => {
        const response = await call(player, "PATCH", "/me/profile", { pseudo: chosen });
        return response.status;
      }),
    );
    expect(statuses.sort()).toEqual([200, 409, 409]);
    const rows = await db
      .select({ userId: schema.players.userId })
      .from(schema.players)
      .where(eq(schema.players.pseudo, chosen));
    expect(rows).toHaveLength(1);
  });
});

describe("PATCH /me/profile: cosmetics", () => {
  it("wears only what the coffrets gave", async () => {
    const member = await signInAsMember(app, env, db);
    const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.now());
    const starting = rules.startingAvatars[1] ?? "";
    expect((await call(member, "PATCH", "/me/profile", { avatar: starting })).status).toBe(200);
    expect((await profile(member)).avatar).toBe(starting);

    for (const changes of [
      { avatar: "metoposcope" },
      { frame: "gilded" },
      { title: "Fine plume" },
    ]) {
      const response = await call(member, "PATCH", "/me/profile", changes);
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toBe("cosmetic_locked");
    }

    await claim(member.userId, 10);
    await claim(member.userId, 15);
    const response = await call(member, "PATCH", "/me/profile", {
      avatar: "metoposcope",
      frame: "gilded",
      title: "Fine plume",
      profilePublic: false,
    });
    expect(response.status).toBe(200);
    const own = profileResponseSchema.parse(await response.json());
    expect(own).toMatchObject({
      avatar: "metoposcope",
      frame: "gilded",
      title: "Fine plume",
      titleChosen: true,
      profilePublic: false,
      pinnedSlots: 4,
    });
  });
});

describe("PUT /me/pinned-cards", () => {
  it("pins owned cards in order, within the slots", async () => {
    const member = await signInAsMember(app, env, db);
    const ids = ["test-a-common-1", "test-a-rare-1", "test-b-epic-2", "test-a-common-2"];
    await setOwnedCards(
      db,
      member.userId,
      ids.map((cardId) => ({ cardId, quantity: 1 })),
    );

    const notOwned = await call(member, "PUT", "/me/pinned-cards", {
      cardIds: ["test-b-legendary-1"],
    });
    expect(notOwned.status).toBe(422);
    expect(await errorOf(notOwned)).toBe("card_not_owned");

    const tooMany = await call(member, "PUT", "/me/pinned-cards", { cardIds: ids });
    expect(await errorOf(tooMany)).toBe("too_many_pins");

    const twice = await call(member, "PUT", "/me/pinned-cards", {
      cardIds: [ids[0], ids[0]],
    });
    expect(await errorOf(twice)).toBe("duplicate_card");

    const pinned = [ids[2], ids[0], ids[1]];
    const response = await call(member, "PUT", "/me/pinned-cards", { cardIds: pinned });
    expect(response.status).toBe(200);
    expect(profileResponseSchema.parse(await response.json()).pinned).toEqual(pinned);
    expect((await call(member, "PUT", "/me/pinned-cards", { cardIds: [] })).status).toBe(200);
    expect((await profile(member)).pinned).toEqual([]);
  });
});

describe("GET /players/:pseudo", () => {
  it("opens at the public level, with the figures, and hides a private profile", async () => {
    const member = await signInAsMember(app, env, db);
    const chosen = pseudo("Public");
    await call(member, "PATCH", "/me/profile", { pseudo: chosen });
    await setOwnedCards(db, member.userId, [{ cardId: "test-a-legendary-1", quantity: 2 }]);
    const path = `/players/${encodeURIComponent(chosen.toLowerCase())}`;

    expect((await call(null, "GET", path)).status).toBe(404);

    await setXp(db, member.userId, xpToReach(8));
    const response = await call(null, "GET", path);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    const page = publicProfileSchema.parse(await response.json());
    expect(page).toMatchObject({ visibility: "public", pseudo: chosen, level: 8 });
    if (page.visibility === "public") {
      expect(page.stats.words).toBe(1);
      expect(page.stats.legendaries).toBe(1);
      expect(page.clan).toBeNull();
    }

    await setXp(db, member.userId, xpToReach(15));
    const clanName = `Clan ${crypto.randomUUID().slice(0, 8)}`;
    const emblem = { engraving: "aiguiere", colors: ["sang", "or"] };
    const created = await call(member, "POST", "/clans", {
      name: clanName,
      motto: "",
      entryMode: "open",
      emblem,
    });
    expect(created.status).toBe(201);
    const withClan = publicProfileSchema.parse(await (await call(null, "GET", path)).json());
    expect(withClan).toMatchObject({
      visibility: "public",
      clan: { name: clanName, emblem, level: 1 },
    });

    await call(member, "PATCH", "/me/profile", { profilePublic: false });
    const hidden = publicProfileSchema.parse(await (await call(null, "GET", path)).json());
    expect(Object.keys(hidden).sort()).toEqual(["avatar", "frame", "pseudo", "visibility"]);

    expect((await call(null, "GET", "/players/personne-ici")).status).toBe(404);
  });
});

describe("GET /players", () => {
  /** A member seen `seenAgo` ms ago, with a pseudo and the level of the public profile. */
  async function listedPlayer(tag: string, seenAgo = 0, level = 8) {
    const member = await signInAsMember(app, env, db);
    const name = `${tag} ${crypto.randomUUID().slice(0, 6)}`;
    expect((await call(member, "PATCH", "/me/profile", { pseudo: name })).status).toBe(200);
    await setXp(db, member.userId, xpToReach(level));
    await db
      .update(schema.players)
      .set({ lastSeenAt: new Date(Date.now() - seenAgo) })
      .where(eq(schema.players.userId, member.userId));
    return { ...member, name, code: (await profile(member)).playerCode };
  }

  async function search(viewer: Guest, tag: string, extra = "") {
    const response = await call(viewer, "GET", `/players?q=${tag}${extra}`);
    expect(response.status).toBe(200);
    return playersResponseSchema.parse(await response.json());
  }

  const pseudos = (page: { players: readonly { player: { pseudo: string | null } }[] }) =>
    page.players.map((entry) => entry.player.pseudo);

  const tag = () => `Zy${crypto.randomUUID().slice(0, 6)}`;

  it("lists public profiles from a pseudo prefix, the latest seen first, page by page", async () => {
    const prefix = tag();
    const old = await listedPlayer(prefix, 3_600_000);
    const recent = await listedPlayer(prefix, 60_000);
    const viewer = await signInAsGuest(app, env);

    const first = await search(viewer, prefix, "&limit=1");
    expect(pseudos(first)).toEqual([recent.name]);
    expect(first.players[0]?.clan).toBeNull();

    const second = await search(viewer, prefix, `&limit=1&cursor=${first.nextCursor}`);
    expect(pseudos(second)).toEqual([old.name]);
    expect(second.nextCursor).toBeNull();
  });

  it("sorts by arrival with its own cursor, the latest arrived first", async () => {
    const prefix = tag();
    const first = await listedPlayer(prefix, 60_000);
    const latest = await listedPlayer(prefix, 3_600_000);
    await db
      .update(schema.players)
      .set({ createdAt: new Date(Date.now() - 86_400_000) })
      .where(eq(schema.players.userId, first.userId));
    const viewer = await signInAsGuest(app, env);

    const page = await search(viewer, prefix, "&sort=new&limit=1");
    expect(pseudos(page)).toEqual([latest.name]);
    const next = await search(viewer, prefix, `&sort=new&limit=1&cursor=${page.nextCursor}`);
    expect(pseudos(next)).toEqual([first.name]);
  });

  it("keeps the players around the viewer's level for the near sort", async () => {
    const prefix = tag();
    const viewer = await listedPlayer(prefix, 0, 12);
    const below = await listedPlayer(prefix, 0, 10);
    const above = await listedPlayer(prefix, 0, 14);
    await listedPlayer(prefix, 0, 9);
    await listedPlayer(prefix, 0, 15);

    const near = await search(viewer, prefix, "&sort=near");
    expect(pseudos(near).sort()).toEqual([below.name, above.name].sort());
  });

  it("keeps the players without a clan on request", async () => {
    const prefix = tag();
    const free = await listedPlayer(prefix);
    const taken = await listedPlayer(prefix);
    const clanId = crypto.randomUUID();
    await db.insert(schema.clans).values({
      id: clanId,
      name: `Clan ${clanId.slice(0, 8)}`,
      nameKey: `clan${clanId.slice(0, 8)}`,
      entryMode: "open",
      inviteCode: clanId.slice(0, 8).toUpperCase(),
      emblemEngraving: "lion",
      emblemColor: "sang",
      emblemAccent: "or",
      memberCount: 1,
      createdAt: new Date(),
    });
    await db
      .insert(schema.clanMembers)
      .values({ userId: taken.userId, clanId, role: "chief", joinedAt: new Date() });
    const viewer = await signInAsGuest(app, env);

    expect(pseudos(await search(viewer, prefix)).sort()).toEqual([free.name, taken.name].sort());
    expect(pseudos(await search(viewer, prefix, "&clanless=1"))).toEqual([free.name]);
  });

  it("shows the first pinned cards of a row, in their order", async () => {
    const prefix = tag();
    const member = await listedPlayer(prefix);
    const [one, two, three, four] = await db
      .select({ id: schema.cards.id })
      .from(schema.cards)
      .limit(4);
    if (four === undefined || one === undefined || two === undefined || three === undefined) {
      throw new Error("Catalogue de test trop court");
    }
    await db.insert(schema.pinnedCards).values(
      [two, one, three, four].map((card, position) => ({
        userId: member.userId,
        cardId: card.id,
        position,
      })),
    );
    const viewer = await signInAsGuest(app, env);

    const page = await search(viewer, prefix);
    expect(page.players[0]?.pinned).toEqual([two.id, one.id, three.id]);
  });

  it("refuses an unknown sort", async () => {
    const viewer = await signInAsGuest(app, env);
    expect((await call(viewer, "GET", "/players?sort=level")).status).toBe(400);
    expect((await call(viewer, "GET", "/clans?sort=level")).status).toBe(400);
  });

  it("finds a pseudo whatever its accents, capitals and separators", async () => {
    const prefix = tag();
    const member = await listedPlayer(prefix);
    const viewer = await signInAsGuest(app, env);
    expect(pseudos(await search(viewer, prefix.toUpperCase()))).toEqual([member.name]);
    expect(pseudos(await search(viewer, `${prefix.slice(0, 2)}%25`))).toContain(member.name);
    expect(pseudos(await search(viewer, "%25_%25"))).not.toEqual([]);
  });

  it("leaves out private profiles, low levels, blocked and locked players, and the viewer", async () => {
    const prefix = tag();
    const viewer = await listedPlayer(prefix);
    const shown = await listedPlayer(prefix);
    const hidden = await listedPlayer(prefix);
    await call(hidden, "PATCH", "/me/profile", { profilePublic: false });
    await listedPlayer(prefix, 0, PROFILE_LEVEL - 1);
    const blocked = await listedPlayer(prefix);
    await call(viewer, "PUT", `/me/blocks/${blocked.code}`);
    const blocking = await listedPlayer(prefix);
    await call(blocking, "PUT", `/me/blocks/${(await profile(viewer)).playerCode}`);
    const suspended = await listedPlayer(prefix);
    await db.insert(schema.sanctions).values({
      id: crypto.randomUUID(),
      userId: suspended.userId,
      kind: "suspend",
      reason: "Test",
      until: new Date(Date.now() + 3_600_000),
      createdBy: viewer.userId,
      createdAt: new Date(),
    });
    const closed = await listedPlayer(prefix);
    await db.insert(schema.sanctions).values({
      id: crypto.randomUUID(),
      userId: closed.userId,
      kind: "close",
      reason: "Test",
      createdBy: viewer.userId,
      createdAt: new Date(),
    });

    expect(pseudos(await search(viewer, prefix))).toEqual([shown.name]);
  });

  it("needs a session and refuses a malformed cursor", async () => {
    expect((await call(null, "GET", "/players")).status).toBe(401);
    const viewer = await signInAsGuest(app, env);
    const response = await call(viewer, "GET", "/players?cursor=nope");
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("invalid_cursor");
  });
});

describe("blocks and reports", () => {
  async function pair() {
    const [a, b] = await Promise.all([signInAsMember(app, env, db), signInAsMember(app, env, db)]);
    const codeOf = async (player: Guest) => (await profile(player)).playerCode;
    return { a, b, aCode: await codeOf(a), bCode: await codeOf(b) };
  }

  it("cancels pending offers and hides the players from each other", async () => {
    const { a, b, bCode } = await pair();
    const pseudoB = pseudo("Bloque");
    await call(b, "PATCH", "/me/profile", { pseudo: pseudoB });
    await setXp(db, b.userId, xpToReach(8));
    const tradeId = crypto.randomUUID();
    await db.insert(schema.trades).values({
      id: tradeId,
      proposerId: b.userId,
      recipientId: a.userId,
      idempotencyKey: crypto.randomUUID(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    expect((await call(a, "PUT", `/me/blocks/${bCode}`)).status).toBe(204);
    expect((await call(a, "PUT", `/me/blocks/${bCode}`)).status).toBe(204);
    const [trade] = await db
      .select({ status: schema.trades.status })
      .from(schema.trades)
      .where(eq(schema.trades.id, tradeId));
    expect(trade?.status).toBe("cancelled");

    expect((await call(a, "GET", `/players/${bCode}/tradeable`)).status).toBe(404);
    expect((await call(a, "GET", `/players/${encodeURIComponent(pseudoB)}`)).status).toBe(404);
    expect((await call(null, "GET", `/players/${encodeURIComponent(pseudoB)}`)).status).toBe(200);

    const listed = blocksResponseSchema.parse(await (await call(a, "GET", "/me/blocks")).json());
    expect(listed.players.map((player) => player.code)).toEqual([bCode]);
    expect(listed.players[0]?.pseudo).toBe(pseudoB);

    expect((await call(a, "DELETE", `/me/blocks/${bCode}`)).status).toBe(204);
    expect((await call(a, "GET", `/players/${bCode}/tradeable`)).status).toBe(200);
  });

  it("refuses to block oneself, and guests", async () => {
    const { a, aCode } = await pair();
    expect(await errorOf(await call(a, "PUT", `/me/blocks/${aCode}`))).toBe("self");
    const guest = await signInAsGuest(app, env);
    expect((await call(guest, "PUT", `/me/blocks/${aCode}`)).status).toBe(403);
  });

  it("records a report of a pseudo once", async () => {
    const { a, b } = await pair();
    const pseudoB = pseudo("Signale");
    await call(b, "PATCH", "/me/profile", { pseudo: pseudoB });
    const path = `/players/${encodeURIComponent(pseudoB)}/report`;
    expect((await call(a, "POST", path)).status).toBe(204);
    expect((await call(a, "POST", path)).status).toBe(204);
    const rows = await db
      .select({ pseudo: schema.moderationReports.pseudo })
      .from(schema.moderationReports)
      .where(
        and(
          eq(schema.moderationReports.reporterId, a.userId),
          eq(schema.moderationReports.reportedId, b.userId),
        ),
      );
    expect(rows).toEqual([{ pseudo: pseudoB }]);
  });
});

describe("/me/preferences", () => {
  it("says everything until the player turns something off", async () => {
    const member = await signInAsMember(app, env, db);
    const read = async () =>
      preferencesSchema.parse(await (await call(member, "GET", "/me/preferences")).json());
    expect(await read()).toEqual({
      notifyReviews: true,
      notifyTrades: true,
      notifyClanMentions: true,
      notifyJousts: true,
      friendRequestsOpen: true,
      shareFinds: true,
      emailNews: true,
      emailReminders: true,
      reviewLength: 10,
      newWordsPerDay: 10,
      reviewListen: true,
      reviewPairs: true,
      reviewDifficulty: "normal",
    });
    expect(
      (await call(member, "PATCH", "/me/preferences", { notifyTrades: false, emailNews: false }))
        .status,
    ).toBe(200);
    expect(await read()).toEqual({
      notifyReviews: true,
      notifyTrades: false,
      notifyClanMentions: true,
      notifyJousts: true,
      friendRequestsOpen: true,
      shareFinds: true,
      emailNews: false,
      emailReminders: true,
      reviewLength: 10,
      newWordsPerDay: 10,
      reviewListen: true,
      reviewPairs: true,
      reviewDifficulty: "normal",
    });
    expect((await call(member, "PATCH", "/me/preferences", {})).status).toBe(400);
  });
});

describe("DELETE /me/account", () => {
  it("erases the player at once and leaves the other player's history", async () => {
    const [leaving, staying] = await Promise.all([
      signInAsMember(app, env, db),
      signInAsMember(app, env, db),
    ]);
    await profile(leaving);
    const stayingCode = (await profile(staying)).playerCode;
    await setOwnedCards(db, leaving.userId, [{ cardId: "test-a-common-1", quantity: 3 }]);
    const done = crypto.randomUUID();
    const pending = crypto.randomUUID();
    for (const [id, status] of [
      [done, "completed"],
      [pending, "pending"],
    ] as const) {
      await db.insert(schema.trades).values({
        id,
        proposerId: leaving.userId,
        recipientId: staying.userId,
        status,
        idempotencyKey: crypto.randomUUID(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      await db.insert(schema.tradeItems).values([
        { tradeId: id, side: "give", cardId: "test-a-common-1" },
        { tradeId: id, side: "want", cardId: "test-a-common-2" },
      ]);
    }

    const [account] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, leaving.userId));
    if (account === undefined) throw new Error("No account");
    await db.insert(schema.waitlistSignups).values({ email: account.email.toLowerCase() });

    const response = await call(leaving, "DELETE", "/me/account");
    expect(response.status).toBe(204);
    expect(
      await db
        .select()
        .from(schema.waitlistSignups)
        .where(eq(schema.waitlistSignups.email, account.email.toLowerCase())),
    ).toEqual([]);
    expect(response.headers.getSetCookie().join("\n")).toContain("session_token=;");

    expect(await db.select().from(schema.users).where(eq(schema.users.id, leaving.userId))).toEqual(
      [],
    );
    expect(
      await db.select().from(schema.userCards).where(eq(schema.userCards.userId, leaving.userId)),
    ).toEqual([]);
    const received = tradesResponseSchema.parse(
      await (await call(staying, "GET", "/trades?box=incoming")).json(),
    );
    const byId = new Map(received.trades.map((trade) => [trade.id, trade]));
    expect(byId.get(done)).toMatchObject({ status: "completed", proposer: null, proposerCode: "" });
    expect(byId.get(done)?.recipientCode).toBe(stayingCode);
    expect(byId.get(pending)?.status).toBe("cancelled");
  });

  it("refuses an admin, whose actions stay in the audit log", async () => {
    const admin = await signInAsMember(app, env, db);
    await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, admin.userId));
    const response = await call(admin, "DELETE", "/me/account");
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("admin_account");
  });
});
