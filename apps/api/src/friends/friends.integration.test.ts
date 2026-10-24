import {
  ACCOUNT_ERROR_CODES,
  authErrorResponseSchema,
  claimReferralResponseSchema,
  feedResponseSchema,
  friendCardsResponseSchema,
  friendsResponseSchema,
  mailResponseSchema,
  podiumResponseSchema,
  publicProfileSchema,
  REFERRER_HEADER,
  referrerResponseSchema,
  sendFriendRequestResponseSchema,
} from "@leximon/contract";
import { pseudoKey, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { handleGameEvents } from "../clans/events";
import { recordingQueue, TEST_ORIGIN, testEnv } from "../test-env";
import {
  anyMailDomain,
  applySetCookies,
  createOutbox,
  type Guest,
  requestCode,
  seedTestCatalog,
  setOwnedCards,
  signInAsMember,
} from "../test-support";

const url = testDatabaseUrl();
const events = recordingQueue<unknown>();
const env: Env = { ...testEnv(url), GAME_EVENTS: events as Queue };
const closedEnv: Env = { ...env, BETA_INVITES: "required" };
const outbox = createOutbox();
const app = createApp({ emailSender: outbox.emailSender, mailDomain: anyMailDomain });
const { db, close } = createDb(url, { maxConnections: 8 });
const DAY = 86_400_000;

const { friendRequests, friendships, players, referrals, userPreferences } = schema;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

interface Player extends Guest {
  readonly code: string;
  readonly pseudo: string;
}

function headers(who: Guest | null, extra: Record<string, string> = {}) {
  return {
    origin: TEST_ORIGIN,
    "content-type": "application/json",
    ...(who === null ? {} : { cookie: who.cookie }),
    ...extra,
  };
}

function request(who: Guest | null, method: string, path: string, body?: unknown, onEnv = env) {
  return app.request(
    path,
    {
      method,
      headers: headers(who),
      body: body === undefined ? null : JSON.stringify(body),
    },
    onEnv,
  );
}

function guestSignIn(extra: Record<string, string> = {}, onEnv: Env = env) {
  return app.request(
    "/api/auth/sign-in/anonymous",
    { method: "POST", headers: headers(null, extra), body: "{}" },
    onEnv,
  );
}

async function guestFrom(response: Response): Promise<Guest> {
  expect(response.status).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  return { cookie: applySetCookies("", response), userId: body.user.id };
}

/** A member with a pseudo, at a level. */
async function player(level = 1): Promise<Player> {
  const member = await signInAsMember(app, env, db);
  expect((await request(member, "GET", "/me/profile")).status).toBe(200);
  const pseudo = `Ami ${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await db
    .update(players)
    .set({ pseudo, pseudoKey: pseudoKey(pseudo), pseudoChangedAt: new Date("2026-01-01") })
    .where(eq(players.userId, member.userId))
    .returning({ code: players.code });
  if (row === undefined) throw new Error("No player row");
  await setLevel(member.userId, level);
  return { ...member, code: row.code, pseudo };
}

async function setLevel(userId: string, level: number) {
  await db
    .insert(schema.userProgress)
    .values({ userId, xp: xpToReach(level) })
    .onConflictDoUpdate({ target: schema.userProgress.userId, set: { xp: xpToReach(level) } });
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

async function friendsOf(who: Player) {
  const response = await request(who, "GET", "/me/friends");
  expect(response.status).toBe(200);
  return friendsResponseSchema.parse(await response.json());
}

async function ask(from: Player, to: Player) {
  return request(from, "POST", "/me/friend-requests", { pseudo: to.pseudo });
}

async function befriend(a: Player, b: Player) {
  expect((await ask(a, b)).status).toBe(200);
  expect((await request(b, "POST", `/me/friend-requests/${a.code}/accept`)).status).toBe(200);
}

/** Runs the queue's consumer on what the routes sent so far. */
async function drainEvents() {
  const bodies = events.sent.splice(0);
  await handleGameEvents(
    db,
    bodies,
    bodies.map(() => Date.now()),
    Date.now(),
  );
}

async function mailOf(who: Guest) {
  const response = await request(who, "GET", "/me/mail");
  expect(response.status).toBe(200);
  return mailResponseSchema.parse(await response.json());
}

describe("friend requests", () => {
  it("asks by pseudo, accepts, and both players see each other", async () => {
    const lucie = await player();
    const marc = await player();
    const sent = await ask(lucie, marc);
    expect(sent.status).toBe(200);
    expect(sendFriendRequestResponseSchema.parse(await sent.json()).outcome).toBe("sent");

    expect((await friendsOf(marc)).incoming.map((r) => r.player.code)).toEqual([lucie.code]);
    expect((await friendsOf(lucie)).outgoing.map((r) => r.player.code)).toEqual([marc.code]);
    await drainEvents();
    const letter = (await mailOf(marc)).letters[0];
    expect(letter).toMatchObject({ kind: "friend_request", pending: true });

    expect((await request(marc, "POST", `/me/friend-requests/${lucie.code}/accept`)).status).toBe(
      200,
    );
    expect((await friendsOf(lucie)).friends.map((f) => f.player.code)).toEqual([marc.code]);
    expect((await friendsOf(marc)).friends.map((f) => f.player.code)).toEqual([lucie.code]);
    expect((await friendsOf(marc)).incoming).toEqual([]);
    await drainEvents();
    expect((await mailOf(lucie)).letters[0]).toMatchObject({ kind: "friend_accepted" });
    expect((await mailOf(marc)).letters[0]).toMatchObject({
      kind: "friend_request",
      pending: false,
    });
  });

  it("accepts at once when the other player had asked too, even when both ask together", async () => {
    const a = await player();
    const b = await player();
    const [one, two] = await Promise.all([ask(a, b), ask(b, a)]);
    const outcomes = [one, two].map((response) => response.status);
    expect(outcomes).toEqual([200, 200]);
    const rows = await db
      .select()
      .from(friendships)
      .where(sql`${friendships.userId} in (${a.userId}, ${b.userId})`);
    expect(rows).toHaveLength(2);
    expect(
      await db.select().from(friendRequests).where(eq(friendRequests.senderId, a.userId)),
    ).toEqual([]);
  });

  it("refuses a guest, a member without a pseudo, oneself, and twice the same request", async () => {
    const guest = await guestFrom(await guestSignIn());
    const target = await player();
    const fromGuest = await request(guest, "POST", "/me/friend-requests", {
      pseudo: target.pseudo,
    });
    expect(fromGuest.status).toBe(403);
    expect(await errorOf(fromGuest)).toBe("account_required");

    const me = await player();
    expect(await errorOf(await ask(me, me))).toBe("self");
    expect((await ask(me, target)).status).toBe(200);
    expect(await errorOf(await ask(me, target))).toBe("already_requested");

    await db
      .update(players)
      .set({ pseudo: null, pseudoKey: null, pseudoChangedAt: null })
      .where(eq(players.userId, me.userId));
    const noPseudo = await ask(me, await player());
    expect(noPseudo.status).toBe(403);
    expect(await errorOf(noPseudo)).toBe("pseudo_required");
  });

  it("finds nobody behind an unknown pseudo, a guest's code or a blocked player", async () => {
    const me = await player();
    expect(
      await errorOf(await request(me, "POST", "/me/friend-requests", { pseudo: "Personne ici" })),
    ).toBe("player_not_found");
    const blocker = await player();
    expect((await request(blocker, "PUT", `/me/blocks/${me.code}`)).status).toBe(204);
    expect(await errorOf(await ask(me, blocker))).toBe("player_not_found");
  });

  it("keeps a refusal quiet and waits a week before asking again", async () => {
    const a = await player();
    const b = await player();
    expect((await ask(a, b)).status).toBe(200);
    expect((await request(b, "POST", `/me/friend-requests/${a.code}/decline`)).status).toBe(204);

    expect((await friendsOf(a)).outgoing.map((r) => r.player.code)).toEqual([b.code]);
    expect((await friendsOf(b)).incoming).toEqual([]);
    // The request is no longer pending, but the refusal is never told.
    expect(await errorOf(await ask(a, b))).toBe("recently_declined");

    await db
      .update(friendRequests)
      .set({
        declinedAt: new Date(Date.now() - 8 * DAY),
        createdAt: new Date(Date.now() - 8 * DAY),
      })
      .where(eq(friendRequests.senderId, a.userId));
    expect((await ask(a, b)).status).toBe(200);
  });

  it("respects a player who takes no request", async () => {
    const a = await player();
    const b = await player();
    expect(
      (await request(b, "PATCH", "/me/preferences", { friendRequestsOpen: false })).status,
    ).toBe(200);
    expect(await errorOf(await ask(a, b))).toBe("requests_closed");
  });

  it("removes a friend on both sides, and a block undoes the friendship", async () => {
    const a = await player();
    const b = await player();
    const c = await player();
    await befriend(a, b);
    await befriend(a, c);
    expect((await request(b, "DELETE", `/me/friends/${a.code}`)).status).toBe(204);
    expect((await friendsOf(a)).friends.map((f) => f.player.code)).toEqual([c.code]);
    expect((await request(c, "PUT", `/me/blocks/${a.code}`)).status).toBe(204);
    expect((await friendsOf(a)).friends).toEqual([]);
    expect((await friendsOf(c)).friends).toEqual([]);
  });

  it("accepts twice at once without a second friendship", async () => {
    const a = await player();
    const b = await player();
    expect((await ask(a, b)).status).toBe(200);
    const responses = await Promise.all([
      request(b, "POST", `/me/friend-requests/${a.code}/accept`),
      request(b, "POST", `/me/friend-requests/${a.code}/accept`),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const rows = await db.select().from(friendships).where(eq(friendships.userId, a.userId));
    expect(rows).toHaveLength(1);
  });
});

describe("between friends", () => {
  it("shows the whole profile to a friend, below the public level and when private", async () => {
    const shy = await player(2);
    const friend = await player(2);
    const stranger = await player(2);
    await db.update(players).set({ profilePublic: false }).where(eq(players.userId, shy.userId));
    await befriend(shy, friend);

    const seen = await request(friend, "GET", `/players/${encodeURIComponent(shy.pseudo)}`);
    expect(seen.status).toBe(200);
    expect(publicProfileSchema.parse(await seen.json())).toMatchObject({
      visibility: "public",
      friendship: "friends",
    });
    expect(
      (await request(stranger, "GET", `/players/${encodeURIComponent(shy.pseudo)}`)).status,
    ).toBe(404);
  });

  it("lets only friends see a collection, and counts the trades possible", async () => {
    const a = await player(5);
    const b = await player(5);
    const stranger = await player(5);
    await setOwnedCards(db, a.userId, [
      { cardId: "test-a-common-1", quantity: 3 },
      { cardId: "test-a-common-2", quantity: 2 },
      { cardId: "test-a-rare-1", quantity: 1 },
    ]);
    await setOwnedCards(db, b.userId, [
      { cardId: "test-a-rare-1", quantity: 2 },
      { cardId: "test-a-uncommon-1", quantity: 4 },
      // A rare duplicate obtained just now is held back.
      { cardId: "test-a-legendary-1", quantity: 2, lastObtainedAt: new Date() },
    ]);
    await befriend(a, b);

    const [friend] = (await friendsOf(a)).friends;
    // a gives 2 cards b lacks; b has 1 tradeable card a lacks (the rare a owns, the legendary waits).
    expect(friend?.trades).toBe(1);

    const cards = await request(a, "GET", `/me/friends/${b.code}/cards`);
    expect(cards.status).toBe(200);
    expect(friendCardsResponseSchema.parse(await cards.json()).cardIds).toEqual([
      "test-a-legendary-1",
      "test-a-rare-1",
      "test-a-uncommon-1",
    ]);
    expect((await request(stranger, "GET", `/me/friends/${b.code}/cards`)).status).toBe(404);
  });

  it("ranks friends on this week's correct answers and crowns last week's first", async () => {
    const a = await player();
    const b = await player();
    await befriend(a, b);
    const now = Date.now();
    const answer = (userId: string, reviewedAt: number) => ({
      id: crypto.randomUUID(),
      userId,
      cardId: "test-a-common-1",
      challengeId: crypto.randomUUID(),
      format: "word" as const,
      correct: true,
      rating: 3,
      levelAfter: "sketch" as const,
      reviewedAt: new Date(reviewedAt),
    });
    await db
      .insert(schema.reviewLogs)
      .values([
        answer(b.userId, now - 1000),
        answer(b.userId, now - 2000),
        answer(a.userId, now - 3000),
        answer(a.userId, now - 8 * DAY),
      ]);
    const response = await request(a, "GET", "/me/friends/podium");
    const podium = podiumResponseSchema.parse(await response.json());
    expect(
      podium.entries.map((entry) => [entry.player.code, entry.answers, entry.rank, entry.self]),
    ).toEqual([
      [b.code, 2, 1, false],
      [a.code, 1, 2, true],
    ]);
  });
});

describe("the friends' feed", () => {
  it("shows a friend's Legendary, takes one reaction each, and writes to its author once", async () => {
    const finder = await player();
    const fan = await player();
    const other = await player();
    await befriend(finder, fan);
    await befriend(finder, other);
    await db.insert(schema.userCards).values({
      userId: finder.userId,
      cardId: "test-b-legendary-1",
      quantity: 1,
      firstObtainedAt: new Date(),
      lastObtainedAt: new Date(),
    });
    events.sent.splice(0);
    await handleGameEvents(
      db,
      [{ type: "cards_obtained", userId: finder.userId }],
      [Date.now()],
      Date.now(),
    );

    const feed = feedResponseSchema.parse(
      await (await request(fan, "GET", "/me/friends/feed")).json(),
    );
    const event = feed.events.find((e) => e.player.code === finder.code);
    expect(event).toMatchObject({ kind: "rare_find", cardId: "test-b-legendary-1" });
    if (event === undefined) throw new Error("No event");

    expect(
      (await request(finder, "PUT", `/me/friend-reactions/${event.id}`, { reaction: "jealous" }))
        .status,
    ).toBe(404);
    const [first, again] = await Promise.all([
      request(fan, "PUT", `/me/friend-reactions/${event.id}`, { reaction: "jealous" }),
      request(fan, "PUT", `/me/friend-reactions/${event.id}`, { reaction: "hats_off" }),
    ]);
    expect([first.status, again.status]).toEqual([204, 204]);
    expect(
      (await request(other, "PUT", `/me/friend-reactions/${event.id}`, { reaction: "lucky" }))
        .status,
    ).toBe(204);
    await drainEvents();
    const letters = (await mailOf(finder)).letters.filter((l) => l.kind === "friend_reaction");
    expect(letters).toHaveLength(1);
    expect(letters[0]).toMatchObject({ eventId: event.id, reactions: 2 });

    // A player who shares nothing disappears from the feed.
    await db
      .insert(userPreferences)
      .values({ userId: finder.userId, shareFinds: false })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { shareFinds: false } });
    const hidden = feedResponseSchema.parse(
      await (await request(fan, "GET", "/me/friends/feed")).json(),
    );
    expect(hidden.events.some((e) => e.player.code === finder.code)).toBe(false);
  });
});

describe("friend links", () => {
  function newEmail() {
    return `filleul-${crypto.randomUUID().slice(0, 8)}@example.com`;
  }

  async function errorCode(response: Response): Promise<string | null> {
    const body = authErrorResponseSchema.safeParse(await response.json().catch(() => null));
    return body.success ? body.data.code : null;
  }

  it("shows who invites, and lets 3 players into the closed beta, even all at once", async () => {
    const host = await player();
    const page = await request(null, "GET", `/referrers/${host.code}`, undefined, closedEnv);
    expect(referrerResponseSchema.parse(await page.json())).toMatchObject({
      player: { pseudo: host.pseudo },
      status: "open",
    });

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => guestSignIn({ [REFERRER_HEADER]: host.code }, closedEnv)),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 200, 200, 403, 403, 403,
    ]);
    const refused = responses.find((response) => response.status === 403);
    if (refused === undefined) throw new Error("No refusal");
    expect(await errorCode(refused)).toBe(ACCOUNT_ERROR_CODES.inviteClosed);
    const [row] = await db.select().from(players).where(eq(players.userId, host.userId));
    expect(row?.friendPlacesUsed).toBe(3);
    const full = await request(null, "GET", `/referrers/${host.code}`, undefined, closedEnv);
    expect(referrerResponseSchema.parse(await full.json()).status).toBe("full");
  });

  it("makes friends when the invited guest creates its account, and rewards both at level 5", async () => {
    const host = await player();
    const guest = await guestFrom(await guestSignIn({ [REFERRER_HEADER]: host.code }, closedEnv));
    const email = newEmail();
    await requestCode(app, closedEnv, email, guest.cookie);
    const linked = await app.request(
      "/api/auth/sign-in/email-otp",
      {
        method: "POST",
        headers: headers(guest),
        body: JSON.stringify({ email, otp: outbox.codeFor(email), ageConfirmed: true }),
      },
      closedEnv,
    );
    expect(linked.status).toBe(200);
    const account: Guest = {
      userId: ((await linked.json()) as { user: { id: string } }).user.id,
      cookie: applySetCookies(guest.cookie, linked),
    };

    const [friendship] = await db
      .select()
      .from(friendships)
      .where(and(eq(friendships.userId, host.userId), eq(friendships.friendId, account.userId)));
    expect(friendship).toBeDefined();
    expect((await mailOf(host)).letters[0]).toMatchObject({ kind: "referral_arrived" });

    await setLevel(account.userId, 5);
    await handleGameEvents(
      db,
      [{ type: "level_up", userId: account.userId }],
      [Date.now()],
      Date.now(),
    );
    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.refereeId, account.userId));
    expect(referral).toMatchObject({ referrerId: host.userId, rewarded: true });

    const rewards = (await mailOf(host)).referralRewards;
    expect(rewards).toHaveLength(1);
    const refereeCode = rewards[0]?.refereeCode;
    const claims = await Promise.all([
      request(host, "POST", `/me/referrals/${refereeCode}/claim`),
      request(host, "POST", `/me/referrals/${refereeCode}/claim`),
    ]);
    expect(claims.map((response) => response.status)).toEqual([200, 200]);
    const wallets = await Promise.all(
      claims.map(
        async (response) => claimReferralResponseSchema.parse(await response.json()).wallet.bonus,
      ),
    );
    expect(wallets.sort()).toEqual([1, 1]);
    expect((await mailOf(host)).referralRewards).toEqual([]);
    expect((await mailOf(account)).referralRewards).toHaveLength(1);
  });

  it("rewards at most 5 invited players a month for one inviter", async () => {
    const host = await player();
    const invited = await Promise.all(Array.from({ length: 6 }, () => player(5)));
    await db.insert(referrals).values(
      invited.map((who) => ({
        refereeId: who.userId,
        referrerId: host.userId,
        createdAt: new Date(),
      })),
    );
    await Promise.all(
      invited.map((who) =>
        handleGameEvents(db, [{ type: "level_up", userId: who.userId }], [Date.now()], Date.now()),
      ),
    );
    const rows = await db.select().from(referrals).where(eq(referrals.referrerId, host.userId));
    expect(rows.filter((row) => row.rewarded)).toHaveLength(5);
    expect(rows.filter((row) => row.qualifiedAt !== null)).toHaveLength(6);
  });
});
