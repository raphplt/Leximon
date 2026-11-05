import { IDEMPOTENCY_KEY_HEADER, joustsResponseSchema } from "@leximon/contract";
import {
  featureLevels,
  JOUST_SCHEDULE,
  joustRulesAt,
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

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 6 });
const loadCatalog = createCatalogIndexLoader(0);
const { joustQuestions, jousts, joustRatings, mailLetters, players, userProgress } = schema;
const RULES = joustRulesAt(JOUST_SCHEDULE, Date.now());
const LEVEL_XP = xpToReach(featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, Date.now()).jousts);
const SEED = "0123456789abcdef0123456789abcdef";

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

/** A member past the jousts' level, open to jousts, owning six words found at least once. */
async function jouster(options: { readonly access?: boolean; readonly xp?: number } = {}) {
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
    expect(await launch(closed, { kind: "friendly", opponentCode: a.code })).toEqual({
      kind: "refused",
      reason: "not_open",
    });
    expect(await launch(a, { kind: "friendly", opponentCode: b.code })).toEqual({
      kind: "refused",
      reason: "not_friends",
    });
    await befriend(a, closed);
    expect(await launch(a, { kind: "friendly", opponentCode: closed.code })).toEqual({
      kind: "refused",
      reason: "opponent_unavailable",
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
