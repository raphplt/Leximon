import {
  boardResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  joustDeckResponseSchema,
  joustsResponseSchema,
  joustViewSchema,
  leagueResponseSchema,
  profileResponseSchema,
  wishesResponseSchema,
  wishSeekersResponseSchema,
} from "@leximon/contract";
import {
  featureLevels,
  JOUST_SCHEDULE,
  joustRulesAt,
  LEAGUE_SCHEDULE,
  leagueRulesAt,
  pseudoKey,
  RARITIES,
  TRADE_SCHEDULE,
  UNLOCK_SCHEDULE,
  xpToReach,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createCatalogIndexLoader } from "../challenges/catalog-index";
import { writeJoustLetters } from "../mail/mail";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  type Guest,
  STARTER_COLLECTION,
  seedTestCatalog,
  setOwnedCards,
  signInAsMember,
} from "../test-support";
import {
  answerQuestion,
  type LaunchTarget,
  launchJoust,
  nextQuestion,
  settleExpired,
  settleJoust,
} from "./jousts";
import { readJoustRecord, weekNow } from "./leagues";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 6 });
const loadCatalog = createCatalogIndexLoader(0);
const {
  joustDecks,
  joustGroupMembers,
  joustGroups,
  joustQuestions,
  jousts,
  joustRatings,
  mailLetters,
  players,
  userProgress,
} = schema;
const RULES = joustRulesAt(JOUST_SCHEDULE, Date.now());
const LEVEL_XP = xpToReach(featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, Date.now()).jousts);
const SEED = "0123456789abcdef0123456789abcdef";
// Before jousts opened to every player, when only the testers ticked in the admin could joust.
const TESTERS_ONLY = Date.parse("2026-11-08T12:00:00Z");

beforeAll(async () => {
  await seedTestCatalog(db);
  await db.execute(
    sql`update cards set definition = 'Sens de ' || id || '.' where definition is null`,
  );
});
afterAll(close);

interface Jouster extends Guest {
  readonly code: string;
}

/**
 * A member past the jousts' level, open to jousts, owning six words found at least once, all in
 * the deck they composed unless `deck` is `false`.
 */
async function jouster(
  options: { readonly access?: boolean; readonly xp?: number; readonly deck?: boolean } = {},
) {
  const member = await signInAsMember(app, env, db);
  expect((await app.request("/me/profile", { headers: headers(member) }, env)).status).toBe(200);
  const pseudo = `Jouteur ${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await db
    .update(players)
    .set({
      pseudo,
      pseudoKey: pseudoKey(pseudo),
      pseudoChangedAt: new Date("2026-01-01"),
      joustAccess: options.access ?? true,
      lastSeenAt: new Date(),
    })
    .where(eq(players.userId, member.userId))
    .returning({ code: players.code });
  if (row === undefined) throw new Error("No player row");
  const xp = options.xp ?? LEVEL_XP;
  await db
    .insert(userProgress)
    .values({ userId: member.userId, xp })
    .onConflictDoUpdate({ target: userProgress.userId, set: { xp } });
  const cardIds = RARITIES.slice(0, 2).flatMap((rarity) =>
    [1, 2, 3].map((n) => `${STARTER_COLLECTION}-${rarity}-${n}`),
  );
  await setOwnedCards(
    db,
    member.userId,
    cardIds.map((cardId) => ({ cardId, quantity: 1 })),
  );
  await db.insert(schema.userMastery).values(
    cardIds.map((cardId) => ({
      userId: member.userId,
      cardId,
      level: "sketch" as const,
      due: new Date(),
      stability: 1,
      difficulty: 5,
      scheduledDays: 1,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      state: 2,
    })),
  );
  if (options.deck ?? true) {
    await db.insert(joustDecks).values({ userId: member.userId, cardIds, updatedAt: new Date() });
  }
  return { ...member, code: row.code };
}

function headers(guest: Guest, key?: string): Record<string, string> {
  const base: Record<string, string> = {
    origin: TEST_ORIGIN,
    "content-type": "application/json",
    cookie: guest.cookie,
  };
  if (key !== undefined) base[IDEMPOTENCY_KEY_HEADER] = key;
  return base;
}

async function befriend(a: Jouster, b: Jouster) {
  await db.insert(schema.friendships).values([
    { userId: a.userId, friendId: b.userId, createdAt: new Date() },
    { userId: b.userId, friendId: a.userId, createdAt: new Date() },
  ]);
}

async function launch(
  from: Jouster,
  target: LaunchTarget,
  now = Date.now(),
  launchKey: string = crypto.randomUUID(),
) {
  return launchJoust(db, {
    userId: from.userId,
    target,
    launchKey,
    seed: SEED,
    catalog: await loadCatalog(db, now),
    now,
  });
}

async function launched(from: Jouster, to: Jouster, now = Date.now()): Promise<string> {
  const result = await launch(from, { kind: "friendly", opponentCode: to.code }, now);
  if (result.kind !== "launched") throw new Error(`Not launched: ${JSON.stringify(result)}`);
  return result.joustId;
}

async function rightCard(joustId: string, userId: string, position: number): Promise<string> {
  const [row] = await db
    .select({ cardId: joustQuestions.cardId })
    .from(joustQuestions)
    .where(
      and(
        eq(joustQuestions.joustId, joustId),
        eq(joustQuestions.answererId, userId),
        eq(joustQuestions.position, position),
      ),
    );
  if (row === undefined) throw new Error("No such question");
  return row.cardId;
}

/** Plays a whole run a second per answer from `start`, wrong at the positions in `wrongAt`. */
async function playRun(
  who: Jouster,
  joustId: string,
  start: number,
  wrongAt: readonly number[] = [],
): Promise<number> {
  let now = start;
  for (;;) {
    const question = await nextQuestion(db, { userId: who.userId, joustId, now });
    if (question.kind !== "question") return now;
    const right = await rightCard(joustId, who.userId, question.position);
    const cardId = wrongAt.includes(question.position)
      ? (question.choices.find((choice) => choice !== right) ?? right)
      : right;
    now += 1_000;
    const answer = await answerQuestion(db, {
      userId: who.userId,
      joustId,
      position: question.position,
      cardId,
      now,
    });
    expect(answer.kind).toBe("answered");
    if (answer.kind === "answered" && answer.runOver) return now;
  }
}

async function readJoustRow(joustId: string) {
  const [row] = await db.select().from(jousts).where(eq(jousts.id, joustId));
  if (row === undefined) throw new Error("No joust");
  return row;
}

async function xpOf(who: Jouster): Promise<number> {
  const [row] = await db
    .select({ xp: userProgress.xp })
    .from(userProgress)
    .where(eq(userProgress.userId, who.userId));
  return row?.xp ?? 0;
}

describe("launching", () => {
  it("refuses a player not among the testers, then a friendly joust outside friends", async () => {
    const closed = await jouster({ access: false });
    const a = await jouster();
    const b = await jouster();
    expect(await launch(closed, { kind: "friendly", opponentCode: a.code }, TESTERS_ONLY)).toEqual({
      kind: "refused",
      reason: "not_open",
    });
    expect(await launch(a, { kind: "friendly", opponentCode: b.code })).toEqual({
      kind: "refused",
      reason: "not_friends",
    });
    await befriend(a, closed);
    expect(await launch(a, { kind: "friendly", opponentCode: closed.code }, TESTERS_ONLY)).toEqual({
      kind: "refused",
      reason: "opponent_unavailable",
    });
    expect(await launch(closed, { kind: "friendly", opponentCode: a.code })).toMatchObject({
      kind: "launched",
    });
  });

  it("makes one joust for one key, with five questions for each player", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const key = crypto.randomUUID();
    const target = { kind: "friendly", opponentCode: b.code } as const;
    const [first, second] = await Promise.all([
      launch(a, target, Date.now(), key),
      launch(a, target, Date.now(), key),
    ]);
    expect(first.kind).toBe("launched");
    expect(second).toEqual(first);
    if (first.kind !== "launched") return;
    const questions = await db
      .select()
      .from(joustQuestions)
      .where(eq(joustQuestions.joustId, first.joustId));
    expect(questions.filter((q) => q.answererId === a.userId)).toHaveLength(RULES.drawn);
    expect(questions.filter((q) => q.answererId === b.userId)).toHaveLength(RULES.drawn);
    for (const question of questions) {
      expect(question.choices).toHaveLength(RULES.choices);
      expect(question.choices).toContain(question.cardId);
    }
  });

  it("waits for a deck the player composed, but keeps the one a tester already played", async () => {
    const a = await jouster({ deck: false });
    const b = await jouster({ deck: false });
    await befriend(a, b);
    expect(await launch(a, { kind: "friendly", opponentCode: b.code })).toEqual({
      kind: "refused",
      reason: "deck_not_saved",
    });
    // The opponent's deck may still be the game's: only the challenger composes one first.
    const c = await jouster();
    await befriend(c, a);
    await launched(c, a);
    expect((await launch(a, { kind: "friendly", opponentCode: b.code })).kind).toBe("launched");
    const [saved] = await db.select().from(joustDecks).where(eq(joustDecks.userId, a.userId));
    expect(saved?.cardIds.length).toBeGreaterThanOrEqual(RULES.drawn);
  });

  it("keeps the number of jousts waiting under its limit", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    for (let n = 0; n < RULES.maxWaiting; n++) await launched(a, b);
    expect(await launch(a, { kind: "friendly", opponentCode: b.code })).toEqual({
      kind: "refused",
      reason: "too_many_waiting",
    });
  });
});

describe("a joust played to the end", () => {
  it("gives the run's XP, then the win and the day's sachet, and writes the letters", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const start = Date.now();
    const joustId = await launched(a, b, start);
    const before = { a: await xpOf(a), b: await xpOf(b) };

    // The second player waits for the first run.
    expect(await nextQuestion(db, { userId: b.userId, joustId, now: start })).toEqual({
      kind: "refused",
      reason: "not_your_turn",
    });
    const aDone = await playRun(a, joustId, start);
    await settleJoust(db, joustId, aDone);
    const afterRun = await readJoustRow(joustId);
    expect(afterRun.challengerCorrect).toBe(RULES.drawn);
    expect(afterRun.challengerXp).toBe(RULES.xpPlayed);
    expect(afterRun.replyBy?.getTime()).toBe(aDone + RULES.replyMs);
    await writeJoustLetters(db, [joustId]);

    const bDone = await playRun(b, joustId, aDone + 60_000, [0]);
    await Promise.all([1, 2, 3].map(() => settleJoust(db, joustId, bDone)));
    const ended = await readJoustRow(joustId);
    expect(ended.outcome).toBe("challenger");
    expect(ended.challengerXp).toBe(RULES.xpPlayed + RULES.xpWon);
    expect(ended.challengerBoosters).toBe(RULES.firstWinBoosters);
    expect(ended.opponentXp).toBe(RULES.xpPlayed);
    expect(ended.ratings).toBeNull();
    expect(await xpOf(a)).toBe(before.a + RULES.xpPlayed + RULES.xpWon);
    expect(await xpOf(b)).toBe(before.b + RULES.xpPlayed);
    const [wallet] = await db
      .select({ bonus: schema.boosterWallets.bonusBoosters })
      .from(schema.boosterWallets)
      .where(eq(schema.boosterWallets.userId, a.userId));
    expect(wallet?.bonus).toBe(RULES.firstWinBoosters);

    await writeJoustLetters(db, [joustId]);
    const letters = await db
      .select({ userId: mailLetters.userId, kind: mailLetters.kind, readAt: mailLetters.readAt })
      .from(mailLetters)
      .where(inArray(mailLetters.userId, [a.userId, b.userId]));
    expect(letters).toEqual(
      expect.arrayContaining([
        { userId: b.userId, kind: "joust_received", readAt: expect.any(Date) },
        { userId: a.userId, kind: "joust_ended", readAt: null },
      ]),
    );
    expect(letters).toHaveLength(2);
  });

  it("counts an answer past the clock as wrong, and keeps the first of two answers", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const start = Date.now();
    const joustId = await launched(a, b, start);
    const first = await nextQuestion(db, { userId: a.userId, joustId, now: start });
    if (first.kind !== "question") throw new Error("No question");
    const right = await rightCard(joustId, a.userId, first.position);
    const late = await answerQuestion(db, {
      userId: a.userId,
      joustId,
      position: first.position,
      cardId: right,
      now: start + RULES.answerMs + RULES.graceMs + 1,
    });
    expect(late).toMatchObject({ kind: "answered", correct: false, late: true });

    const second = await nextQuestion(db, { userId: a.userId, joustId, now: start + 20_000 });
    if (second.kind !== "question") throw new Error("No question");
    expect(second.position).toBe(first.position + 1);
    const secondRight = await rightCard(joustId, a.userId, second.position);
    const other = second.choices.find((choice) => choice !== secondRight) ?? secondRight;
    const answers = await Promise.all(
      [secondRight, other, secondRight, other].map((cardId) =>
        answerQuestion(db, {
          userId: a.userId,
          joustId,
          position: second.position,
          cardId,
          now: start + 21_000,
        }),
      ),
    );
    const results = new Set(answers.map((answer) => JSON.stringify(answer)));
    expect(results.size).toBe(1);
    const [stored] = await db
      .select({ chosen: joustQuestions.chosenCardId, correct: joustQuestions.correct })
      .from(joustQuestions)
      .where(
        and(
          eq(joustQuestions.joustId, joustId),
          eq(joustQuestions.answererId, a.userId),
          eq(joustQuestions.position, second.position),
        ),
      );
    expect(answers[0]).toMatchObject({ correct: stored?.correct });
    expect([secondRight, other]).toContain(stored?.chosen);
  });

  it("refuses a word that was not offered, and a question not served yet", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const joustId = await launched(a, b);
    expect(
      await answerQuestion(db, {
        userId: a.userId,
        joustId,
        position: 0,
        cardId: "nowhere",
        now: Date.now(),
      }),
    ).toEqual({ kind: "refused", reason: "not_served" });
    await nextQuestion(db, { userId: a.userId, joustId, now: Date.now() });
    expect(
      await answerQuestion(db, {
        userId: a.userId,
        joustId,
        position: 0,
        cardId: "nowhere",
        now: Date.now(),
      }),
    ).toEqual({ kind: "refused", reason: "not_a_choice" });
  });

  it("gives the joust to the first player when the second never comes", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const start = Date.now();
    const joustId = await launched(a, b, start);
    const aDone = await playRun(a, joustId, start, [0, 1, 2, 3, 4]);
    await settleJoust(db, joustId, aDone);
    const replyBy = (await readJoustRow(joustId)).replyBy?.getTime() ?? 0;
    expect(await nextQuestion(db, { userId: b.userId, joustId, now: replyBy + 1 })).toEqual({
      kind: "run_over",
    });
    const swept = await settleExpired(db, replyBy + 1);
    expect(swept.joustIds).toContain(joustId);
    const ended = await readJoustRow(joustId);
    expect(ended).toMatchObject({ outcome: "challenger", forfeit: true, opponentXp: 0 });
    await writeJoustLetters(db, [joustId]);
    const letters = await db
      .select({ userId: mailLetters.userId, kind: mailLetters.kind })
      .from(mailLetters)
      .where(
        and(eq(mailLetters.kind, "joust_ended"), inArray(mailLetters.userId, [a.userId, b.userId])),
      );
    expect(letters).toHaveLength(2);
  });

  it("closes a run whose time is gone, questions left unanswered", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const start = Date.now();
    const joustId = await launched(a, b, start);
    await nextQuestion(db, { userId: a.userId, joustId, now: start });
    await settleJoust(db, joustId, start + RULES.runMs);
    expect(await readJoustRow(joustId)).toMatchObject({
      challengerCorrect: 0,
      challengerMs: RULES.answerMs * RULES.drawn,
    });
  });

  it("starts the first player's clock at their first word, after the face-to-face", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const start = Date.now();
    const joustId = await launched(a, b, start);
    const view = async () =>
      joustViewSchema.parse(
        await (await app.request(`/jousts/${joustId}`, { headers: headers(a) }, env)).json(),
      );
    const before = await view();
    expect(before.started).toBe(false);
    expect(before.duel?.mine.rarities).toHaveLength(RULES.drawn);
    expect(before.duel?.theirs.rarities).toHaveLength(RULES.drawn);
    expect(Date.parse(before.startBy ?? "")).toBeGreaterThan(start);

    // An hour on the face-to-face, longer than a whole run: the run has not begun.
    const later = start + 60 * 60_000;
    expect((await settleExpired(db, later)).joustIds).not.toContain(joustId);
    const first = await nextQuestion(db, { userId: a.userId, joustId, now: later });
    expect(first).toMatchObject({ kind: "question", position: 0, servedAt: later });
    const after = await view();
    expect(after).toMatchObject({ started: true, startBy: null, duel: null });
    const end = await playRun(a, joustId, later);
    await settleJoust(db, joustId, end);
    expect((await readJoustRow(joustId)).challengerCorrect).toBe(RULES.drawn);
  });

  it("serves the first word once to two requests at the same instant", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const start = Date.now();
    const joustId = await launched(a, b, start);
    const [one, two] = await Promise.all([
      nextQuestion(db, { userId: a.userId, joustId, now: start + 5_000 }),
      nextQuestion(db, { userId: a.userId, joustId, now: start + 5_100 }),
    ]);
    expect(one).toMatchObject({ kind: "question", position: 0 });
    expect(two).toMatchObject({ kind: "question", position: 0 });
    if (one.kind === "question" && two.kind === "question") {
      expect(one.servedAt).toBe(two.servedAt);
    }
  });

  it("gives the joust to the other when the first player never starts in 24 hours", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const start = Date.now();
    const joustId = await launched(a, b, start);
    const due = start + RULES.startMs;
    expect((await settleExpired(db, due - 1)).joustIds).not.toContain(joustId);
    expect(await nextQuestion(db, { userId: a.userId, joustId, now: due })).toEqual({
      kind: "run_over",
    });
    const swept = await settleExpired(db, due);
    expect(swept.joustIds).toContain(joustId);
    expect(await readJoustRow(joustId)).toMatchObject({
      outcome: "opponent",
      forfeit: true,
      challengerDoneAt: null,
      opponentXp: 0,
      challengerXp: 0,
    });
    // The other player was never offered it: it stays out of their list and their letters.
    const list = async (who: Jouster) =>
      joustsResponseSchema.parse(
        await (await app.request("/jousts", { headers: headers(who) }, env)).json(),
      );
    expect((await list(b)).jousts.map((joust) => joust.id)).not.toContain(joustId);
    expect((await list(a)).jousts.find((joust) => joust.id === joustId)).toMatchObject({
      state: "ended",
      outcome: "lost",
      forfeit: true,
    });
    await writeJoustLetters(db, [joustId]);
    const letters = await db
      .select({ userId: mailLetters.userId })
      .from(mailLetters)
      .where(inArray(mailLetters.userId, [a.userId, b.userId]));
    expect(letters).toEqual([]);
  });

  it("gives no XP past the day's rewarded jousts", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const now = Date.now();
    await db.insert(jousts).values(
      Array.from({ length: RULES.rewardedPerDay }, () => ({
        kind: "friendly" as const,
        challengerId: a.userId,
        opponentId: b.userId,
        launchKey: crypto.randomUUID(),
        createdAt: new Date(now),
        challengerDoneAt: new Date(now),
        challengerRewarded: true,
        endedAt: new Date(now),
        outcome: "draw",
      })),
    );
    const joustId = await launched(a, b, now);
    const done = await playRun(a, joustId, now);
    await settleJoust(db, joustId, done);
    expect(await readJoustRow(joustId)).toMatchObject({
      challengerXp: 0,
      challengerRewarded: false,
    });
  });
});

describe("ranked jousts", () => {
  it("find a player who came by lately, and move both ratings", async () => {
    const a = await jouster();
    const b = await jouster();
    // Everyone else is away: the only opponent left is the second player.
    await db
      .update(players)
      .set({ lastSeenAt: new Date("2026-01-01") })
      .where(notInArray(players.userId, [a.userId, b.userId]));
    const now = Date.now();
    const result = await launch(a, { kind: "ranked" }, now);
    if (result.kind !== "launched") throw new Error(`Not launched: ${JSON.stringify(result)}`);
    const row = await readJoustRow(result.joustId);
    expect(row).toMatchObject({ kind: "ranked", opponentId: b.userId });

    // Met once a day in a ranked joust.
    expect(await launch(a, { kind: "ranked" }, now)).toEqual({
      kind: "refused",
      reason: "no_opponent",
    });

    const aDone = await playRun(a, result.joustId, now);
    await settleJoust(db, result.joustId, aDone);
    const bDone = await playRun(b, result.joustId, aDone + 1_000, [0, 1]);
    await settleJoust(db, result.joustId, bDone);
    const ratings = await db
      .select()
      .from(joustRatings)
      .where(inArray(joustRatings.userId, [a.userId, b.userId]));
    const of = (id: string) => ratings.find((rating) => rating.userId === id);
    expect(of(a.userId)?.rating).toBeGreaterThan(RULES.glicko.initial.rating);
    expect(of(b.userId)?.rating).toBeLessThan(RULES.glicko.initial.rating);
    expect(of(a.userId)?.games).toBe(1);
    expect((await readJoustRow(result.joustId)).ratings?.challenger.before).toBe(
      RULES.glicko.initial.rating,
    );
  });
});

describe("the routes", () => {
  it("list the player's jousts and launch one with the idempotency key", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const launchedResponse = await app.request(
      "/jousts",
      {
        method: "POST",
        headers: headers(a, crypto.randomUUID()),
        body: JSON.stringify({ kind: "friendly", opponentCode: b.code }),
      },
      env,
    );
    expect(launchedResponse.status).toBe(201);
    const listed = joustsResponseSchema.parse(
      await (await app.request("/jousts", { headers: headers(a) }, env)).json(),
    );
    expect(listed).toMatchObject({ access: "open", deckReady: true, waiting: 1 });
    expect(listed.jousts[0]).toMatchObject({ launched: true, state: "play" });
    // The opponent does not see it before the first run is over.
    const theirs = joustsResponseSchema.parse(
      await (await app.request("/jousts", { headers: headers(b) }, env)).json(),
    );
    expect(theirs.jousts).toEqual([]);

    const low = await jouster({ xp: 0 });
    const refused = joustsResponseSchema.parse(
      await (await app.request("/jousts", { headers: headers(low) }, env)).json(),
    );
    expect(refused.access).toBe("level_too_low");
  });

  it("mark the first visit done once, for good", async () => {
    const a = await jouster();
    const list = async () =>
      joustsResponseSchema.parse(
        await (await app.request("/jousts", { headers: headers(a) }, env)).json(),
      );
    expect(await list()).toMatchObject({ guideDone: false, deckSaved: true });
    const guide = () => app.request("/jousts/guide", { method: "POST", headers: headers(a) }, env);
    const [first, second] = await Promise.all([guide(), guide()]);
    expect([first.status, second.status]).toEqual([204, 204]);
    const [row] = await db
      .select({ at: players.joustGuideDoneAt })
      .from(players)
      .where(eq(players.userId, a.userId));
    expect((await list()).guideDone).toBe(true);
    expect((await guide()).status).toBe(204);
    const [again] = await db
      .select({ at: players.joustGuideDoneAt })
      .from(players)
      .where(eq(players.userId, a.userId));
    expect(again?.at).toEqual(row?.at);
  });

  it("offer for the deck every card owned, a word never reviewed too, and keep what they offer", async () => {
    const a = await jouster({ deck: false });
    const unreviewed = `${STARTER_COLLECTION}-rare-1`;
    await setOwnedCards(db, a.userId, [{ cardId: unreviewed, quantity: 1 }]);
    const deck = joustDeckResponseSchema.parse(
      await (await app.request("/jousts/deck", { headers: headers(a) }, env)).json(),
    );
    const offered = deck.candidates.map((candidate) => candidate.cardId);
    expect(offered).toHaveLength(7);
    expect(offered).toContain(unreviewed);
    const saved = await app.request(
      "/jousts/deck",
      { method: "PUT", headers: headers(a), body: JSON.stringify({ cardIds: offered }) },
      env,
    );
    expect(saved.status).toBe(204);
  });

  it("show the closed run and its traps, then the result sealed until seen", async () => {
    const a = await jouster();
    const b = await jouster();
    const outsider = await jouster();
    await befriend(a, b);
    const joustId = await launched(a, b);
    const view = async (who: Jouster) =>
      joustViewSchema.parse(
        await (await app.request(`/jousts/${joustId}`, { headers: headers(who) }, env)).json(),
      );
    expect(await view(a)).toMatchObject({ run: null, traps: null });

    const end = await playRun(a, joustId, Date.now(), [1]);
    await settleJoust(db, joustId, end);
    const closed = await view(a);
    expect(closed.run?.answers.map((answer) => answer.correct)).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
    const traps = await db
      .select({ cardId: joustQuestions.cardId })
      .from(joustQuestions)
      .where(and(eq(joustQuestions.joustId, joustId), eq(joustQuestions.answererId, b.userId)))
      .orderBy(joustQuestions.position);
    expect(closed.traps).toEqual(traps.map((row) => row.cardId));

    const seen = (who: Jouster) =>
      app.request(`/jousts/${joustId}/seen`, { method: "POST", headers: headers(who) }, env);
    // Nothing to see before the joust ends.
    expect((await seen(a)).status).toBe(404);
    await settleJoust(db, joustId, await playRun(b, joustId, end));
    expect((await view(a)).summary.seen).toBe(false);
    expect((await view(b)).summary.seen).toBe(false);
    const [first, second] = await Promise.all([seen(a), seen(a)]);
    expect([first.status, second.status]).toEqual([204, 204]);
    expect((await view(a)).summary.seen).toBe(true);
    expect((await view(b)).summary.seen).toBe(false);
    expect((await seen(outsider)).status).toBe(404);
  });

  it("serve the question without its answer", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const joustId = await launched(a, b);
    const response = await app.request(
      `/jousts/${joustId}/next`,
      { method: "POST", headers: headers(a) },
      env,
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ kind: "question", position: 0 });
    expect(Object.keys(body).sort()).toEqual(
      ["choices", "deadline", "definition", "kind", "position", "servedAt"].sort(),
    );
    expect(String(body["definition"])).toMatch(/^Sens de /);
    const others = await db
      .select({ id: jousts.id })
      .from(jousts)
      .where(and(eq(jousts.id, joustId), isNull(jousts.endedAt)));
    expect(others).toHaveLength(1);
  });
});

describe("leagues", () => {
  const LEAGUE = leagueRulesAt(LEAGUE_SCHEDULE, Date.now());
  const WEEK_MS = 7 * 86_400_000;
  const week = (at = Date.now()) => weekNow(LEAGUE, at);
  /** A week no other test plays in, far ahead: its groups start empty. */
  const weekAhead = () => Date.now() + (200 + Math.floor(Math.random() * 5_000)) * WEEK_MS;

  /** A group of `league` in `at`'s week, holding the given players with their points. */
  async function groupOf(
    league: string,
    members: readonly { readonly who: Jouster; readonly points: number }[],
    at = week(),
  ) {
    const [group] = await db
      .insert(joustGroups)
      .values({
        week: at,
        league,
        seed: SEED,
        players: members.length,
        createdAt: new Date(),
      })
      .returning({ id: joustGroups.id });
    if (group === undefined) throw new Error("No group");
    if (members.length > 0) {
      await db.insert(joustGroupMembers).values(
        members.map(({ who, points }) => ({
          userId: who.userId,
          week: at,
          groupId: group.id,
          league,
          points,
          scoredAt: new Date(Date.now() - 3_600_000),
          joinedAt: new Date(Date.now() - 3_600_000),
        })),
      );
    }
    return group.id;
  }

  async function memberOf(who: Jouster, at = week()) {
    const [row] = await db
      .select()
      .from(joustGroupMembers)
      .where(and(eq(joustGroupMembers.userId, who.userId), eq(joustGroupMembers.week, at)));
    return row;
  }

  /** A ranked joust between two given players, `winner` finding every word, the other none. */
  async function rankedJoust(winner: Jouster, loser: Jouster, now = Date.now()) {
    await db
      .insert(schema.friendships)
      .values([
        { userId: winner.userId, friendId: loser.userId, createdAt: new Date() },
        { userId: loser.userId, friendId: winner.userId, createdAt: new Date() },
      ])
      .onConflictDoNothing();
    const joustId = await launched(winner, loser, now);
    await db.update(jousts).set({ kind: "ranked" }).where(eq(jousts.id, joustId));
    const done = await playRun(winner, joustId, now);
    await settleJoust(db, joustId, done);
    return { joustId, done };
  }

  async function league(who: Jouster) {
    return leagueResponseSchema.parse(
      await (await app.request("/jousts/league", { headers: headers(who) }, env)).json(),
    );
  }

  it("give the winner of a ranked joust 3 points, entering both in a group of their league", async () => {
    const a = await jouster();
    const b = await jouster();
    const { joustId, done } = await rankedJoust(a, b);
    const bDone = await playRun(b, joustId, done + 1_000, [0, 1, 2, 3, 4]);
    await settleJoust(db, joustId, bDone);
    const winner = await memberOf(a);
    const loser = await memberOf(b);
    expect(winner).toMatchObject({ league: "page", points: 3, wins: 1, losses: 0 });
    expect(loser).toMatchObject({ league: "page", points: 0, wins: 0, losses: 1 });
    expect((await readJoustRow(joustId)).points).toEqual({ challenger: 3, opponent: 0 });
    const view = joustViewSchema.parse(
      await (await app.request(`/jousts/${joustId}`, { headers: headers(a) }, env)).json(),
    );
    expect(view.result?.tournament).toMatchObject({
      won: 3,
      league: "page",
      group: { points: 3, size: 30 },
    });
    const home = joustsResponseSchema.parse(
      await (await app.request("/jousts", { headers: headers(a) }, env)).json(),
    );
    expect(home.standing).toMatchObject({
      league: "page",
      group: { points: 3, size: 30 },
      rankedPerDay: 5,
      rewardsWaiting: 0,
    });
  });

  it("show the league, the week's points and the ranked jousts on the profile, nothing before", async () => {
    const a = await jouster();
    const b = await jouster();
    expect(await readJoustRecord(db, a.userId, Date.now())).toEqual({
      jousts: null,
      bestLeague: null,
    });
    const { joustId, done } = await rankedJoust(a, b);
    await settleJoust(db, joustId, await playRun(b, joustId, done + 1_000, [0]));
    const own = profileResponseSchema.parse(
      await (await app.request("/me/profile", { headers: headers(a) }, env)).json(),
    );
    expect(own.jousts).toMatchObject({ league: "page", ranked: 1, week: { points: 3, size: 30 } });
    expect(await readJoustRecord(db, b.userId, Date.now())).toMatchObject({
      jousts: { ranked: 1, week: { points: 0 } },
      bestLeague: "page",
    });
  });

  it("count both ranked jousts of a player ending at the same time", async () => {
    const a = await jouster();
    const b = await jouster();
    const c = await jouster();
    const now = Date.now();
    const first = await rankedJoust(b, a, now);
    const second = await rankedJoust(c, a, now);
    const aFirst = await playRun(a, first.joustId, first.done + 1_000, [0]);
    const aSecond = await playRun(a, second.joustId, second.done + 1_000, [0]);
    const at = Math.max(aFirst, aSecond);
    await Promise.all([
      settleJoust(db, first.joustId, at),
      settleJoust(db, second.joustId, at),
      settleJoust(db, first.joustId, at),
    ]);
    expect(await memberOf(a)).toMatchObject({ points: 0, losses: 2 });
    for (const winner of [b, c]) expect(await memberOf(winner)).toMatchObject({ points: 3 });
  });

  it("never put more than 30 players in a group, however many enter at once", async () => {
    const at = weekAhead();
    const almostFull = await db
      .insert(joustGroups)
      .values({ week: week(at), league: "page", seed: SEED, players: 29, createdAt: new Date() })
      .returning({ id: joustGroups.id });
    const pairs = await Promise.all(
      [0, 1, 2].map(async () => {
        const winner = await jouster();
        const loser = await jouster();
        await befriend(winner, loser);
        const joustId = await launched(winner, loser);
        await db.update(jousts).set({ kind: "ranked" }).where(eq(jousts.id, joustId));
        const done = await playRun(winner, joustId, Date.now());
        await settleJoust(db, joustId, done);
        await playRun(loser, joustId, done + 1_000, [0, 1, 2, 3, 4]);
        return joustId;
      }),
    );
    await Promise.all(pairs.map((joustId) => settleJoust(db, joustId, at)));
    const groups = await db
      .select({ id: joustGroups.id, players: joustGroups.players })
      .from(joustGroups)
      .where(and(eq(joustGroups.week, week(at)), eq(joustGroups.league, "page")));
    expect(groups.find((group) => group.id === almostFull[0]?.id)?.players).toBe(30);
    expect(groups.map((group) => group.players).sort((x, y) => x - y)).toEqual([5, 30]);
    const counted = await db.execute<{ group_id: string; count: number }>(sql`
      select group_id, count(*)::int as count from joust_group_members
      where week = ${week(at)} group by group_id`);
    expect(counted.rows.map((row) => row.count).sort()).toEqual([1, 5]);
  });

  it("let a week's rewards be claimed once it is over, and send the player up", async () => {
    const a = await jouster();
    await groupOf("page", [{ who: a, points: 100 }], week() - 1);
    const claim = (at: number) =>
      app.request(`/jousts/league/${at}`, { method: "POST", headers: headers(a) }, env);

    const before = await league(a);
    expect(before.standing).toMatchObject({ league: "ecuyer", group: null, rewardsWaiting: 1 });
    expect(before.waiting).toEqual([
      {
        week: week() - 1,
        league: "page",
        place: 1,
        move: "up",
        rewards: [{ kind: "ecus", amount: 10 }, { kind: "garni_booster" }],
      },
    ]);
    expect(before.ladder.map((step) => step.league)).toEqual([
      "page",
      "ecuyer",
      "chevalier",
      "banneret",
      "marechal",
      "connetable",
      "champion",
    ]);

    expect((await claim(week())).status).toBe(409);
    expect((await claim(week() - 2)).status).toBe(409);
    const [first, second] = await Promise.all([claim(week() - 1), claim(week() - 1)]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      week: week() - 1,
      rewards: [{ kind: "ecus", amount: 10 }, { kind: "garni_booster" }],
    });
    const wallet = await db
      .select()
      .from(schema.boosterWallets)
      .where(eq(schema.boosterWallets.userId, a.userId));
    expect(wallet[0]).toMatchObject({ ecus: 10, garniBoosters: 1 });
    const movements = await db
      .select()
      .from(schema.ecuMovements)
      .where(eq(schema.ecuMovements.userId, a.userId));
    expect(movements).toHaveLength(1);
    expect((await league(a)).waiting).toEqual([]);
  });

  it("enter a player sent up last week in a group of their new league", async () => {
    const a = await jouster();
    const b = await jouster();
    await groupOf("chevalier", [{ who: a, points: 100 }], week() - 1);
    const { joustId, done } = await rankedJoust(a, b);
    // Settled a day later: on a Sunday, in next week's tournament.
    const settled = done + RULES.replyMs + 1_000;
    await settleJoust(db, joustId, settled);
    expect(await memberOf(a, week(settled))).toMatchObject({ league: "banneret", points: 3 });
    expect(await memberOf(b, week(settled))).toMatchObject({ league: "page", losses: 1 });
  });

  it("show the group with its automatons, and rank friends and clan by league then points", async () => {
    const a = await jouster();
    const b = await jouster();
    const hidden = await jouster();
    const friend = await jouster();
    const outsider = await jouster();
    await groupOf("ecuyer", [
      { who: a, points: 12 },
      { who: b, points: 30 },
      { who: hidden, points: 6 },
    ]);
    await groupOf("chevalier", [{ who: friend, points: 3 }]);
    await befriend(a, friend);
    await db.insert(schema.userBlocks).values({
      blockerId: a.userId,
      blockedId: hidden.userId,
      createdAt: new Date(),
    });
    const board = async (name: string, who: Jouster = a) =>
      boardResponseSchema.parse(
        await (await app.request(`/jousts/boards/${name}`, { headers: headers(who) }, env)).json(),
      );

    const group = await board("group");
    expect(group).toMatchObject({ league: "ecuyer", moves: { up: 8, down: 3 }, closed: null });
    expect(group.entries).toHaveLength(30);
    expect(group.entries.filter((entry) => entry.kind === "bot")).toHaveLength(27);
    expect(group.entries.filter((entry) => entry.kind === "hidden")).toHaveLength(1);
    const codes = group.entries.flatMap((entry) =>
      entry.kind === "player" ? [entry.player.code] : [],
    );
    expect(codes.indexOf(b.code)).toBeLessThan(codes.indexOf(a.code));
    expect(group.me).toMatchObject({ kind: "player", points: 12, league: "ecuyer" });
    expect(group.entries.map((entry) => entry.place)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );

    expect(await board("group", outsider)).toMatchObject({
      closed: "not_entered",
      me: null,
      entries: [],
    });

    const friends = await board("friends");
    expect(
      friends.entries.map((entry) => [
        entry.kind === "player" ? entry.player.code : entry.kind,
        entry.league,
        entry.place,
      ]),
    ).toEqual([
      [friend.code, "chevalier", 1],
      [a.code, "ecuyer", 2],
    ]);
    expect((await board("clan")).closed).toBe("no_clan");
    expect((await board("general")).closed).toBe("general_closed");
    const page = await app.request(
      "/jousts/boards/general?after=nope",
      { headers: headers(a) },
      env,
    );
    expect(page.status).toBe(400);
  });

  it("allow 5 ranked jousts a day, launched or received, and free jousts without limit", async () => {
    const a = await jouster();
    const b = await jouster();
    const other = await jouster();
    const away = await jouster();
    const gone = await jouster();
    await db
      .update(players)
      .set({ lastSeenAt: new Date("2026-01-01") })
      .where(notInArray(players.userId, [a.userId, b.userId, other.userId]));
    const past = (challenger: Jouster, opponent: Jouster) => ({
      kind: "ranked" as const,
      challengerId: challenger.userId,
      opponentId: opponent.userId,
      launchKey: crypto.randomUUID(),
      createdAt: new Date(),
      endedAt: new Date(),
      outcome: "draw",
    });
    // `b` played 5 ranked jousts today, 3 of them received: no ranked joust for them.
    await db
      .insert(jousts)
      .values([past(b, away), past(b, gone), past(away, b), past(away, b), past(gone, b)]);
    const ranked = await launch(a, { kind: "ranked" });
    if (ranked.kind !== "launched") throw new Error(`Not launched: ${JSON.stringify(ranked)}`);
    expect((await readJoustRow(ranked.joustId)).opponentId).toBe(other.userId);
    expect(await launch(b, { kind: "ranked" })).toEqual({
      kind: "refused",
      reason: "ranked_limit",
    });
    const free = await launch(b, { kind: "free" });
    if (free.kind !== "launched") throw new Error(`Not launched: ${JSON.stringify(free)}`);
    expect(await readJoustRow(free.joustId)).toMatchObject({ kind: "free" });
    const home = joustsResponseSchema.parse(
      await (await app.request("/jousts", { headers: headers(b) }, env)).json(),
    );
    expect(home.standing.rankedLeft).toBe(0);
  });
});

describe("traps and wishes", () => {
  async function trapsOf(who: Jouster) {
    const rows = await db
      .select({ cardId: schema.joustTraps.cardId, trapped: schema.joustTraps.trapped })
      .from(schema.joustTraps)
      .where(eq(schema.joustTraps.userId, who.userId));
    return new Map(rows.map((row) => [row.cardId, row.trapped]));
  }

  async function askedTo(joustId: string, who: Jouster) {
    const rows = await db
      .select({ cardId: joustQuestions.cardId, position: joustQuestions.position })
      .from(joustQuestions)
      .where(and(eq(joustQuestions.joustId, joustId), eq(joustQuestions.answererId, who.userId)))
      .orderBy(joustQuestions.position);
    return rows.map((row) => row.cardId);
  }

  async function get<T>(who: Jouster, path: string, parse: (value: unknown) => T): Promise<T> {
    return parse(await (await app.request(path, { headers: headers(who) }, env)).json());
  }

  it("count each card's traps and wish the words of the run not owned", async () => {
    const a = await jouster();
    const b = await jouster();
    await befriend(a, b);
    const joustId = await launched(a, b);
    const asked = await askedTo(joustId, b);
    const unknown = asked[2] ?? "";
    // `b` lost that card since the launch: it is a word they do not own.
    await db
      .update(schema.userCards)
      .set({ quantity: 0 })
      .where(and(eq(schema.userCards.userId, b.userId), eq(schema.userCards.cardId, unknown)));
    const aDone = await playRun(a, joustId, Date.now());
    await settleJoust(db, joustId, aDone);
    const bDone = await playRun(b, joustId, aDone + 1_000, [0, 1]);
    await settleJoust(db, joustId, bDone);

    expect(await trapsOf(a)).toEqual(
      new Map([
        [asked[0], 1],
        [asked[1], 1],
      ]),
    );
    expect((await trapsOf(b)).size).toBe(0);
    const deck = await get(a, "/jousts/deck", (v) => joustDeckResponseSchema.parse(v));
    expect(deck.trapped.sort((x, y) => x.cardId.localeCompare(y.cardId))).toEqual(
      [asked[0], asked[1]].sort().map((cardId) => ({ cardId, count: 1 })),
    );

    const view = await get(b, `/jousts/${joustId}`, (v) => joustViewSchema.parse(v));
    expect(view.result?.wished).toEqual([unknown]);
    const wishes = await get(b, "/me/wishes", (v) => wishesResponseSchema.parse(v));
    expect(wishes.wishes.map((wish) => [wish.cardId, wish.source])).toEqual([[unknown, "joust"]]);
    expect((await get(a, "/me/wishes", (v) => wishesResponseSchema.parse(v))).wishes).toEqual([]);

    const removed = await app.request(
      `/me/wishes/${unknown}`,
      { method: "DELETE", headers: headers(b) },
      env,
    );
    expect(removed.status).toBe(204);
    expect((await get(b, "/me/wishes", (v) => wishesResponseSchema.parse(v))).wishes).toEqual([]);
  });

  it("count the traps of two jousts ending at the same time", async () => {
    const a = await jouster();
    const b = await jouster();
    const c = await jouster();
    await befriend(a, b);
    await befriend(a, c);
    const first = await launched(a, b);
    const second = await launched(a, c);
    const start = Date.now();
    const aFirst = await playRun(a, first, start);
    const aSecond = await playRun(a, second, aFirst);
    await settleJoust(db, first, aFirst);
    await settleJoust(db, second, aSecond);
    const bDone = await playRun(b, first, aSecond + 1_000, [0, 1, 2, 3, 4]);
    const cDone = await playRun(c, second, aSecond + 1_000, [0, 1, 2, 3, 4]);
    const at = Math.max(bDone, cDone);
    await Promise.all([settleJoust(db, first, at), settleJoust(db, second, at)]);
    const traps = await trapsOf(a);
    expect([...traps.values()].reduce((sum, count) => sum + count, 0)).toBe(10);
    const expected = new Map<string, number>();
    for (const cardId of [...(await askedTo(first, b)), ...(await askedTo(second, c))]) {
      expected.set(cardId, (expected.get(cardId) ?? 0) + 1);
    }
    expect(traps).toEqual(expected);
  });

  it("show a player's doubles only to those who wish them, and only those words", async () => {
    const holder = await jouster();
    const seeker = await jouster();
    const blocked = await jouster();
    const emptyHanded = await jouster();
    const double = `${STARTER_COLLECTION}-${RARITIES[0]}-1`;
    const notHeld = `${STARTER_COLLECTION}-${RARITIES[0]}-2`;
    const theirDouble = `${STARTER_COLLECTION}-${RARITIES[0]}-3`;
    await setOwnedCards(db, holder.userId, [{ cardId: double, quantity: 3 }]);
    for (const who of [seeker, blocked, emptyHanded]) {
      await setOwnedCards(db, who.userId, [
        { cardId: double, quantity: 0 },
        { cardId: notHeld, quantity: 0 },
        { cardId: theirDouble, quantity: who === emptyHanded ? 1 : 2 },
      ]);
      await db.insert(schema.wishes).values([
        { userId: who.userId, cardId: double, source: "joust", seenAt: new Date() },
        { userId: who.userId, cardId: notHeld, source: "joust", seenAt: new Date() },
      ]);
    }
    await db.insert(schema.userBlocks).values({
      blockerId: blocked.userId,
      blockedId: holder.userId,
      createdAt: new Date(),
    });
    const seekers = await get(holder, "/me/wish-seekers", (v) =>
      wishSeekersResponseSchema.parse(v),
    );
    const mine = seekers.players.filter((entry) =>
      [seeker.code, blocked.code, emptyHanded.code].includes(entry.player.code),
    );
    expect(mine).toEqual([
      { player: expect.objectContaining({ code: seeker.code }), cardIds: [double] },
    ]);

    // Once the seeker owns the word, they no longer look for it.
    await setOwnedCards(db, seeker.userId, [{ cardId: double, quantity: 1 }]);
    const after = await get(holder, "/me/wish-seekers", (v) => wishSeekersResponseSchema.parse(v));
    expect(after.players.some((entry) => entry.player.code === seeker.code)).toBe(false);
  });
});
