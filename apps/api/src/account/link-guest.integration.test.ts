import {
  ACCOUNT_ERROR_CODES,
  accountResponseSchema,
  authErrorResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  linkPreviewResponseSchema,
  openBoosterResponseSchema,
  profileResponseSchema,
} from "@leximon/contract";
import type { MasteryLevel } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  ageAccount,
  applySetCookies,
  createOutbox,
  previewLink,
  requestCode,
  seedTestCatalog,
  setOwnedCards,
  signInAsGuest,
  signInWithCode,
} from "../test-support";
import { linkGuest, USER_REFERENCES } from "./link-guest";

const url = testDatabaseUrl();
const env = testEnv(url);
const outbox = createOutbox();
const app = createApp({ emailSender: outbox.emailSender });
const { db, close } = createDb(url, { maxConnections: 4 });
const DAY = 86_400_000;

const {
  boosterBonusAwards,
  boosterOpens,
  boosterWallets,
  guestLinks,
  sessions,
  tradeItems,
  trades,
  userCards,
  userMastery,
  users,
} = schema;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

let emails = 0;
/** A fresh address for each scenario: accounts are never deleted between tests. */
function newEmail(): string {
  emails += 1;
  return `joueur-${emails}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

function get(cookie: string, path: string) {
  return app.request(path, { headers: { origin: TEST_ORIGIN, cookie } }, env);
}

function openBooster(cookie: string) {
  return app.request(
    "/boosters/open",
    {
      method: "POST",
      headers: {
        origin: TEST_ORIGIN,
        cookie,
        "content-type": "application/json",
        [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
      },
      body: JSON.stringify({ kind: "discovery" }),
    },
    env,
  );
}

async function whoIs(cookie: string) {
  const response = await get(cookie, "/me/account");
  expect(response.status).toBe(200);
  return accountResponseSchema.parse(await response.json());
}

/** Sends a code to `email` and signs in with it, from the given session. */
async function signIn(
  email: string,
  cookie: string | null,
  flags: { ageConfirmed?: boolean; acceptGuestLoss?: boolean } = {},
) {
  expect((await requestCode(app, env, email, cookie)).status).toBe(200);
  const response = await signInWithCode(app, env, {
    email,
    code: outbox.codeFor(email),
    cookie,
    ...flags,
  });
  return { response, cookie: applySetCookies(cookie ?? "", response) };
}

/** A member with a game: signed up from a guest who owned these cards. */
async function member(owned: Parameters<typeof setOwnedCards>[2]) {
  const guest = await signInAsGuest(app, env);
  await setOwnedCards(db, guest.userId, owned);
  const email = newEmail();
  const { response, cookie } = await signIn(email, guest.cookie, { ageConfirmed: true });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  return { email, cookie, userId: body.user.id };
}

async function setMastery(
  userId: string,
  cardId: string,
  level: MasteryLevel,
  stability: number,
  marker: number,
) {
  // `difficulty` and `reps` carry a marker telling rows apart.
  await db.insert(userMastery).values({
    userId,
    cardId,
    level,
    due: new Date("2026-01-01T00:00:00Z"),
    stability,
    difficulty: marker,
    scheduledDays: 1,
    learningSteps: 0,
    reps: marker,
    lapses: 0,
    state: 2,
    lastReviewedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

async function pendingTrade(proposerId: string, recipientId: string) {
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

async function cardsOf(userId: string) {
  const rows = await db
    .select({ cardId: userCards.cardId, quantity: userCards.quantity })
    .from(userCards)
    .where(eq(userCards.userId, userId));
  return Object.fromEntries(rows.map((row) => [row.cardId, row.quantity]));
}

async function linkOf(guestId: string) {
  const [row] = await db.select().from(guestLinks).where(eq(guestLinks.guestId, guestId));
  return row ?? null;
}

async function errorCode(response: Response): Promise<string> {
  return authErrorResponseSchema.parse(await response.json()).code;
}

describe("foreign keys to users.id", () => {
  it("are all handled by the guest link", async () => {
    const result = await db.execute<{ reference: string }>(sql`
      select distinct cls.relname || '.' || att.attname as reference
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
      where con.contype = 'f'
        and con.confrelid = 'users'::regclass
        and not cls.relispartition
      order by 1
    `);
    const inDatabase = result.rows.map((row) => row.reference);
    // A new table referencing users.id fails here until `USER_REFERENCES` says what a sign-in
    // does with it; a stale entry fails too.
    expect(inDatabase).toEqual(Object.keys(USER_REFERENCES).sort());
  });
});

describe("signing up from a guest (P37)", () => {
  it("moves everything the guest owns, age included, and archives the guest", async () => {
    const guest = await signInAsGuest(app, env);
    const opened = openBoosterResponseSchema.parse(await (await openBooster(guest.cookie)).json());
    await setMastery(guest.userId, opened.cards[0]?.cardId ?? "", "ink", 9, 1);
    await db.insert(boosterBonusAwards).values({
      userId: guest.userId,
      kind: "daily",
      awardKey: "2026-10-20",
      amount: 1,
      credited: 1,
      challengeId: crypto.randomUUID(),
      awardedAt: new Date(),
    });
    await db
      .update(boosterWallets)
      .set({ bonusBoosters: 1, pityCounters: { epic: 7, legendary: 12 } })
      .where(eq(boosterWallets.userId, guest.userId));
    const profile = profileResponseSchema.parse(
      await (await get(guest.cookie, "/me/profile")).json(),
    );
    const partner = await signInAsGuest(app, env);
    const tradeId = await pendingTrade(guest.userId, partner.userId);
    await ageAccount(db, guest.userId, 5 * DAY);
    const [guestRow] = await db.select().from(users).where(eq(users.id, guest.userId));
    const cardsBefore = await cardsOf(guest.userId);

    const email = newEmail();
    expect((await requestCode(app, env, email, guest.cookie)).status).toBe(200);
    const preview = await previewLink(app, env, {
      email,
      code: outbox.codeFor(email),
      cookie: guest.cookie,
    });
    expect(linkPreviewResponseSchema.parse(await preview.json())).toEqual({
      accountExists: false,
      outcome: "transfer",
      guestCards: 5,
    });
    const response = await signInWithCode(app, env, {
      email,
      code: outbox.codeFor(email),
      cookie: guest.cookie,
      ageConfirmed: true,
    });
    expect(response.status).toBe(200);
    const cookie = applySetCookies(guest.cookie, response);
    const { user } = (await response.json()) as { user: { id: string; name: string } };
    expect(user.name).toBe("");

    expect(await whoIs(cookie)).toEqual({ kind: "member", email });
    expect(await cardsOf(user.id)).toEqual(cardsBefore);
    const [wallet] = await db
      .select()
      .from(boosterWallets)
      .where(eq(boosterWallets.userId, user.id));
    expect(wallet?.bonusBoosters).toBe(1);
    expect(wallet?.pityCounters).toEqual({ epic: 7, legendary: 12 });
    const [progress] = await db
      .select({ xp: schema.userProgress.xp })
      .from(schema.userProgress)
      .where(eq(schema.userProgress.userId, user.id));
    expect(progress?.xp).toBe(opened.progress.xp);
    const after = profileResponseSchema.parse(await (await get(cookie, "/me/profile")).json());
    expect(after.playerCode).toBe(profile.playerCode);
    // Old enough to trade: the 5 days of the guest count (P36).
    expect(Date.parse(after.canTradeFrom)).toBeLessThan(Date.now());
    const [account] = await db.select().from(users).where(eq(users.id, user.id));
    expect(account?.createdAt).toEqual(guestRow?.createdAt);
    const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId));
    expect(trade).toMatchObject({ proposerId: user.id, status: "pending" });

    // Nothing of the game is left on the guest, which is archived rather than deleted.
    for (const [reference, handling] of Object.entries(USER_REFERENCES)) {
      if (handling.transfer !== "moved" && handling.transfer !== "revoked") continue;
      const [table, column] = reference.split(".");
      const left = await db.execute<{ n: number }>(
        sql`select count(*)::int as n from ${sql.identifier(table ?? "")} where ${sql.identifier(column ?? "")} = ${guest.userId}`,
      );
      expect(left.rows[0]?.n, reference).toBe(0);
    }
    expect(await db.select().from(users).where(eq(users.id, guest.userId))).toHaveLength(1);
    expect(await linkOf(guest.userId)).toMatchObject({
      accountId: user.id,
      outcome: "transfer",
      cards: 5,
      words: 1,
    });
  });

  it("refuses to create an account without the age declaration", async () => {
    const guest = await signInAsGuest(app, env);
    await setOwnedCards(db, guest.userId, [{ cardId: "test-a-common-1", quantity: 2 }]);
    const email = newEmail();

    const { response, cookie } = await signIn(email, guest.cookie);

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe(ACCOUNT_ERROR_CODES.ageConfirmationRequired);
    expect(await db.select().from(users).where(eq(users.email, email))).toHaveLength(0);
    expect(await linkOf(guest.userId)).toBeNull();
    expect(cookie).toBe(guest.cookie);
  });

  it("refuses an open from the guest's old session once archived", async () => {
    const guest = await signInAsGuest(app, env);
    expect((await openBooster(guest.cookie)).status).toBe(200);
    const { response, cookie } = await signIn(newEmail(), guest.cookie, { ageConfirmed: true });
    expect(response.status).toBe(200);

    // The signed session cache keeps the old cookie usable for a few minutes, but not to play.
    const stale = await openBooster(guest.cookie);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: "guest_archived" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, guest.userId))).toEqual([]);
    expect((await openBooster(cookie)).status).toBe(200);
  });
});

describe("signing in to an account that plays (P54)", () => {
  it("abandons the guest after a warning, and adds nothing to the account", async () => {
    const account = await member([
      { cardId: "test-a-common-1", quantity: 2 },
      { cardId: "test-a-common-2", quantity: 1 },
    ]);
    await db
      .update(boosterWallets)
      .set({ bonusBoosters: 2, pityCounters: { epic: 3, legendary: 30 } })
      .where(eq(boosterWallets.userId, account.userId));
    await setMastery(account.userId, "test-a-common-1", "ink", 10, 101);
    const code = profileResponseSchema.parse(
      await (await get(account.cookie, "/me/profile")).json(),
    ).playerCode;
    const [walletBefore] = await db
      .select()
      .from(boosterWallets)
      .where(eq(boosterWallets.userId, account.userId));
    const [accountBefore] = await db.select().from(users).where(eq(users.id, account.userId));
    const masteryBefore = await db
      .select()
      .from(userMastery)
      .where(eq(userMastery.userId, account.userId));

    const guest = await signInAsGuest(app, env);
    await ageAccount(db, guest.userId, 30 * DAY);
    await setOwnedCards(db, guest.userId, [
      { cardId: "test-a-common-1", quantity: 3 },
      { cardId: "test-a-epic-1", quantity: 1 },
    ]);
    await setMastery(guest.userId, "test-a-common-1", "gilded", 50, 201);
    await setMastery(guest.userId, "test-a-rare-1", "sketch", 1, 203);
    await db.insert(boosterOpens).values({
      id: crypto.randomUUID(),
      userId: guest.userId,
      seed: "00",
      poolFingerprint: "test",
      cards: [],
      openedAt: new Date(),
    });
    const partner = await signInAsGuest(app, env);
    const sent = await pendingTrade(guest.userId, partner.userId);
    const received = await pendingTrade(partner.userId, guest.userId);

    expect((await requestCode(app, env, account.email, guest.cookie)).status).toBe(200);
    const preview = await previewLink(app, env, {
      email: account.email,
      code: outbox.codeFor(account.email),
      cookie: guest.cookie,
    });
    expect(linkPreviewResponseSchema.parse(await preview.json())).toEqual({
      accountExists: true,
      outcome: "abandon",
      guestCards: 4,
    });

    // Not warned: the sign-in is refused and the player is still the guest, cards and all.
    const refused = await signInWithCode(app, env, {
      email: account.email,
      code: outbox.codeFor(account.email),
      cookie: guest.cookie,
    });
    expect(refused.status).toBe(409);
    expect(await errorCode(refused)).toBe(ACCOUNT_ERROR_CODES.guestLossNotAcknowledged);
    const stillGuest = applySetCookies(guest.cookie, refused);
    expect(await whoIs(stillGuest)).toEqual({ kind: "guest", boostersLeft: 1 });
    expect(await cardsOf(guest.userId)).toEqual({ "test-a-common-1": 3, "test-a-epic-1": 1 });
    expect(await linkOf(guest.userId)).toBeNull();

    // Warned: the guest is abandoned, its whole game stays behind on it.
    const accepted = await signIn(account.email, stillGuest, { acceptGuestLoss: true });
    expect(accepted.response.status).toBe(200);
    expect(await whoIs(accepted.cookie)).toEqual({ kind: "member", email: account.email });
    expect(await cardsOf(account.userId)).toEqual({ "test-a-common-1": 2, "test-a-common-2": 1 });
    expect(await cardsOf(guest.userId)).toEqual({ "test-a-common-1": 3, "test-a-epic-1": 1 });
    expect(
      await db.select().from(userMastery).where(eq(userMastery.userId, account.userId)),
    ).toEqual(masteryBefore);
    expect(
      await db.select().from(userMastery).where(eq(userMastery.userId, guest.userId)),
    ).toHaveLength(2);

    // The account keeps its own stock, reserve, guarantees, code and age.
    const [walletAfter] = await db
      .select()
      .from(boosterWallets)
      .where(eq(boosterWallets.userId, account.userId));
    expect(walletAfter).toEqual(walletBefore);
    const profile = profileResponseSchema.parse(
      await (await get(account.cookie, "/me/profile")).json(),
    );
    expect(profile.playerCode).toBe(code);
    const [accountAfter] = await db.select().from(users).where(eq(users.id, account.userId));
    expect(accountAfter?.createdAt).toEqual(accountBefore?.createdAt);

    // Offers cancelled, history left on the archived guest, which can no longer sign in.
    const offers = await db
      .select({ id: trades.id, status: trades.status })
      .from(trades)
      .where(sql`${trades.id} in (${sent}, ${received})`);
    expect(offers.map((offer) => offer.status)).toEqual(["cancelled", "cancelled"]);
    expect(
      await db.select().from(boosterOpens).where(eq(boosterOpens.userId, guest.userId)),
    ).toHaveLength(1);
    expect(await db.select().from(sessions).where(eq(sessions.userId, guest.userId))).toEqual([]);
    expect(await db.select().from(users).where(eq(users.id, guest.userId))).toHaveLength(1);
    expect(await linkOf(guest.userId)).toMatchObject({
      accountId: account.userId,
      outcome: "abandon",
      cards: 4,
      words: 2,
    });
  });

  it("signs an empty guest in without any warning, and still archives it", async () => {
    const account = await member([{ cardId: "test-b-common-1", quantity: 1 }]);
    const empty = await signInAsGuest(app, env);

    expect((await requestCode(app, env, account.email, empty.cookie)).status).toBe(200);
    const preview = await previewLink(app, env, {
      email: account.email,
      code: outbox.codeFor(account.email),
      cookie: empty.cookie,
    });
    expect(linkPreviewResponseSchema.parse(await preview.json())).toEqual({
      accountExists: true,
      outcome: "none",
      guestCards: 0,
    });
    const response = await signInWithCode(app, env, {
      email: account.email,
      code: outbox.codeFor(account.email),
      cookie: empty.cookie,
    });

    expect(response.status).toBe(200);
    expect(await whoIs(applySetCookies(empty.cookie, response))).toEqual({
      kind: "member",
      email: account.email,
    });
    expect(await cardsOf(account.userId)).toEqual({ "test-b-common-1": 1 });
    expect(await linkOf(empty.userId)).toMatchObject({
      accountId: account.userId,
      outcome: "abandon",
      cards: 0,
      words: 0,
    });
  });

  it("asks for the warning again when the guest got a card after the preview", async () => {
    const account = await member([{ cardId: "test-b-common-2", quantity: 1 }]);
    const guest = await signInAsGuest(app, env);
    expect((await requestCode(app, env, account.email, guest.cookie)).status).toBe(200);
    const preview = await previewLink(app, env, {
      email: account.email,
      code: outbox.codeFor(account.email),
      cookie: guest.cookie,
    });
    expect(linkPreviewResponseSchema.parse(await preview.json()).outcome).toBe("none");

    expect((await openBooster(guest.cookie)).status).toBe(200);
    const refused = await signInWithCode(app, env, {
      email: account.email,
      code: outbox.codeFor(account.email),
      cookie: guest.cookie,
    });

    expect(refused.status).toBe(409);
    expect(await errorCode(refused)).toBe(ACCOUNT_ERROR_CODES.guestLossNotAcknowledged);
    expect(await linkOf(guest.userId)).toBeNull();
  });
});

describe("retries and failures", () => {
  async function accountUser() {
    const id = crypto.randomUUID();
    await db.insert(users).values({ id, name: "", email: newEmail(), emailVerified: true });
    return id;
  }

  it("links a guest once, even when the link runs twice at the same time", async () => {
    const guest = await signInAsGuest(app, env);
    await setOwnedCards(db, guest.userId, [{ cardId: "test-a-common-3", quantity: 3 }]);
    const accountId = await accountUser();
    const input = { guestId: guest.userId, accountId, now: Date.now(), acceptGuestLoss: false };

    const results = await Promise.all([linkGuest(db, input), linkGuest(db, input)]);

    expect(results.map((result) => result.kind).sort()).toEqual(["already_linked", "linked"]);
    expect(await cardsOf(accountId)).toEqual({ "test-a-common-3": 3 });
    expect(await linkGuest(db, input)).toEqual({ kind: "already_linked" });
    expect(await cardsOf(accountId)).toEqual({ "test-a-common-3": 3 });
  });

  it("gives a new account the game of only one of two guests linking at the same time", async () => {
    const first = await signInAsGuest(app, env);
    const second = await signInAsGuest(app, env);
    await setOwnedCards(db, first.userId, [{ cardId: "test-a-common-1", quantity: 1 }]);
    await setOwnedCards(db, second.userId, [{ cardId: "test-a-common-2", quantity: 2 }]);
    const accountId = await accountUser();
    const link = (guestId: string) =>
      linkGuest(db, { guestId, accountId, now: Date.now(), acceptGuestLoss: false });

    const results = await Promise.all([link(first.userId), link(second.userId)]);

    // The first to lock the account receives its game; the other would be abandoned unwarned.
    expect(results.map((result) => result.kind).sort()).toEqual([
      "guest_loss_not_acknowledged",
      "linked",
    ]);
    const [winner, loser] = results[0]?.kind === "linked" ? [first, second] : [second, first];
    expect(await cardsOf(accountId)).toEqual(
      winner === first ? { "test-a-common-1": 1 } : { "test-a-common-2": 2 },
    );
    expect(await linkOf(winner.userId)).toMatchObject({ outcome: "transfer" });
    expect(await linkOf(loser.userId)).toBeNull();
  });

  it("keeps the player on the guest when the transfer fails after the session was created", async () => {
    const guest = await signInAsGuest(app, env);
    await setOwnedCards(db, guest.userId, [{ cardId: "test-b-rare-1", quantity: 2 }]);
    const email = newEmail();
    await db.execute(sql`
      create function test_fail_guest_link() returns trigger language plpgsql as $$
      begin raise exception 'simulated failure'; end; $$;
      create trigger test_fail_guest_link before insert on guest_links
        for each row execute function test_fail_guest_link();
    `);
    let failed: Awaited<ReturnType<typeof signIn>>;
    try {
      failed = await signIn(email, guest.cookie, { ageConfirmed: true });
    } finally {
      await db.execute(sql`
        drop trigger test_fail_guest_link on guest_links;
        drop function test_fail_guest_link();
      `);
    }

    expect(failed.response.status).toBe(500);
    expect(await errorCode(failed.response)).toBe(ACCOUNT_ERROR_CODES.accountLinkFailed);
    // The browser is back on the guest's session, and the guest's game is untouched.
    expect(await whoIs(failed.cookie)).toEqual({ kind: "guest", boostersLeft: 2 });
    expect(await cardsOf(guest.userId)).toEqual({ "test-b-rare-1": 2 });
    expect(await linkOf(guest.userId)).toBeNull();
    const [created] = await db.select().from(users).where(eq(users.email, email));
    expect(created).toBeDefined();
    expect(
      await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, created?.id ?? "")),
    ).toEqual([]);

    // Trying again with a new code works: the account exists but has no game yet.
    const retried = await signIn(email, failed.cookie, { ageConfirmed: true });
    expect(retried.response.status).toBe(200);
    expect(await cardsOf(created?.id ?? "")).toEqual({ "test-b-rare-1": 2 });
    expect(await linkOf(guest.userId)).toMatchObject({ outcome: "transfer" });
  });
});

describe("codes", () => {
  it("allows 3 wrong attempts per code, even when guesses race", async () => {
    const guest = await signInAsGuest(app, env);
    const email = newEmail();
    expect((await requestCode(app, env, email, guest.cookie)).status).toBe(200);
    const right = outbox.codeFor(email);
    const wrong = (offset: number) => String((Number(right) + offset) % 1_000_000).padStart(6, "0");

    const guesses = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((offset) =>
        previewLink(app, env, { email, code: wrong(offset), cookie: guest.cookie }),
      ),
    );
    expect(guesses.every((guess) => guess.status === 400 || guess.status === 403)).toBe(true);

    // The right code came too late: the attempts were used up.
    const late = await previewLink(app, env, { email, code: right, cookie: guest.cookie });
    expect(late.status).not.toBe(200);
    const signedIn = await signInWithCode(app, env, {
      email,
      code: right,
      cookie: guest.cookie,
      ageConfirmed: true,
    });
    expect(signedIn.status).toBe(400);
  });

  it("fails closed when no e-mail provider is configured", async () => {
    const response = await createApp().request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ email: newEmail(), type: "sign-in" }),
      },
      env,
    );
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe(ACCOUNT_ERROR_CODES.emailUnavailable);
  });
});

describe("a guest playing while its sign-in runs", () => {
  const locker = createDb(url, { maxConnections: 1 });
  afterAll(locker.close);

  /** Holds the guest's wallet lock until `release` is called, as a long booster open would. */
  async function holdWallet(userId: string) {
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let taken: () => void = () => {};
    const isTaken = new Promise<void>((resolve) => {
      taken = resolve;
    });
    const holding = locker.db.transaction(async (tx) => {
      await tx
        .select({ userId: boosterWallets.userId })
        .from(boosterWallets)
        .where(eq(boosterWallets.userId, userId))
        .for("update");
      taken();
      await released;
    });
    await isTaken;
    return { release, holding };
  }

  async function waitForLockWaiters(count: number) {
    for (let tries = 0; tries < 200; tries++) {
      const result = await db.execute<{ n: number }>(sql`
        select count(*)::int as n from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'
      `);
      if ((result.rows[0]?.n ?? 0) >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Fewer than ${count} requests waiting on a lock`);
  }

  it("refuses a booster opened just after the guest moved to a new account", async () => {
    const guest = await signInAsGuest(app, env);
    expect((await openBooster(guest.cookie)).status).toBe(200);
    const before = await cardsOf(guest.userId);
    const email = newEmail();
    expect((await requestCode(app, env, email, guest.cookie)).status).toBe(200);

    const { release, holding } = await holdWallet(guest.userId);
    const signingIn = signInWithCode(app, env, {
      email,
      code: outbox.codeFor(email),
      cookie: guest.cookie,
      ageConfirmed: true,
    });
    await waitForLockWaiters(1);
    const opening = openBooster(guest.cookie);
    await waitForLockWaiters(2);
    release();
    await holding;
    const [signedIn, opened] = await Promise.all([signingIn, opening]);

    expect(signedIn.status).toBe(200);
    expect(opened.status).toBe(409);
    const { user } = (await signedIn.json()) as { user: { id: string } };
    // Nothing drawn, nothing lost.
    expect(await cardsOf(user.id)).toEqual(before);
    expect(await cardsOf(guest.userId)).toEqual({});
  });

  it("leaves behind a booster opened just before the guest joined an account that plays", async () => {
    const account = await member([{ cardId: "test-a-uncommon-1", quantity: 1 }]);
    const guest = await signInAsGuest(app, env);
    expect((await openBooster(guest.cookie)).status).toBe(200);
    const guestBefore = await cardsOf(guest.userId);
    expect((await requestCode(app, env, account.email, guest.cookie)).status).toBe(200);

    const { release, holding } = await holdWallet(guest.userId);
    const opening = openBooster(guest.cookie);
    await waitForLockWaiters(1);
    const signingIn = signInWithCode(app, env, {
      email: account.email,
      code: outbox.codeFor(account.email),
      cookie: guest.cookie,
      acceptGuestLoss: true,
    });
    await waitForLockWaiters(2);
    release();
    await holding;
    const [opened, signedIn] = await Promise.all([opening, signingIn]);

    expect(opened.status).toBe(200);
    expect(signedIn.status).toBe(200);
    const drawn = openBoosterResponseSchema.parse(await opened.json()).cards;
    const expected: Record<string, number> = { ...guestBefore };
    for (const { cardId } of drawn) expected[cardId] = (expected[cardId] ?? 0) + 1;
    expect(await cardsOf(guest.userId)).toEqual(expected);
    expect(await cardsOf(account.userId)).toEqual({ "test-a-uncommon-1": 1 });
    expect(await linkOf(guest.userId)).toMatchObject({
      outcome: "abandon",
      cards: Object.values(expected).reduce((sum, quantity) => sum + quantity, 0),
    });
  });
});
