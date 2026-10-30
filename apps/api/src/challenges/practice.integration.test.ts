import {
  dailyChallengeResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  practiceAnswerResponseSchema,
  practiceResponseSchema,
  practiceSummaryResponseSchema,
} from "@leximon/contract";
import { newWordMastery, PRACTICE_SCHEDULE, practiceRulesAt } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, count, eq } from "drizzle-orm";
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

beforeAll(async () => {
  await seedTestCatalog(db);
  await db.insert(schema.themes).values({ id: "cuisine", name: "Cuisine" }).onConflictDoNothing();
  await db
    .insert(schema.cardThemes)
    .values(WORDS.slice(0, 5).map((cardId) => ({ cardId, themeId: "cuisine" })))
    .onConflictDoNothing();
});
afterAll(close);

async function give(guest: Guest, cardIds: readonly string[]) {
  await db
    .insert(schema.userCards)
    .values(cardIds.map((cardId) => ({ userId: guest.userId, cardId, quantity: 1 })));
}

/** A word reviewed recently, not due before `dueInDays`. */
async function seenWord(guest: Guest, cardId: string, dueInDays: number) {
  const now = Date.now();
  const { memory } = newWordMastery(now);
  await db.insert(schema.userMastery).values({
    userId: guest.userId,
    cardId,
    level: "sketch",
    due: new Date(now + dueInDays * DAY),
    stability: 3,
    difficulty: 5,
    scheduledDays: 3,
    learningSteps: memory.learningSteps,
    reps: 2,
    lapses: 0,
    state: 2,
    lastReviewedAt: new Date(now - DAY),
  });
}

function request(guest: Guest, path: string, body?: object, key?: string) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN, cookie: guest.cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key !== undefined) headers[IDEMPOTENCY_KEY_HEADER] = key;
  return app.request(
    path,
    body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) },
    env,
  );
}

function start(guest: Guest, scope: object) {
  return request(guest, "/challenges/practice", { scope });
}

async function series(guest: Guest, scope: object) {
  const response = await start(guest, scope);
  expect(response.status).toBe(200);
  return practiceResponseSchema.parse(await response.json()).questions;
}

function practise(guest: Guest, cardId: string, chosenCardId: string, key = crypto.randomUUID()) {
  return request(guest, "/challenges/practice/answer", { cardId, chosenCardId }, key);
}

async function grantLevel3(guest: Guest) {
  await db.insert(schema.userProgress).values({ userId: guest.userId, xp: 1_000 });
}

describe("GET /challenges/practice", () => {
  it("lists the scopes large enough, with the words that count", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 5));
    await seenWord(guest, WORDS[0] as string, 5);
    const response = await request(guest, "/challenges/practice");
    expect(response.status).toBe(200);
    const summary = practiceSummaryResponseSchema.parse(await response.json());
    expect(summary.scopes).toContainEqual({
      scope: { kind: "collection", id: "test-a" },
      words: 5,
      due: 4,
    });
    expect(summary.scopes).toContainEqual({ scope: { kind: "recent" }, words: 5, due: 4 });
    expect(summary.scopes).toContainEqual({
      scope: { kind: "theme", id: "cuisine" },
      words: 5,
      due: 4,
    });
    expect(summary.scopes.some(({ scope }) => scope.kind === "missed")).toBe(false);
    expect(summary.xp).toEqual({ today: 0, cap: rules.dailyXpCap });
  });
});

describe("POST /challenges/practice", () => {
  it("puts the words that count first, and marks the others as free practice", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 6));
    for (const cardId of WORDS.slice(0, 4)) await seenWord(guest, cardId, 5);
    const questions = await series(guest, { kind: "collection", id: "test-a" });
    expect(questions).toHaveLength(6);
    expect(questions.map((q) => q.counted)).toEqual([true, true, false, false, false, false]);
    expect(new Set(questions.slice(0, 2).map((q) => q.cardId))).toEqual(new Set(WORDS.slice(4, 6)));
    expect(questions.every((q) => q.format !== "typed")).toBe(true);
  });

  it("stops at the size of a series", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS);
    for (const cardId of WORDS) await seenWord(guest, cardId, 5);
    expect(await series(guest, { kind: "collection", id: "test-a" })).toHaveLength(
      rules.seriesSize,
    );
  });

  it("refuses a scope of fewer than four owned words", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 3));
    const response = await start(guest, { kind: "collection", id: "test-a" });
    expect(response.status).toBe(422);
  });

  it("only draws from owned words, whatever list the client sends", async () => {
    const guest = await signInAsGuest(app, env);
    await grantLevel3(guest);
    await give(guest, WORDS.slice(0, 4));
    const questions = await series(guest, { kind: "cards", cardIds: WORDS.slice(0, 12) });
    expect(new Set(questions.map((q) => q.cardId))).toEqual(new Set(WORDS.slice(0, 4)));
  });

  it("opens themes and album lists at their level, and says which", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 5));
    const response = await start(guest, { kind: "theme", id: "cuisine" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "level_required", level: 3 });
    await grantLevel3(guest);
    expect(await series(guest, { kind: "theme", id: "cuisine" })).toHaveLength(5);
  });

  it("finds the words missed lately, not the older ones", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 6));
    const log = (cardId: string, daysAgo: number, correct: boolean) =>
      db.insert(schema.reviewLogs).values({
        id: crypto.randomUUID(),
        userId: guest.userId,
        cardId,
        challengeId: crypto.randomUUID(),
        format: "definition",
        correct,
        rating: correct ? 3 : 1,
        levelAfter: "sketch",
        reviewedAt: new Date(Date.now() - daysAgo * DAY),
      });
    for (const cardId of WORDS.slice(0, 4)) await log(cardId, 2, false);
    await log(WORDS[4] as string, 2, true);
    await log(WORDS[5] as string, 45, false);
    const questions = await series(guest, { kind: "missed" });
    expect(new Set(questions.map((q) => q.cardId))).toEqual(new Set(WORDS.slice(0, 4)));
  });
});

describe("POST /challenges/practice/answer", () => {
  it("gives XP and leaves the memory, the journal and the daily goal alone", async () => {
    const guest = await signInAsGuest(app, env);
    const [cardId] = WORDS as [string, ...string[]];
    await give(guest, [cardId]);
    await seenWord(guest, cardId, 5);
    const [before] = await db
      .select()
      .from(schema.userMastery)
      .where(eq(schema.userMastery.userId, guest.userId));

    const response = await practise(guest, cardId, cardId);
    expect(response.status).toBe(200);
    const body = practiceAnswerResponseSchema.parse(await response.json());
    expect(body.correct).toBe(true);
    expect(body.progress.xpGained).toBe(rules.xpPerAnswer);
    expect(body.xpToday).toBe(rules.xpPerAnswer);

    const [after] = await db
      .select()
      .from(schema.userMastery)
      .where(eq(schema.userMastery.userId, guest.userId));
    expect(after).toEqual(before);
    const [logs] = await db
      .select({ total: count() })
      .from(schema.reviewLogs)
      .where(eq(schema.reviewLogs.userId, guest.userId));
    expect(logs?.total).toBe(0);
    const daily = dailyChallengeResponseSchema.parse(
      await (await request(guest, "/challenges/daily")).json(),
    );
    expect(daily.answers).toBe(0);
  });

  it("gives nothing for a wrong answer", async () => {
    const guest = await signInAsGuest(app, env);
    await give(guest, WORDS.slice(0, 2));
    const response = await practise(guest, WORDS[0] as string, WORDS[1] as string);
    const body = practiceAnswerResponseSchema.parse(await response.json());
    expect(body.correct).toBe(false);
    expect(body.progress.xpGained).toBe(0);
  });

  it("applies an answer sent twice once", async () => {
    const guest = await signInAsGuest(app, env);
    const [cardId] = WORDS as [string, ...string[]];
    await give(guest, [cardId]);
    const key = crypto.randomUUID();
    await practise(guest, cardId, cardId, key);
    const again = practiceAnswerResponseSchema.parse(
      await (await practise(guest, cardId, cardId, key)).json(),
    );
    expect(again.correct).toBe(true);
    expect(again.progress.xpGained).toBe(0);
    expect(again.progress.xp).toBe(rules.xpPerAnswer);
  });

  it("refuses a word the player does not own", async () => {
    const guest = await signInAsGuest(app, env);
    const response = await practise(guest, WORDS[0] as string, WORDS[0] as string);
    expect(response.status).toBe(404);
  });

  it("holds the daily cap when answers race", async () => {
    const guest = await signInAsGuest(app, env);
    const [cardId] = WORDS as [string, ...string[]];
    await give(guest, [cardId]);
    // One answer short of the cap: of the racing answers, only one can still earn XP.
    await db.insert(schema.practiceAnswers).values({
      userId: guest.userId,
      idempotencyKey: crypto.randomUUID(),
      correct: true,
      xp: rules.dailyXpCap - rules.xpPerAnswer,
      answeredAt: new Date(),
    });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => practise(guest, cardId, cardId)),
    );
    const bodies = await Promise.all(responses.map((response) => response.json()));
    const gains = bodies.map((body) => practiceAnswerResponseSchema.parse(body).progress.xpGained);
    expect(gains.reduce((sum, gained) => sum + gained, 0)).toBe(rules.xpPerAnswer);
    const [row] = await db
      .select({ total: count() })
      .from(schema.practiceAnswers)
      .where(and(eq(schema.practiceAnswers.userId, guest.userId)));
    expect(row?.total).toBe(9);
  });

  it("counts yesterday's XP for nothing", async () => {
    const guest = await signInAsGuest(app, env);
    const [cardId] = WORDS as [string, ...string[]];
    await give(guest, [cardId]);
    await db.insert(schema.practiceAnswers).values({
      userId: guest.userId,
      idempotencyKey: crypto.randomUUID(),
      correct: true,
      xp: rules.dailyXpCap,
      answeredAt: new Date(Date.now() - 2 * DAY),
    });
    const body = practiceAnswerResponseSchema.parse(
      await (await practise(guest, cardId, cardId)).json(),
    );
    expect(body.progress.xpGained).toBe(rules.xpPerAnswer);
  });
});
