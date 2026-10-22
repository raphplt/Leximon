import {
  boosterWalletSchema,
  claimGoalResponseSchema,
  clanJoinResultSchema,
  clanMessageSchema,
  clanMessagesResponseSchema,
  clanRequestsResponseSchema,
  clansResponseSchema,
  clanViewSchema,
  myClanResponseSchema,
} from "@leximon/contract";
import { BONUS_SCHEDULE, gameWeekOf, pseudoKey, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { runMaintenance } from "../maintenance";
import { recordingQueue, TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, signInAsGuest, signInAsMember } from "../test-support";
import { handleGameEvents } from "./events";

const url = testDatabaseUrl();
const events = recordingQueue<unknown>();
const env: Env = { ...testEnv(url), GAME_EVENTS: events as Queue };
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 8 });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const { boosterWallets, clanMembers, clanMessages, clans, moderationReports, players, userCards } =
  schema;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

interface Player extends Guest {
  readonly code: string;
  readonly pseudo: string;
}

/** A member with a pseudo, at a level (10 joins a clan, 15 creates one). */
async function player(level = 15): Promise<Player> {
  const member = await signInAsMember(app, env, db);
  expect((await request(member, "/me/profile")).status).toBe(200);
  const pseudo = `Joueur ${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await db
    .update(players)
    .set({
      pseudo,
      pseudoKey: pseudoKey(pseudo),
      pseudoChangedAt: new Date("2026-01-01T00:00:00Z"),
    })
    .where(eq(players.userId, member.userId))
    .returning({ code: players.code });
  await db
    .insert(schema.userProgress)
    .values({ userId: member.userId, xp: xpToReach(level) })
    .onConflictDoUpdate({
      target: schema.userProgress.userId,
      set: { xp: xpToReach(level) },
    });
  if (row === undefined) throw new Error("No player row");
  return { ...member, code: row.code, pseudo };
}

function request(who: Guest | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", TEST_ORIGIN);
  if (who !== null) headers.set("cookie", who.cookie);
  return app.request(path, { ...init, headers }, env);
}

function send(who: Guest, method: string, path: string, body?: unknown) {
  return request(who, path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

function uniqueName(prefix = "Clan") {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

const EMBLEM = { engraving: "aiguiere", colors: ["sang", "or"] };

async function createClan(
  chief: Player,
  entryMode: "open" | "request" | "invite" = "open",
  name = uniqueName(),
): Promise<string> {
  const response = await send(chief, "POST", "/clans", {
    name,
    motto: "Les mots d'abord",
    entryMode,
    emblem: EMBLEM,
  });
  expect(response.status).toBe(201);
  return clanJoinResultSchema.parse(await response.json()).clanId;
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

async function view(who: Player, clanId: string) {
  const response = await request(who, `/clans/${clanId}`);
  expect(response.status).toBe(200);
  return clanViewSchema.parse(await response.json());
}

async function memberCount(clanId: string): Promise<{ stored: number; actual: number }> {
  const [row] = await db
    .select({
      stored: clans.memberCount,
      actual: sql<number>`(select count(*)::int from clan_members m where m.clan_id = ${clans.id})`,
    })
    .from(clans)
    .where(eq(clans.id, clanId));
  return row ?? { stored: -1, actual: -1 };
}

/** Cards that entered the player's album at `at` (the week's new words). */
async function giveNewCards(userId: string, cardIds: readonly string[], at = new Date()) {
  await db
    .insert(userCards)
    .values(
      cardIds.map((cardId) => ({
        userId,
        cardId,
        quantity: 1,
        firstObtainedAt: at,
        lastObtainedAt: at,
      })),
    )
    .onConflictDoNothing();
}

/** Every test card id, 3 per rarity and collection. */
async function cardIds(): Promise<string[]> {
  const rows = await db.select({ id: schema.cards.id }).from(schema.cards);
  return rows.map((row) => row.id).sort();
}

describe("creating a clan", () => {
  it("needs an account, a pseudo and level 15", async () => {
    const guest = await signInAsGuest(app, env);
    const body = { name: uniqueName(), motto: "", entryMode: "open", emblem: EMBLEM };
    expect(await errorOf(await send(guest, "POST", "/clans", body))).toBe("account_required");

    const low = await player(14);
    expect(await errorOf(await send(low, "POST", "/clans", body))).toBe("level_too_low");

    const anonymous = await player(15);
    await db
      .update(players)
      .set({ pseudo: null, pseudoKey: null, pseudoChangedAt: null })
      .where(eq(players.userId, anonymous.userId));
    expect(await errorOf(await send(anonymous, "POST", "/clans", body))).toBe("pseudo_required");
  });

  it("makes the founder its chief, with a unique and filtered name", async () => {
    const chief = await player();
    const name = uniqueName("Les Plumes");
    const clanId = await createClan(chief, "open", name);
    const page = await view(chief, clanId);
    expect(page.clan).toMatchObject({ name, memberCount: 1, entryMode: "open" });
    expect(page.me?.role).toBe("chief");
    expect(page.me?.inviteCode).toMatch(/^[0-9A-Z]{8}$/);
    expect(page.goal).not.toBeNull();

    const other = await player();
    const taken = await send(other, "POST", "/clans", {
      name: name.toUpperCase().replace(" ", "-"),
      motto: "",
      entryMode: "open",
      emblem: EMBLEM,
    });
    expect(taken.status).toBe(409);
    expect(await errorOf(taken)).toBe("name_taken");

    const refused = await send(other, "POST", "/clans", {
      name: "Clan Moderateur",
      motto: "",
      entryMode: "open",
      emblem: EMBLEM,
    });
    expect(await errorOf(refused)).toBe("name_refused");

    const locked = await send(other, "POST", "/clans", {
      name: uniqueName(),
      motto: "",
      entryMode: "open",
      emblem: { engraving: "antitonnerre", colors: ["sang", "or"] },
    });
    expect(await errorOf(locked)).toBe("emblem_not_allowed");
  });

  it("is found by name prefix, the biggest clans first", async () => {
    const tag = crypto.randomUUID().slice(0, 6);
    const small = await createClan(await player(), "open", `Zq${tag} Petit`);
    const big = await createClan(await player(), "open", `Zq${tag} Grand`);
    expect((await send(await player(10), "POST", `/clans/${big}/join`)).status).toBe(200);

    const searcher = await player(10);
    const response = await request(searcher, `/clans?q=zq${tag}`);
    const body = clansResponseSchema.parse(await response.json());
    expect(body.clans.map((clan) => clan.id)).toEqual([big, small]);

    const visitor = await view(searcher, big);
    expect(visitor.me).toBeNull();
    expect(visitor.goal).toBeNull();
    expect(visitor.members).toHaveLength(2);
  });
});

describe("entering and leaving", () => {
  it("enters an open clan at level 10, asks to enter a clan on request", async () => {
    const chief = await player();
    const open = await createClan(chief);
    const low = await player(9);
    expect(await errorOf(await send(low, "POST", `/clans/${open}/join`))).toBe("level_too_low");

    const member = await player(10);
    const joined = clanJoinResultSchema.parse(
      await (await send(member, "POST", `/clans/${open}/join`)).json(),
    );
    expect(joined.outcome).toBe("joined");
    expect(await memberCount(open)).toEqual({ stored: 2, actual: 2 });
    expect(events.sent).toContainEqual({ type: "clan_changed", clanId: open });

    const onRequest = await createClan(await player(), "request");
    const asker = await player(10);
    const asked = clanJoinResultSchema.parse(
      await (await send(asker, "POST", `/clans/${onRequest}/join`)).json(),
    );
    expect(asked.outcome).toBe("requested");
    const mine = myClanResponseSchema.parse(await (await request(asker, "/me/clan")).json());
    expect(mine).toMatchObject({ clanId: null, requests: [onRequest] });
  });

  it("lets the chief or a deputy accept a request, never a plain member", async () => {
    const chief = await player();
    const clanId = await createClan(chief, "request");
    const member = await player(10);
    await db
      .insert(clanMembers)
      .values({ userId: member.userId, clanId, role: "member", joinedAt: new Date() });
    await db.update(clans).set({ memberCount: 2 }).where(eq(clans.id, clanId));
    const asker = await player(10);
    await send(asker, "POST", `/clans/${clanId}/join`);

    expect(
      (await send(member, "POST", `/clans/${clanId}/requests/${asker.code}/accept`)).status,
    ).toBe(403);
    const list = clanRequestsResponseSchema.parse(
      await (await request(chief, `/clans/${clanId}/requests`)).json(),
    );
    expect(list.requests.map((r) => r.player.code)).toEqual([asker.code]);
    expect(
      (await send(chief, "POST", `/clans/${clanId}/requests/${asker.code}/accept`)).status,
    ).toBe(204);
    expect(await memberCount(clanId)).toEqual({ stored: 3, actual: 3 });
    expect((await view(chief, clanId)).pendingRequests).toBe(0);
  });

  it("opens a clan by invitation only with its code, until the chief renews it", async () => {
    const chief = await player();
    const clanId = await createClan(chief, "invite");
    const code = (await view(chief, clanId)).me?.inviteCode ?? "";
    const guest = await player(10);
    expect(await errorOf(await send(guest, "POST", `/clans/${clanId}/join`))).toBe("invite_only");

    const renewed = await send(chief, "POST", `/clans/${clanId}/invite-code`);
    const { inviteCode } = (await renewed.json()) as { inviteCode: string };
    expect(inviteCode).not.toBe(code);
    expect(await errorOf(await send(guest, "POST", "/clans/join", { code }))).toBe(
      "clan_not_found",
    );
    expect(
      (await send(guest, "POST", "/clans/join", { code: inviteCode.toLowerCase() })).status,
    ).toBe(200);
  });

  it("keeps the count exact when many players join at once", async () => {
    const clanId = await createClan(await player());
    const joiners = await Promise.all(Array.from({ length: 8 }, () => player(10)));
    const responses = await Promise.all(
      joiners.map((p) => send(p, "POST", `/clans/${clanId}/join`)),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
    expect(await memberCount(clanId)).toEqual({ stored: 9, actual: 9 });
  });

  it("puts a player in one clan only, even when they join two at once", async () => {
    const first = await createClan(await player());
    const second = await createClan(await player());
    const joiner = await player(10);
    const responses = await Promise.all([
      send(joiner, "POST", `/clans/${first}/join`),
      send(joiner, "POST", `/clans/${second}/join`),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const rows = await db.select().from(clanMembers).where(eq(clanMembers.userId, joiner.userId));
    expect(rows).toHaveLength(1);
    const counts = [await memberCount(first), await memberCount(second)];
    expect(counts.map((c) => c.stored)).toEqual(counts.map((c) => c.actual));
  });

  it("hands the chief's role to the oldest deputy, then waits 24 h before another clan", async () => {
    const chief = await player();
    const clanId = await createClan(chief);
    const oldMember = await player(10);
    const deputy = await player(10);
    await send(oldMember, "POST", `/clans/${clanId}/join`);
    await send(deputy, "POST", `/clans/${clanId}/join`);
    expect(
      (await send(chief, "PUT", `/clans/${clanId}/members/${deputy.code}/role`, { role: "deputy" }))
        .status,
    ).toBe(204);

    expect((await send(chief, "POST", "/me/clan/leave")).status).toBe(204);
    const page = await view(deputy, clanId);
    expect(page.me?.role).toBe("chief");
    expect(page.clan.memberCount).toBe(2);

    const other = await createClan(await player());
    expect(await errorOf(await send(chief, "POST", `/clans/${other}/join`))).toBe(
      "rejoin_too_soon",
    );
    const mine = myClanResponseSchema.parse(await (await request(chief, "/me/clan")).json());
    expect(Date.parse(mine.rejoinAt ?? "")).toBeGreaterThan(Date.now() + 23 * HOUR);
  });

  it("dissolves the clan when the last member leaves", async () => {
    const chief = await player();
    const clanId = await createClan(chief);
    expect((await send(chief, "POST", "/me/clan/leave")).status).toBe(204);
    expect(await db.select().from(clans).where(eq(clans.id, clanId))).toHaveLength(0);
  });

  it("lets an excluded member join another clan at once; a deputy excludes no deputy", async () => {
    const chief = await player();
    const clanId = await createClan(chief);
    const [a, b, c] = await Promise.all([player(10), player(10), player(10)]);
    for (const p of [a, b, c]) await send(p, "POST", `/clans/${clanId}/join`);
    await send(chief, "PUT", `/clans/${clanId}/members/${a.code}/role`, { role: "deputy" });
    await send(chief, "PUT", `/clans/${clanId}/members/${b.code}/role`, { role: "deputy" });

    expect(await errorOf(await send(a, "POST", `/clans/${clanId}/members/${b.code}/kick`))).toBe(
      "not_allowed",
    );
    expect(await errorOf(await send(c, "POST", `/clans/${clanId}/members/${a.code}/kick`))).toBe(
      "not_allowed",
    );
    expect((await send(a, "POST", `/clans/${clanId}/members/${c.code}/kick`)).status).toBe(204);
    expect(await memberCount(clanId)).toEqual({ stored: 3, actual: 3 });

    const elsewhere = await createClan(await player());
    expect((await send(c, "POST", `/clans/${elsewhere}/join`)).status).toBe(200);
  });

  it("hands the role over when the chief stays away 14 days", async () => {
    const chief = await player();
    const clanId = await createClan(chief);
    const member = await player(10);
    await send(member, "POST", `/clans/${clanId}/join`);
    await db
      .update(players)
      .set({ lastSeenAt: new Date(Date.now() - 15 * DAY) })
      .where(eq(players.userId, chief.userId));

    expect((await view(member, clanId)).me?.role).toBe("chief");
  });
});

describe("the discussion", () => {
  async function clanWithMembers() {
    const chief = await player();
    const clanId = await createClan(chief);
    const member = await player(10);
    await send(member, "POST", `/clans/${clanId}/join`);
    return { chief, member, clanId };
  }

  it("posts, filters and paces messages, mixed with the journal", async () => {
    const { chief, member, clanId } = await clanWithMembers();
    const posted = await send(member, "POST", `/clans/${clanId}/messages`, {
      body: "  Salut   la compagnie  ",
    });
    expect(posted.status).toBe(201);
    const message = clanMessageSchema.parse(await posted.json());
    expect(message).toMatchObject({ kind: "message", body: "Salut la compagnie", mine: true });

    const tooSoon = await send(member, "POST", `/clans/${clanId}/messages`, { body: "Encore" });
    expect(tooSoon.status).toBe(409);
    expect(await errorOf(tooSoon)).toBe("too_soon");

    const refused = await send(chief, "POST", `/clans/${clanId}/messages`, {
      body: "espèce de connard",
    });
    expect(refused.status).toBe(422);
    expect(await errorOf(refused)).toBe("message_refused");

    const list = clanMessagesResponseSchema.parse(
      await (await request(chief, `/clans/${clanId}/messages`)).json(),
    );
    expect(list.messages[0]).toMatchObject({
      kind: "message",
      body: "Salut la compagnie",
      mine: false,
    });
    expect(
      list.messages
        .filter((m) => m.kind === "event")
        .map((m) => m.kind === "event" && m.event.type),
    ).toEqual(["joined", "joined"]);

    const after = clanMessagesResponseSchema.parse(
      await (await request(chief, `/clans/${clanId}/messages?after=${message.id}`)).json(),
    );
    expect(after.messages).toEqual([]);

    const outsider = await player(10);
    expect((await request(outsider, `/clans/${clanId}/messages`)).status).toBe(403);
  });

  it("lets the chief delete a message and silence a member", async () => {
    const { chief, member, clanId } = await clanWithMembers();
    const message = clanMessageSchema.parse(
      await (await send(member, "POST", `/clans/${clanId}/messages`, { body: "Bonjour" })).json(),
    );
    expect((await send(chief, "DELETE", `/clans/${clanId}/messages/${message.id}`)).status).toBe(
      204,
    );
    const list = clanMessagesResponseSchema.parse(
      await (await request(member, `/clans/${clanId}/messages`)).json(),
    );
    expect(list.messages[0]).toMatchObject({ id: message.id, body: null, removed: "deleted" });

    expect(
      await errorOf(
        await send(chief, "PUT", `/clans/${clanId}/members/${member.code}/mute`, {
          durationMs: 5000,
        }),
      ),
    ).toBe("mute_duration");
    expect(
      (
        await send(chief, "PUT", `/clans/${clanId}/members/${member.code}/mute`, {
          durationMs: HOUR,
        })
      ).status,
    ).toBe(204);
    await db
      .update(clanMembers)
      .set({ lastMessageAt: null })
      .where(eq(clanMembers.userId, member.userId));
    expect(
      await errorOf(await send(member, "POST", `/clans/${clanId}/messages`, { body: "Hé" })),
    ).toBe("muted");
    expect(
      (await send(chief, "DELETE", `/clans/${clanId}/members/${member.code}/mute`)).status,
    ).toBe(204);
    expect((await send(member, "POST", `/clans/${clanId}/messages`, { body: "Hé" })).status).toBe(
      201,
    );
  });

  it("reports a message once and hides the messages of a blocked player", async () => {
    const { chief, member, clanId } = await clanWithMembers();
    const message = clanMessageSchema.parse(
      await (
        await send(member, "POST", `/clans/${clanId}/messages`, { body: "Un message limite" })
      ).json(),
    );
    for (let i = 0; i < 2; i++) {
      expect(
        (await send(chief, "POST", `/clans/${clanId}/messages/${message.id}/report`)).status,
      ).toBe(204);
    }
    const reports = await db
      .select()
      .from(moderationReports)
      .where(
        and(
          eq(moderationReports.targetKind, "message"),
          eq(moderationReports.messageId, message.id),
        ),
      );
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      content: "Un message limite",
      reportedId: member.userId,
      clanId,
    });

    expect((await send(chief, "PUT", `/me/blocks/${member.code}`)).status).toBe(204);
    const list = clanMessagesResponseSchema.parse(
      await (await request(chief, `/clans/${clanId}/messages`)).json(),
    );
    expect(list.messages.some((m) => m.kind === "message" && m.id === message.id)).toBe(false);
  });
});

describe("the weekly goal", () => {
  it("counts the members' new words, reaches the tiers once and unlocks the emblem", async () => {
    const chief = await player();
    const clanId = await createClan(chief);
    const member = await player(10);
    await send(member, "POST", `/clans/${clanId}/join`);
    // The week starts with one active member: targets 5, 10 and 15.
    await view(chief, clanId);
    const ids = await cardIds();
    await giveNewCards(chief.userId, ids.slice(0, 12));
    await giveNewCards(member.userId, ids.slice(12, 15));
    // Found before joining: not the clan's.
    await giveNewCards(member.userId, ids.slice(20, 30), new Date(Date.now() - DAY * 10));

    const bodies = [
      { type: "cards_obtained", userId: chief.userId },
      { type: "cards_obtained", userId: member.userId },
    ];
    for (let i = 0; i < 2; i++) {
      await handleGameEvents(db, bodies, [Date.now(), Date.now()], Date.now());
    }

    const page = await view(chief, clanId);
    expect(page.goal).toMatchObject({ words: 15, tier: "gold", myWords: 12 });
    expect(page.emblemChoices.colors).toContain("vermillon");
    const tiers = await db
      .select({ key: clanMessages.eventKey })
      .from(clanMessages)
      .where(and(eq(clanMessages.clanId, clanId), sql`${clanMessages.eventKey} like 'tier:%'`));
    expect(tiers).toHaveLength(3);
    const legendaries = await db
      .select({ key: clanMessages.eventKey })
      .from(clanMessages)
      .where(
        and(eq(clanMessages.clanId, clanId), sql`${clanMessages.eventKey} like 'legendary:%'`),
      );
    expect(legendaries.length).toBe(
      ids.slice(0, 15).filter((id) => id.includes("legendary")).length,
    );
    expect(page.library.reduce((sum, row) => sum + row.owned, 0)).toBe(15 + 10);

    // Silver and gold give a booster each; the member brought 3 words, short of 5.
    const week = gameWeekOf(Date.now()).key;
    expect(page.goal?.claimable.map((c) => c.tier)).toEqual(["silver", "gold"]);
    const claims = await Promise.all([
      send(chief, "POST", "/me/clan/claims", { week, tier: "gold" }),
      send(chief, "POST", "/me/clan/claims", { week, tier: "gold" }),
    ]);
    expect(claims.map((r) => r.status)).toEqual([200, 200]);
    const silver = claimGoalResponseSchema.parse(
      await (await send(chief, "POST", "/me/clan/claims", { week, tier: "silver" })).json(),
    );
    expect(silver.wallet.bonus).toBe(2);
    expect(
      await errorOf(await send(chief, "POST", "/me/clan/claims", { week, tier: "bronze" })),
    ).toBe("goal_not_reached");
    expect(
      await errorOf(await send(member, "POST", "/me/clan/claims", { week, tier: "gold" })),
    ).toBe("goal_not_reached");
    const mine = myClanResponseSchema.parse(await (await request(chief, "/me/clan")).json());
    expect(mine.claimable).toEqual([]);
  });

  it("refuses a claim the reserve cannot hold, and keeps it for later", async () => {
    const chief = await player();
    const clanId = await createClan(chief);
    await view(chief, clanId);
    await giveNewCards(chief.userId, (await cardIds()).slice(0, 10));
    await handleGameEvents(
      db,
      [{ type: "cards_obtained", userId: chief.userId }],
      [Date.now()],
      Date.now(),
    );
    const wallet = boosterWalletSchema.parse(await (await request(chief, "/me/wallet")).json());
    await db
      .insert(boosterWallets)
      .values({
        userId: chief.userId,
        stored: wallet.stored,
        progressMs: 0,
        asOf: new Date(),
        bonusBoosters: BONUS_SCHEDULE[0].reserveCap,
      })
      .onConflictDoUpdate({
        target: boosterWallets.userId,
        set: { bonusBoosters: BONUS_SCHEDULE[0].reserveCap },
      });

    const week = gameWeekOf(Date.now()).key;
    expect(
      await errorOf(await send(chief, "POST", "/me/clan/claims", { week, tier: "silver" })),
    ).toBe("reserve_full");
    const mine = myClanResponseSchema.parse(await (await request(chief, "/me/clan")).json());
    expect(mine.claimable.map((c) => c.tier)).toEqual(["silver"]);
  });
});

describe("the daily maintenance", () => {
  it("erases messages older than 90 days, unless reported and not handled", async () => {
    const chief = await player();
    const clanId = await createClan(chief);
    const member = await player(10);
    await send(member, "POST", `/clans/${clanId}/join`);
    const old = new Date(Date.now() - 91 * DAY);
    const [kept, erased] = await db
      .insert(clanMessages)
      .values([
        { clanId, kind: "message", authorId: member.userId, body: "Signalé", createdAt: old },
        { clanId, kind: "message", authorId: member.userId, body: "Oublié", createdAt: old },
      ])
      .returning({ id: clanMessages.id });
    if (kept === undefined || erased === undefined) throw new Error("No messages");
    await send(chief, "POST", `/clans/${clanId}/messages/${kept.id}/report`);

    await runMaintenance(db, Date.now());
    const left = await db
      .select({ id: clanMessages.id })
      .from(clanMessages)
      .where(eq(clanMessages.clanId, clanId));
    expect(left.map((row) => row.id)).toContain(kept.id);
    expect(left.map((row) => row.id)).not.toContain(erased.id);
  });
});
