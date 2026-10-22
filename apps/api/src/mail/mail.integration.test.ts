import {
  clanJoinResultSchema,
  clanMembersResponseSchema,
  clanMessageSchema,
  clanMessagesResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type MailLetter,
  mailResponseSchema,
  markMailReadResponseSchema,
  profileResponseSchema,
  tradeSchema,
} from "@leximon/contract";
import { pseudoKey, TRADE_SCHEDULE, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { handleGameEvents } from "../clans/events";
import { recordingQueue, TEST_ORIGIN, testEnv } from "../test-env";
import {
  ageAccount,
  type Guest,
  type OwnedCard,
  seedTestCatalog,
  setOwnedCards,
  signInAsMember,
} from "../test-support";
import { excerpt, MAIL_RETENTION_MS, purgeMail } from "./mail";

const url = testDatabaseUrl();
const events = recordingQueue<unknown>();
const env: Env = { ...testEnv(url), GAME_EVENTS: events as Queue };
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 8 });
const DAY = 86_400_000;
const RULES = TRADE_SCHEDULE[0];

const { mailLetters, players, userMastery } = schema;

beforeAll(() => seedTestCatalog(db));
afterAll(close);
beforeEach(() => {
  events.sent.length = 0;
});

interface Player extends Guest {
  readonly code: string;
  readonly pseudo: string;
}

/** A member with a pseudo, old enough and of a high enough level to trade and lead a clan. */
async function player(owned: readonly OwnedCard[] = [], pseudo = randomPseudo()): Promise<Player> {
  const member = await signInAsMember(app, env, db);
  await ageAccount(db, member.userId, RULES.minAccountAgeMs + DAY);
  const profile = profileResponseSchema.parse(await (await request(member, "/me/profile")).json());
  await db
    .update(players)
    .set({ pseudo, pseudoKey: pseudoKey(pseudo), pseudoChangedAt: new Date("2026-01-01") })
    .where(eq(players.userId, member.userId));
  await db
    .insert(schema.userProgress)
    .values({ userId: member.userId, xp: xpToReach(15) })
    .onConflictDoUpdate({ target: schema.userProgress.userId, set: { xp: xpToReach(15) } });
  if (owned.length > 0) await setOwnedCards(db, member.userId, owned);
  return { ...member, code: profile.playerCode, pseudo };
}

function randomPseudo() {
  return `Joueur ${crypto.randomUUID().slice(0, 8)}`;
}

function request(who: Guest, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", TEST_ORIGIN);
  headers.set("cookie", who.cookie);
  return app.request(path, { ...init, headers }, env);
}

function send(who: Guest, method: string, path: string, body?: unknown) {
  return request(who, path, {
    method,
    headers: {
      "content-type": "application/json",
      [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

/** Runs the queue's consumer on what the routes sent, as many times as asked. */
async function consume(times = 1) {
  const bodies = [...events.sent];
  events.sent.length = 0;
  for (let i = 0; i < times; i++) {
    await handleGameEvents(
      db,
      bodies,
      bodies.map(() => Date.now()),
      Date.now(),
    );
  }
}

async function mail(who: Player, query = "") {
  const response = await request(who, `/me/mail${query}`);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return mailResponseSchema.parse(await response.json());
}

function kinds(letters: readonly MailLetter[]) {
  return letters.map((letter) => [letter.kind, letter.read]);
}

async function createClan(chief: Player, entryMode: "open" | "request"): Promise<string> {
  const response = await send(chief, "POST", "/clans", {
    name: `Clan ${crypto.randomUUID().slice(0, 8)}`,
    motto: "",
    entryMode,
    emblem: { engraving: "aiguiere", colors: ["sang", "or"] },
  });
  expect(response.status).toBe(201);
  return clanJoinResultSchema.parse(await response.json()).clanId;
}

const COMMON_1 = "test-a-common-1";
const COMMON_2 = "test-a-common-2";

describe("letters about offers", () => {
  async function offer() {
    const alice = await player([{ cardId: COMMON_1, quantity: 2 }]);
    const bob = await player([{ cardId: COMMON_2, quantity: 2 }]);
    const response = await send(alice, "POST", "/trades", {
      recipientCode: bob.code,
      give: [COMMON_1],
      want: [COMMON_2],
    });
    expect(response.status).toBe(201);
    return { alice, bob, trade: tradeSchema.parse(await response.json()) };
  }

  it("tells the recipient, once, then the proposer when it is accepted", async () => {
    const { alice, bob, trade } = await offer();
    expect(events.sent).toContainEqual({ type: "trade_changed", tradeId: trade.id });
    await consume(2);

    const received = await mail(bob);
    expect(received.unread).toBe(1);
    expect(received.letters).toEqual([
      expect.objectContaining({
        kind: "offer_received",
        tradeId: trade.id,
        read: false,
        player: expect.objectContaining({ code: alice.code, pseudo: alice.pseudo }),
      }),
    ]);
    expect((await mail(alice)).letters).toEqual([]);

    expect((await send(bob, "POST", `/trades/${trade.id}/accept`)).status).toBe(200);
    await consume();

    const answered = await mail(alice);
    expect(kinds(answered.letters)).toEqual([["offer_completed", false]]);
    expect(answered.letters[0]?.player?.code).toBe(bob.code);
    // Nothing left to answer: the recipient's letter is read.
    expect(await mail(bob)).toMatchObject({ unread: 0, letters: [{ read: true }] });
  });

  it("tells the proposer of a declined offer, and nobody of a cancelled one", async () => {
    const declined = await offer();
    expect((await send(declined.bob, "POST", `/trades/${declined.trade.id}/decline`)).status).toBe(
      200,
    );
    const cancelled = await offer();
    await consume();
    expect(
      (await send(cancelled.alice, "POST", `/trades/${cancelled.trade.id}/cancel`)).status,
    ).toBe(200);
    await consume();

    expect(kinds((await mail(declined.alice)).letters)).toEqual([["offer_declined", false]]);
    // Answered before the consumer ran: no letter for an offer already gone.
    expect((await mail(declined.bob)).letters).toEqual([]);
    expect(kinds((await mail(cancelled.bob)).letters)).toEqual([["offer_received", true]]);
    expect((await mail(cancelled.alice)).letters).toEqual([]);
  });

  it("writes each letter once when consumers run at the same time", async () => {
    const { bob } = await offer();
    const bodies = [...events.sent];
    await Promise.all(
      Array.from({ length: 4 }, () => handleGameEvents(db, bodies, [Date.now()], Date.now())),
    );
    expect((await mail(bob)).letters).toHaveLength(1);
  });
});

describe("mentions in the clan's discussion", () => {
  async function clan() {
    const chief = await player();
    const clanId = await createClan(chief, "open");
    const member = await player();
    expect((await send(member, "POST", `/clans/${clanId}/join`)).status).toBe(200);
    events.sent.length = 0;
    return { chief, member, clanId };
  }

  /** Lifts the pace of one message every few seconds, for the next one. */
  async function nextMessage(who: Player) {
    await db
      .update(schema.clanMembers)
      .set({ lastMessageAt: null })
      .where(eq(schema.clanMembers.userId, who.userId));
  }

  it("highlights the members named and writes to each of them", async () => {
    const { chief, member, clanId } = await clan();
    const body = `Salut @${member.pseudo}, et @personne`;
    const posted = await send(chief, "POST", `/clans/${clanId}/messages`, { body });
    expect(posted.status).toBe(201);
    const message = clanMessageSchema.parse(await posted.json());
    const start = body.indexOf("@");
    expect(message).toMatchObject({
      mentions: [{ start, end: start + 1 + member.pseudo.length, me: false }],
    });
    expect(events.sent).toEqual([{ type: "clan_mentions", messageId: message.id }]);
    await consume(2);

    const list = clanMessagesResponseSchema.parse(
      await (await request(member, `/clans/${clanId}/messages`)).json(),
    );
    expect(list.messages[0]).toMatchObject({ id: message.id, mentions: [{ start, me: true }] });

    const letters = await mail(member);
    expect(letters.letters).toEqual([
      expect.objectContaining({
        kind: "clan_mention",
        clanId,
        excerpt: body,
        read: false,
        player: expect.objectContaining({ code: chief.code }),
      }),
    ]);
    expect((await mail(chief)).letters).toEqual([]);
  });

  it("writes nothing for oneself, to a player who blocked the author, or for a removed message", async () => {
    const { chief, member, clanId } = await clan();
    expect((await send(member, "PUT", `/me/blocks/${chief.code}`)).status).toBe(204);
    const blocked = await send(chief, "POST", `/clans/${clanId}/messages`, {
      body: `@${member.pseudo} tu m'entends ?`,
    });
    expect(blocked.status).toBe(201);
    await consume();
    expect((await mail(member)).letters).toEqual([]);

    await nextMessage(chief);
    const self = await send(chief, "POST", `/clans/${clanId}/messages`, {
      body: `Moi, @${chief.pseudo}`,
    });
    expect(clanMessageSchema.parse(await self.json())).toMatchObject({ mentions: [{ me: true }] });
    // Nobody else named: no event.
    expect(events.sent).toEqual([]);

    expect((await send(member, "DELETE", `/me/blocks/${chief.code}`)).status).toBe(204);
    await nextMessage(chief);
    const removed = clanMessageSchema.parse(
      await (
        await send(chief, "POST", `/clans/${clanId}/messages`, { body: `@${member.pseudo} oups` })
      ).json(),
    );
    expect((await send(chief, "DELETE", `/clans/${clanId}/messages/${removed.id}`)).status).toBe(
      204,
    );
    await consume();
    expect((await mail(member)).letters).toEqual([]);
  });

  it("keeps the letter of a message removed later, without its words", async () => {
    const { chief, member, clanId } = await clan();
    const message = clanMessageSchema.parse(
      await (
        await send(chief, "POST", `/clans/${clanId}/messages`, { body: `@${member.pseudo} hop` })
      ).json(),
    );
    await consume();
    expect((await send(chief, "DELETE", `/clans/${clanId}/messages/${message.id}`)).status).toBe(
      204,
    );
    expect((await mail(member)).letters).toEqual([
      expect.objectContaining({ kind: "clan_mention", excerpt: null }),
    ]);
  });

  it("offers the members whose pseudo starts with what follows the @", async () => {
    const chief = await player([], `Chef ${crypto.randomUUID().slice(0, 6)}`);
    const clanId = await createClan(chief, "open");
    const member = await player([], `Bérénice ${crypto.randomUUID().slice(0, 6)}`);
    expect((await send(member, "POST", `/clans/${clanId}/join`)).status).toBe(200);

    const found = clanMembersResponseSchema.parse(
      await (await request(chief, `/clans/${clanId}/members?q=bere`)).json(),
    );
    expect(found).toEqual({
      members: [
        expect.objectContaining({ player: expect.objectContaining({ code: member.code }) }),
      ],
      nextCursor: null,
    });
    const none = clanMembersResponseSchema.parse(
      await (await request(chief, `/clans/${clanId}/members?q=zzz`)).json(),
    );
    expect(none.members).toEqual([]);
  });
});

describe("requests to enter a clan", () => {
  it("tells the chief and the deputies, once per request", async () => {
    const chief = await player();
    const clanId = await createClan(chief, "request");
    const asking = await player();
    events.sent.length = 0;
    const joined = await send(asking, "POST", `/clans/${clanId}/join`);
    expect(clanJoinResultSchema.parse(await joined.json()).outcome).toBe("requested");
    expect(events.sent).toEqual([{ type: "clan_request", clanId, userId: asking.userId }]);
    await consume(2);

    expect((await mail(chief)).letters).toEqual([
      expect.objectContaining({
        kind: "clan_request",
        clanId,
        player: expect.objectContaining({ code: asking.code }),
      }),
    ]);
    expect((await mail(asking)).letters).toEqual([]);
  });
});

describe("reading the mail", () => {
  it("marks letters read up to one, twice without harm, and pages back", async () => {
    const me = await player();
    const other = await player();
    const now = new Date();
    const rows = await db
      .insert(mailLetters)
      .values(
        Array.from({ length: 32 }, (_, i) => ({
          userId: me.userId,
          kind: "clan_request" as const,
          payload: { clanId: crypto.randomUUID(), playerId: other.userId },
          dedupeKey: `test:${i}`,
          createdAt: now,
        })),
      )
      .returning({ id: mailLetters.id });
    const ids = rows.map((row) => row.id);
    const middle = ids[15] ?? 0;

    const first = await mail(me);
    expect(first).toMatchObject({ unread: 32, hasMore: true });
    expect(first.letters).toHaveLength(30);
    const next = await mail(me, `?before=${first.letters.at(-1)?.id}`);
    expect(next.letters.map((letter) => letter.id)).toEqual([ids[1], ids[0]]);

    for (let i = 0; i < 2; i++) {
      const read = await send(me, "POST", "/me/mail/read", { upTo: middle });
      expect(markMailReadResponseSchema.parse(await read.json())).toEqual({ unread: 16 });
    }
    expect((await send(me, "POST", "/me/mail/read", { upTo: 0 })).status).toBe(400);
    // Another player's letters stay as they are.
    expect((await mail(other)).unread).toBe(0);
  });

  it("names the owned word most overdue", async () => {
    const me = await player([
      { cardId: COMMON_1, quantity: 1 },
      { cardId: COMMON_2, quantity: 1 },
    ]);
    const fsrs = {
      stability: 1,
      difficulty: 5,
      scheduledDays: 1,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      state: 2,
    };
    await db.insert(userMastery).values([
      { userId: me.userId, cardId: COMMON_1, due: new Date(Date.now() - DAY), ...fsrs },
      { userId: me.userId, cardId: COMMON_2, due: new Date(Date.now() + DAY), ...fsrs },
      // Reviewed, then traded away: not the player's to lose.
      { userId: me.userId, cardId: "test-a-common-3", due: new Date(Date.now() - DAY), ...fsrs },
    ]);
    expect((await mail(me)).slipping).toEqual({ cardId: COMMON_1, others: 0 });
  });

  it("erases letters after 90 days", async () => {
    const me = await player();
    await db.insert(mailLetters).values({
      userId: me.userId,
      kind: "clan_request",
      payload: { clanId: crypto.randomUUID(), playerId: me.userId },
      dedupeKey: "test:old",
      createdAt: new Date(Date.now() - MAIL_RETENTION_MS - DAY),
    });
    expect(await purgeMail(db, Date.now())).toBeGreaterThanOrEqual(1);
    expect((await mail(me)).letters).toEqual([]);
  });
});

describe("excerpt", () => {
  it("cuts a long message at a word", () => {
    const long = `${"mot ".repeat(40)}fin`;
    const cut = excerpt(long);
    expect(cut.length).toBeLessThanOrEqual(121);
    expect(cut.endsWith("mot…")).toBe(true);
    expect(excerpt("court\net net")).toBe("court et net");
  });
});
