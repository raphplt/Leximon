import {
  challengeAnswerResponseSchema,
  challengesResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  masteryResponseSchema,
} from "@leximon/contract";
import { gameDayOf, MASTERY_SCHEDULE, masteryRulesAt, newWordMastery } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, count, eq, type Logger } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, signInAsGuest } from "../test-support";
import { answerChallenge } from "./challenges";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 1 });
const DAY = 86_400_000;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

async function give(guest: Guest, ...cardIds: string[]) {
  await db
    .insert(schema.userCards)
    .values(cardIds.map((cardId) => ({ userId: guest.userId, cardId, quantity: 1 })));
}

function get(guest: Guest | null, path: string) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN };
  if (guest !== null) headers["cookie"] = guest.cookie;
  return app.request(path, { headers }, env);
}

function answer(guest: Guest, cardId: string, chosenCardId: string, key = crypto.randomUUID()) {
  return app.request(
    "/challenges/answer",
    {
      method: "POST",
      headers: {
        origin: TEST_ORIGIN,
        cookie: guest.cookie,
        "content-type": "application/json",
        [IDEMPOTENCY_KEY_HEADER]: key,
      },
      body: JSON.stringify({ cardId, format: "definition", chosenCardId }),
    },
    env,
  );
}

async function questions(guest: Guest) {
  const response = await get(guest, "/challenges");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return challengesResponseSchema.parse(await response.json());
}

async function logCount(guest: Guest, cardId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(schema.reviewLogs)
    .where(and(eq(schema.reviewLogs.userId, guest.userId), eq(schema.reviewLogs.cardId, cardId)));
  return row?.total ?? 0;
}

describe("GET /challenges", () => {
  it("requires a session", async () => {
    expect((await get(null, "/challenges")).status).toBe(401);
  });

  it("has nothing for a player without cards", async () => {
    const guest = await signInAsGuest(app, env);
    expect(await questions(guest)).toEqual({ questions: [], nextDueAt: null });
  });

  it("asks about owned words, with four choices from the catalog", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1", "test-a-rare-2", "test-b-epic-3");
    const body = await questions(guest);

    expect(body.questions.map((q) => q.cardId).sort()).toEqual([
      "test-a-common-1",
      "test-a-rare-2",
      "test-b-epic-3",
    ]);
    for (const question of body.questions) {
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices).toContain(question.cardId);
      // Wrong choices come from the same collection when it has enough cards.
      const collection = question.cardId.slice(0, "test-a".length);
      expect(question.choices.every((id) => id.startsWith(collection))).toBe(true);
    }
  });

  it("limits the session size", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1", "test-a-common-2", "test-a-common-3");
    expect((await questions(guest)).questions).toHaveLength(3);
    const limited = challengesResponseSchema.parse(
      await (await get(guest, "/challenges?limit=2")).json(),
    );
    expect(limited.questions).toHaveLength(2);
    expect((await get(guest, "/challenges?limit=50")).status).toBe(400);
  });
});

describe("POST /challenges/answer", () => {
  it("records a right answer and schedules the word later", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1");
    const before = Date.now();
    const response = await answer(guest, "test-a-common-1", "test-a-common-1");

    expect(response.status).toBe(200);
    const body = challengeAnswerResponseSchema.parse(await response.json());
    expect(body).toMatchObject({ correct: true, level: "sketch", levelUp: false });
    expect(Date.parse(body.nextReviewAt)).toBeGreaterThanOrEqual(before + DAY);

    const after = await questions(guest);
    expect(after.questions).toEqual([]);
    expect(after.nextDueAt).toBe(body.nextReviewAt);
    expect(await logCount(guest, "test-a-common-1")).toBe(1);
  });

  it("records a wrong answer", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1");
    const body = challengeAnswerResponseSchema.parse(
      await (await answer(guest, "test-a-common-1", "test-a-common-2")).json(),
    );
    expect(body.correct).toBe(false);
  });

  it("refuses a word that is not due, and replays the same key", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1");
    const key = crypto.randomUUID();
    const first = challengeAnswerResponseSchema.parse(
      await (await answer(guest, "test-a-common-1", "test-a-common-1", key)).json(),
    );
    expect(first.progress).toMatchObject({ xp: 15, xpGained: 15 });

    const replay = await answer(guest, "test-a-common-1", "test-a-common-2", key);
    expect(replay.status).toBe(200);
    // The same answer, and the XP counted once: a retry shows the total without a new gain.
    expect(challengeAnswerResponseSchema.parse(await replay.json())).toEqual({
      ...first,
      progress: { ...first.progress, xpGained: 0, levelUp: false },
    });

    const again = await answer(guest, "test-a-common-1", "test-a-common-1");
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "challenge_not_due" });
    expect(await logCount(guest, "test-a-common-1")).toBe(1);
  });

  it("brings a word back once due, before words never reviewed", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1", "test-a-common-2");
    await answer(guest, "test-a-common-1", "test-a-common-1");
    await db
      .update(schema.userMastery)
      .set({ due: new Date(Date.now() - 1_000) })
      .where(eq(schema.userMastery.userId, guest.userId));

    const body = await questions(guest);
    expect(body.questions.map((q) => q.cardId)).toEqual(["test-a-common-1", "test-a-common-2"]);
    expect((await answer(guest, "test-a-common-1", "test-a-common-1")).status).toBe(200);
  });

  it("refuses a word the player does not own", async () => {
    const guest = await signInAsGuest(app, env);
    const response = await answer(guest, "test-a-common-1", "test-a-common-1");
    expect(response.status).toBe(404);
    const [row] = await db
      .select({ total: count() })
      .from(schema.userMastery)
      .where(eq(schema.userMastery.userId, guest.userId));
    expect(row?.total).toBe(0);
  });

  it.each([
    ["no idempotency key", {}, { cardId: "test-a-common-1", format: "word", chosenCardId: "x" }],
    [
      "unknown format",
      { key: true },
      { cardId: "test-a-common-1", format: "x", chosenCardId: "x" },
    ],
  ])("rejects an invalid request: %s", async (_label, options, body) => {
    const guest = await signInAsGuest(app, env);
    const headers: Record<string, string> = {
      origin: TEST_ORIGIN,
      cookie: guest.cookie,
      "content-type": "application/json",
    };
    if ("key" in options) headers[IDEMPOTENCY_KEY_HEADER] = crypto.randomUUID();
    const response = await app.request(
      "/challenges/answer",
      { method: "POST", headers, body: JSON.stringify(body) },
      env,
    );
    expect(response.status).toBe(400);
  });

  it("applies one of several concurrent answers on the same word", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1");
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => answer(guest, "test-a-common-1", "test-a-common-1")),
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409, 409]);
    expect(await logCount(guest, "test-a-common-1")).toBe(1);
  });

  it("applies a retried answer once when the copies race", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1");
    const key = crypto.randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => answer(guest, "test-a-common-1", "test-a-common-1", key)),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(await logCount(guest, "test-a-common-1")).toBe(1);
  });
});

describe("GET /me/mastery", () => {
  it("lists the level of reviewed words only", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-common-1", "test-a-common-2");
    await answer(guest, "test-a-common-1", "test-a-common-1");
    const response = await get(guest, "/me/mastery");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(masteryResponseSchema.parse(await response.json())).toEqual({
      words: [{ cardId: "test-a-common-1", level: "sketch" }],
    });
    expect((await get(null, "/me/mastery")).status).toBe(401);
  });
});

describe("bonus boosters", () => {
  const WORDS = [1, 2, 3].flatMap((n) => [
    `test-a-common-${n}`,
    `test-a-uncommon-${n}`,
    `test-a-rare-${n}`,
  ]);
  const NO_BONUS = { daily: 0, gilded: 0, credited: 0 };

  /** Answers a word right or wrong; the wrong choice is a card of another collection. */
  async function reply(guest: Guest, cardId: string, correct: boolean, key?: string) {
    const response = await answer(guest, cardId, correct ? cardId : "test-b-common-1", key);
    expect(response.status).toBe(200);
    return challengeAnswerResponseSchema.parse(await response.json());
  }

  async function reserve(guest: Guest) {
    const [row] = await db
      .select({ bonus: schema.boosterWallets.bonusBoosters })
      .from(schema.boosterWallets)
      .where(eq(schema.boosterWallets.userId, guest.userId));
    return row?.bonus ?? 0;
  }

  function awards(guest: Guest) {
    return db
      .select({
        kind: schema.boosterBonusAwards.kind,
        awardKey: schema.boosterBonusAwards.awardKey,
        amount: schema.boosterBonusAwards.amount,
        credited: schema.boosterBonusAwards.credited,
      })
      .from(schema.boosterBonusAwards)
      .where(eq(schema.boosterBonusAwards.userId, guest.userId));
  }

  it("awards the daily bonus at the 5th answer of the day with 3 right, once", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, ...WORDS.slice(0, 6));
    const pattern = [true, false, true, false];
    for (const [index, correct] of pattern.entries()) {
      const body = await reply(guest, WORDS[index] as string, correct);
      expect(body.bonus).toEqual({ ...NO_BONUS, reserve: 0 });
    }

    const fifth = await reply(guest, WORDS[4] as string, true);
    expect(fifth.bonus).toEqual({ daily: 1, gilded: 0, credited: 1, reserve: 1 });

    const sixth = await reply(guest, WORDS[5] as string, true);
    expect(sixth.bonus).toEqual({ ...NO_BONUS, reserve: 1 });
    expect(await reserve(guest)).toBe(1);
    expect(await awards(guest)).toEqual([
      { kind: "daily", awardKey: gameDayOf(Date.now()).key, amount: 1, credited: 1 },
    ]);
  });

  it("waits for the 3rd right answer", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, ...WORDS.slice(0, 6));
    for (const [index, correct] of [true, true, false, false, false].entries()) {
      expect((await reply(guest, WORDS[index] as string, correct)).bonus.daily).toBe(0);
    }
    expect((await reply(guest, WORDS[5] as string, true)).bonus.daily).toBe(1);
    expect(await reserve(guest)).toBe(1);
  });

  it("awards the daily bonus once when answers race", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, ...WORDS);
    const responses = await Promise.all(WORDS.map((cardId) => answer(guest, cardId, cardId)));
    expect(responses.map((response) => response.status)).toEqual(WORDS.map(() => 200));
    const bodies = await Promise.all(
      responses.map(async (response) => challengeAnswerResponseSchema.parse(await response.json())),
    );

    expect(bodies.filter((body) => body.bonus.daily === 1)).toHaveLength(1);
    expect(bodies.reduce((sum, body) => sum + body.bonus.daily, 0)).toBe(1);
    expect(await reserve(guest)).toBe(1);
    expect(await awards(guest)).toHaveLength(1);
  });

  it("awards a bonus when a card reaches the gilded level", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, "test-a-epic-1");
    // A word reviewed three times, last seen 20 days ago with a 20-day memory: a right answer
    // now takes its stability past the gilded threshold (30 days).
    const now = Date.now();
    const { memory } = newWordMastery(now);
    await db.insert(schema.userMastery).values({
      userId: guest.userId,
      cardId: "test-a-epic-1",
      level: "ink",
      due: new Date(now - 1_000),
      stability: 20,
      difficulty: 5,
      scheduledDays: 20,
      learningSteps: memory.learningSteps,
      reps: 3,
      lapses: 0,
      state: 2,
      lastReviewedAt: new Date(now - 20 * DAY),
    });
    expect(masteryRulesAt(MASTERY_SCHEDULE, now).levelThresholdDays.gilded).toBe(30);

    const body = await reply(guest, "test-a-epic-1", true);
    expect(body).toMatchObject({ level: "gilded", levelUp: true });
    expect(body.bonus).toEqual({ daily: 0, gilded: 1, credited: 1, reserve: 1 });
    expect(await awards(guest)).toEqual([
      { kind: "gilded", awardKey: "test-a-epic-1", amount: 1, credited: 1 },
    ]);
  });

  it("caps the reserve at 10 and records the bonus lost", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, ...WORDS.slice(0, 5));
    await db.insert(schema.boosterWallets).values({
      userId: guest.userId,
      stored: 6,
      progressMs: 0,
      asOf: new Date(),
      bonusBoosters: 10,
    });
    for (const cardId of WORDS.slice(0, 4)) await reply(guest, cardId, true);

    const fifth = await reply(guest, WORDS[4] as string, true);
    expect(fifth.bonus).toEqual({ daily: 1, gilded: 0, credited: 0, reserve: 10 });
    expect(await reserve(guest)).toBe(10);
    expect(await awards(guest)).toEqual([
      { kind: "daily", awardKey: gameDayOf(Date.now()).key, amount: 1, credited: 0 },
    ]);
  });

  it("replays the answer that earned a bonus without awarding it twice", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, ...WORDS.slice(0, 5));
    for (const cardId of WORDS.slice(0, 4)) await reply(guest, cardId, true);
    const key = crypto.randomUUID();
    const first = await reply(guest, WORDS[4] as string, true, key);
    expect(first.bonus.daily).toBe(1);

    const replays = await Promise.all(
      [1, 2, 3].map(() => reply(guest, WORDS[4] as string, true, key)),
    );
    for (const replay of replays) {
      expect(replay).toEqual({ ...first, progress: { ...first.progress, xpGained: 0 } });
    }
    expect(await reserve(guest)).toBe(1);
    expect(await awards(guest)).toHaveLength(1);
  });
});

describe("answer latency budget", () => {
  it("uses five statements per answer: BEGIN, wallet, mastery and lookups, write, COMMIT", async () => {
    const queries: string[] = [];
    const logger: Logger = { logQuery: (query) => queries.push(query) };
    const counted = createDb(url, { maxConnections: 1, logger });
    const userId = `budget-${crypto.randomUUID()}`;
    await db
      .insert(schema.users)
      .values({ id: userId, name: "Budget", email: `${userId}@test.invalid` });
    await db.insert(schema.userCards).values({ userId, cardId: "test-a-common-1", quantity: 1 });
    try {
      const result = await answerChallenge(counted.db, {
        userId,
        idempotencyKey: crypto.randomUUID(),
        cardId: "test-a-common-1",
        format: "definition",
        chosenCardId: "test-a-common-1",
        now: Date.now(),
      });
      expect(result.kind).toBe("answered");
      // Each statement is one round trip to the database. Raising this number slows every answer.
      expect(queries).toHaveLength(5);
    } finally {
      await counted.close();
    }
  });
});
