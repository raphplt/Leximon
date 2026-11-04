import {
  challengeAnswerResponseSchema,
  dailyChallengeResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  practiceAnswerResponseSchema,
  preferencesSchema,
  reviewResponseSchema,
  reviewSummaryResponseSchema,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  bonusRulesAt,
  MASTERY_SCHEDULE,
  masteryRulesAt,
  newWordMastery,
  PRACTICE_SCHEDULE,
  practiceRulesAt,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, signInAsGuest } from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 1 });
const DAY = 86_400_000;
const rules = practiceRulesAt(PRACTICE_SCHEDULE, Date.now());

const WORDS = ["common", "uncommon", "rare", "precious", "epic", "legendary"].flatMap((rarity) =>
  [1, 2, 3].map((n) => `test-a-${rarity}-${n}`),
);

beforeAll(() => seedTestCatalog(db));
afterAll(close);

async function give(guest: Guest, cardIds: readonly string[], obtainedAt = Date.now()) {
  await db.insert(schema.userCards).values(
    cardIds.map((cardId, i) => ({
      userId: guest.userId,
      cardId,
      quantity: 1,
      firstObtainedAt: new Date(obtainedAt + i * 1_000),
    })),
  );
}

/**
 * A word reviewed `reviewedDaysAgo` days ago, due in `dueInDays` days (negative: overdue), at
 * `level`. `startedToday` marks it as one of the day's new words.
 */
async function reviewed(
  guest: Guest,
  cardId: string,
  options: { dueInDays: number; reviewedDaysAgo?: number; level?: "sketch" | "ink" },
) {
  const now = Date.now();
  const { memory } = newWordMastery(masteryRulesAt(MASTERY_SCHEDULE, now), now);
  await db.insert(schema.userMastery).values({
    userId: guest.userId,
    cardId,
    level: options.level ?? "sketch",
    due: new Date(now + options.dueInDays * DAY),
    stability: 3,
    difficulty: 5,
    scheduledDays: 3,
    learningSteps: memory.learningSteps,
    reps: 2,
    lapses: 0,
    state: 2,
    lastReviewedAt: new Date(now - (options.reviewedDaysAgo ?? 1) * DAY),
    startedAt: new Date(now - 30 * DAY),
  });
}

function request(
  guest: Guest,
  path: string,
  init?: { method: string; body: object },
  key?: string,
) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN, cookie: guest.cookie };
  if (init !== undefined) headers["content-type"] = "application/json";
  if (key !== undefined) headers[IDEMPOTENCY_KEY_HEADER] = key;
  return app.request(
    path,
    init === undefined
      ? { headers }
      : { method: init.method, headers, body: JSON.stringify(init.body) },
    env,
  );
}

async function summary(guest: Guest) {
  const response = await request(guest, "/challenges/review");
  expect(response.status).toBe(200);
  return reviewSummaryResponseSchema.parse(await response.json());
}

async function series(guest: Guest, body: object = {}) {
  const response = await request(guest, "/challenges/review", { method: "POST", body });
  expect(response.status).toBe(200);
  return reviewResponseSchema.parse(await response.json()).questions;
}

function answer(guest: Guest, cardId: string, chosenCardId: string) {
  return request(
    guest,
    "/challenges/answer",
    { method: "POST", body: { cardId, format: "definition", chosenCardId } },
    crypto.randomUUID(),
  );
}

function practise(guest: Guest, cardId: string, chosenCardId: string, key = crypto.randomUUID()) {
  return request(
    guest,
    "/challenges/practice/answer",
    { method: "POST", body: { cardId, chosenCardId, format: "word" } },
    key,
  );
}

describe("GET /challenges/review", () => {
  it("counts the words due, the new words of the day and the words ready to rise", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 8));
    await reviewed(guest, WORDS[0] as string, { dueInDays: -1 });
    await reviewed(guest, WORDS[1] as string, { dueInDays: -1, reviewedDaysAgo: 8 });
    await reviewed(guest, WORDS[2] as string, { dueInDays: 3, level: "ink" });

    const body = await summary(guest);
    expect(body).toMatchObject({ due: 2, fresh: 5, rising: 1, nextDueAt: null });
    expect(body.levels).toEqual({ blank: 5, sketch: 2, ink: 1, gilded: 0 });
    expect(body.settings).toMatchObject({ length: 10, newWordsPerDay: 10 });
    expect(body.scopes).toContainEqual({
      scope: { kind: "rising" },
      words: 1,
      due: 1,
      rising: 1,
      levels: { blank: 0, sketch: 1, ink: 0, gilded: 0 },
    });
    expect(body.scopes).toContainEqual(
      expect.objectContaining({ scope: { kind: "collection", id: "test-a" }, words: 8, due: 2 }),
    );
  });

  it("says when the next word comes back once nothing is due", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 1));
    await reviewed(guest, WORDS[0] as string, { dueInDays: 2 });
    const body = await summary(guest);
    expect(body.due).toBe(0);
    expect(body.nextDueAt).not.toBeNull();
    expect(Date.parse(body.nextDueAt ?? "")).toBeGreaterThan(Date.now() + DAY);
  });

  it("counts down the new words as the player starts them", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 12));
    await request(guest, "/me/preferences", { method: "PATCH", body: { newWordsPerDay: 5 } });
    expect((await summary(guest)).fresh).toBe(5);
    await answer(guest, WORDS[0] as string, WORDS[0] as string);
    await answer(guest, WORDS[1] as string, WORDS[2] as string);
    expect((await summary(guest)).fresh).toBe(3);
  });
});

describe("POST /challenges/review", () => {
  it("asks a new player the definition of their newest words, each with a retry", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 4));
    const questions = await series(guest);
    expect(questions.map((q) => q.cardId)).toEqual([...WORDS.slice(0, 4)].reverse());
    for (const question of questions) {
      expect(question).toMatchObject({ format: "definition", counted: true, fresh: true });
      expect(question.retry?.format).toBe("word");
      expect(question.retry?.choices).toContain(question.cardId);
    }
  });

  it("starts no more new words than the day allows, and practises the rest", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 12));
    await request(guest, "/me/preferences", { method: "PATCH", body: { newWordsPerDay: 5 } });
    const questions = await series(guest);
    expect(questions).toHaveLength(10);
    expect(questions.filter((q) => q.counted)).toHaveLength(5);
    expect(questions.filter((q) => !q.counted)).toHaveLength(5);
  });

  it("follows the length the player chose, or the one asked", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS);
    const saved = await request(guest, "/me/preferences", {
      method: "PATCH",
      body: { reviewLength: 5 },
    });
    expect(preferencesSchema.parse(await saved.json()).reviewLength).toBe(5);
    expect(await series(guest)).toHaveLength(5);
    expect(await series(guest, { length: rules.dailyChallengeLength })).toHaveLength(5);
    expect(await series(guest, { length: 20 })).toHaveLength(18);
  });

  it("refuses a length or a pace the rules do not offer", async () => {
    const guest = await signInAsGuest(app, env);
    const odd = await request(guest, "/me/preferences", {
      method: "PATCH",
      body: { reviewLength: 7 },
    });
    expect(odd.status).toBe(400);
    const fast = await request(guest, "/me/preferences", {
      method: "PATCH",
      body: { newWordsPerDay: 50 },
    });
    expect(fast.status).toBe(400);
  });

  it("asks the words ready to rise typed", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 6));
    await reviewed(guest, WORDS[0] as string, { dueInDays: -1, reviewedDaysAgo: 8 });
    const questions = await series(guest, { scope: { kind: "rising" } });
    expect(questions).toEqual([
      expect.objectContaining({ cardId: WORDS[0], format: "typed", counted: true, fresh: false }),
    ]);
  });

  it("opens with the word the player picked", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 6));
    await reviewed(guest, WORDS[3] as string, { dueInDays: 4 });
    const [first] = await series(guest, { first: WORDS[3] });
    expect(first).toMatchObject({ cardId: WORDS[3], counted: false });
  });

  it("keeps themes for players who reached their level", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 6));
    const response = await request(guest, "/challenges/review", {
      method: "POST",
      body: { scope: { kind: "theme", id: "cuisine" } },
    });
    expect(response.status).toBe(403);
  });
});

describe("free practice and the daily goal", () => {
  it("awards the daily bonus once when practice answers race to the goal", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 8));
    const goal = bonusRulesAt(BONUS_SCHEDULE, Date.now()).dailyGoal;
    const answers = await Promise.all(
      WORDS.slice(0, goal.answers + 2).map((cardId) => practise(guest, cardId, cardId)),
    );
    const bodies = await Promise.all(
      answers.map(async (response) => {
        expect(response.status).toBe(200);
        return practiceAnswerResponseSchema.parse(await response.json());
      }),
    );
    expect(bodies.reduce((sum, body) => sum + (body.bonus?.daily ?? 0), 0)).toBe(1);

    const awards = await db
      .select()
      .from(schema.boosterBonusAwards)
      .where(
        and(
          eq(schema.boosterBonusAwards.userId, guest.userId),
          eq(schema.boosterBonusAwards.kind, "daily"),
        ),
      );
    expect(awards).toHaveLength(1);
    const daily = dailyChallengeResponseSchema.parse(
      await (await request(guest, "/challenges/daily")).json(),
    );
    expect(daily).toMatchObject({ answers: goal.answers + 2, awarded: true });
  });

  it("records the word and how it was asked", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 1));
    const key = crypto.randomUUID();
    await practise(guest, WORDS[0] as string, WORDS[0] as string, key);
    const [row] = await db
      .select()
      .from(schema.practiceAnswers)
      .where(eq(schema.practiceAnswers.idempotencyKey, key));
    expect(row).toMatchObject({ cardId: WORDS[0], format: "word", correct: true });
  });

  it("replays an answer that earned the bonus without awarding it again", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 6));
    const goal = bonusRulesAt(BONUS_SCHEDULE, Date.now()).dailyGoal;
    for (const cardId of WORDS.slice(0, goal.answers - 1)) {
      await practise(guest, cardId, cardId);
    }
    const key = crypto.randomUUID();
    const first = practiceAnswerResponseSchema.parse(
      await (await practise(guest, WORDS[5] as string, WORDS[5] as string, key)).json(),
    );
    expect(first.bonus?.daily).toBe(1);
    const replay = practiceAnswerResponseSchema.parse(
      await (await practise(guest, WORDS[5] as string, WORDS[5] as string, key)).json(),
    );
    expect(replay.bonus?.daily).toBe(1);
    expect(replay.progress.xpGained).toBe(0);
  });
});

describe("a word met for the first time", () => {
  it("stays a blank page until it is answered right", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 2));
    const wrong = challengeAnswerResponseSchema.parse(
      await (await answer(guest, WORDS[0] as string, WORDS[1] as string)).json(),
    );
    expect(wrong).toMatchObject({ correct: false, level: "blank", levelUp: false });
    const right = challengeAnswerResponseSchema.parse(
      await (await answer(guest, WORDS[1] as string, WORDS[1] as string)).json(),
    );
    expect(right).toMatchObject({ correct: true, level: "sketch", levelUp: true });
    // Meeting a word earns the answer's XP, not a level's.
    expect(right.progress.xpGained).toBe(15);
  });
});
