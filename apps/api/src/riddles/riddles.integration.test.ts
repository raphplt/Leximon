import {
  IDEMPOTENCY_KEY_HEADER,
  publicRiddleSchema,
  riddleAnswerResponseSchema,
  riddleResponseSchema,
} from "@leximon/contract";
import {
  gameDayOf,
  RIDDLE_FIRST_DAY,
  RIDDLE_SCHEDULE,
  riddleLettersShown,
  riddleNumber,
  riddleRulesAt,
  XP_SCHEDULE,
  xpRulesAt,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, setXp, signInAsGuest } from "../test-support";
import { publicRiddle, todayRiddle } from "./riddles";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 1 });
const rules = riddleRulesAt(RIDDLE_SCHEDULE, Date.now());
const newWordXp = xpRulesAt(XP_SCHEDULE, Date.now()).newWord.common;

const CARD_ID = "riddle-ralingue";
const WORD = "ralingue";
const CLUES = {
  partOfSpeech: "n. f.",
  opening: "Cordage cousu en ourlet…",
  definition: "Cordage cousu en ourlet sur le pourtour d'une voile.",
  etymology: "Mot que l'on retrouve en italien.",
};
const today = () => gameDayOf(Date.now()).key;
const shownOf = (step: number) =>
  [...WORD].slice(0, riddleLettersShown(rules, [...WORD].length, step)).join("");
const number = () => riddleNumber(RIDDLE_FIRST_DAY, today());

beforeAll(async () => {
  await seedTestCatalog(db);
  await db
    .insert(schema.cards)
    .values({ id: CARD_ID, lemma: WORD, rarity: "common", collectionId: "test-hidden" })
    .onConflictDoNothing();
});
beforeEach(async () => {
  await db.delete(schema.riddlePlays);
  await db.delete(schema.dailyRiddles);
  await db.delete(schema.riddleWords);
  await db.insert(schema.riddleWords).values({ cardId: CARD_ID, clues: CLUES });
});
afterAll(async () => {
  await db.delete(schema.riddlePlays);
  await db.delete(schema.dailyRiddles);
  await db.delete(schema.riddleWords);
  await close();
});

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

function send(guest: Guest, guess: string | null, key: string = crypto.randomUUID()) {
  return request(guest, "/riddles/today/answer", { number: number(), guess }, key);
}

async function answer(guest: Guest, guess: string | null, key?: string) {
  const response = await send(guest, guess, key);
  expect(response.status).toBe(200);
  return riddleAnswerResponseSchema.parse(await response.json());
}

async function readToday(guest: Guest) {
  const response = await request(guest, "/riddles/today");
  expect(response.status).toBe(200);
  return riddleResponseSchema.parse(await response.json());
}

async function copies(guest: Guest): Promise<number | undefined> {
  const [row] = await db
    .select({ quantity: schema.userCards.quantity })
    .from(schema.userCards)
    .where(and(eq(schema.userCards.userId, guest.userId), eq(schema.userCards.cardId, CARD_ID)));
  return row?.quantity;
}

function publicPage(riddle: number) {
  return app.request(`/riddles/${riddle}`, { headers: { origin: TEST_ORIGIN } }, env);
}

describe("GET /riddles/today", () => {
  it("asks for a session", async () => {
    const response = await app.request("/riddles/today", { headers: { origin: TEST_ORIGIN } }, env);
    expect(response.status).toBe(401);
  });

  it("serves the same riddle to everyone, without its answer", async () => {
    const [first, second] = [await signInAsGuest(app, env), await signInAsGuest(app, env)];
    await db
      .insert(schema.cards)
      .values({
        id: "riddle-other",
        lemma: "mailloche",
        rarity: "common",
        collectionId: "test-hidden",
      })
      .onConflictDoNothing();
    await db.insert(schema.riddleWords).values({ cardId: "riddle-other", clues: CLUES });
    const seen = await readToday(first);
    expect(await readToday(second)).toEqual(seen);
    expect(seen).toMatchObject({
      number: number(),
      step: 0,
      lastStep: 6,
      outcome: null,
      answer: null,
      clues: { opening: null, definition: null, etymology: null },
      shownLetters: shownOf(0),
    });
    expect(JSON.stringify(seen)).not.toContain(WORD);
    expect(JSON.stringify(seen)).not.toContain("mailloche");
    const stored = await db.select().from(schema.dailyRiddles);
    expect(stored).toHaveLength(1);
    await db.delete(schema.dailyRiddles);
    await db.delete(schema.riddleWords).where(eq(schema.riddleWords.cardId, "riddle-other"));
  });

  it("never asks a word twice while others are left", async () => {
    await db
      .insert(schema.dailyRiddles)
      .values({ day: "2026-01-01", cardId: "test-a-common-1", clues: CLUES });
    await db.insert(schema.riddleWords).values({ cardId: "test-a-common-1", clues: CLUES });
    await readToday(await signInAsGuest(app, env));
    const [picked] = await db
      .select({ cardId: schema.dailyRiddles.cardId })
      .from(schema.dailyRiddles)
      .where(eq(schema.dailyRiddles.day, today()));
    expect(picked?.cardId).toBe(CARD_ID);
  });

  it("leaves a retired word out", async () => {
    await db
      .update(schema.cards)
      .set({ retiredAt: new Date() })
      .where(eq(schema.cards.id, CARD_ID));
    const guest = await signInAsGuest(app, env);
    const response = await request(guest, "/riddles/today");
    await db.update(schema.cards).set({ retiredAt: null }).where(eq(schema.cards.id, CARD_ID));
    expect(response.status).toBe(404);
  });
});

function chooseTodaysWord() {
  return db.insert(schema.dailyRiddles).values({ day: today(), cardId: CARD_ID, clues: CLUES });
}

describe("POST /riddles/today/answer", () => {
  beforeEach(chooseTodaysWord);

  it("uncovers the next clue on a wrong answer, and gives nothing", async () => {
    const guest = await signInAsGuest(app, env);
    const { riddle, progress } = await answer(guest, "voile");
    expect(riddle).toMatchObject({ step: 1, outcome: null, answer: null, xp: 0 });
    expect(riddle.clues).toEqual({
      opening: CLUES.opening,
      definition: null,
      etymology: null,
    });
    expect(progress.xpGained).toBe(0);
  });

  it("uncovers it the same when the player asks", async () => {
    const guest = await signInAsGuest(app, env);
    expect((await answer(guest, null)).riddle.step).toBe(1);
    expect((await answer(guest, null)).riddle.step).toBe(2);
  });

  it("does not charge a step twice for a retried answer", async () => {
    const guest = await signInAsGuest(app, env);
    const key = crypto.randomUUID();
    await answer(guest, "voile", key);
    expect((await answer(guest, "voile", key)).riddle.step).toBe(1);
    expect((await readToday(guest)).step).toBe(1);
  });

  it("shows the first letter from the day the rules gave more letters", async () => {
    const riddle = await todayRiddle(db, {
      userId: "player-without-a-game",
      now: Date.UTC(2026, 10, 1, 12),
      seed: "0".repeat(32),
    });
    expect(riddle?.shownLetters).toBe([...WORD][0]);
  });

  it("gives letters after the clues", async () => {
    const guest = await signInAsGuest(app, env);
    for (let i = 0; i < 5; i++) await answer(guest, null);
    expect((await readToday(guest)).shownLetters).toBe(shownOf(5));
  });

  it("gives the XP and the card to a player who finds a new word", async () => {
    const guest = await signInAsGuest(app, env);
    await answer(guest, "voile");
    const { riddle, progress } = await answer(guest, "Ralingue");
    expect(riddle).toMatchObject({
      step: 1,
      outcome: "found",
      answer: { cardId: CARD_ID, word: WORD },
      xp: rules.xp + newWordXp,
      cardGiven: true,
    });
    expect(riddle.clues.etymology).toBe(CLUES.etymology);
    expect(progress.xpGained).toBe(rules.xp + newWordXp);
    expect(await copies(guest)).toBe(1);
    expect((await readToday(guest)).outcome).toBe("found");
  });

  it("forgives a slip on a long enough word", async () => {
    const guest = await signInAsGuest(app, env);
    expect((await answer(guest, "ralingeu")).riddle.outcome).toBe("found");
  });

  it("gives only the XP to a player who owns the card", async () => {
    const guest = await signInAsGuest(app, env);
    await db
      .insert(schema.userCards)
      .values({ userId: guest.userId, cardId: CARD_ID, quantity: 2 });
    const { riddle, progress } = await answer(guest, WORD);
    expect(riddle).toMatchObject({ xp: rules.xp, cardGiven: false });
    expect(progress.xpGained).toBe(rules.xp);
    expect(await copies(guest)).toBe(2);
  });

  it("gives the card back to a player who traded it, without the new word's XP", async () => {
    const guest = await signInAsGuest(app, env);
    await db
      .insert(schema.userCards)
      .values({ userId: guest.userId, cardId: CARD_ID, quantity: 0 });
    const { riddle } = await answer(guest, WORD);
    expect(riddle).toMatchObject({ xp: rules.xp, cardGiven: true });
    expect(await copies(guest)).toBe(1);
  });

  it("ends on the seventh wrong answer, with nothing earned", async () => {
    const guest = await signInAsGuest(app, env);
    for (let i = 0; i < 6; i++) {
      expect((await answer(guest, "voile")).riddle.outcome).toBeNull();
    }
    const { riddle, progress } = await answer(guest, "voile");
    expect(riddle).toMatchObject({
      step: 6,
      outcome: "lost",
      answer: { cardId: CARD_ID, word: WORD },
      xp: 0,
      cardGiven: false,
    });
    expect(progress.xpGained).toBe(0);
    expect(await copies(guest)).toBeUndefined();
  });

  it("changes nothing once the game is over", async () => {
    const guest = await signInAsGuest(app, env);
    await answer(guest, WORD);
    const again = await answer(guest, WORD);
    expect(again.progress.xpGained).toBe(0);
    expect(again.riddle.outcome).toBe("found");
    expect(await copies(guest)).toBe(1);
  });

  it("rewards once when answers race, each counted", async () => {
    const guest = await signInAsGuest(app, env);
    const responses = await Promise.all(Array.from({ length: 6 }, () => send(guest, WORD)));
    const bodies = await Promise.all(responses.map((response) => response.json()));
    const gains = bodies.map((body) => riddleAnswerResponseSchema.parse(body).progress.xpGained);
    expect(gains.reduce((sum, gained) => sum + gained, 0)).toBe(rules.xp + newWordXp);
    expect(await copies(guest)).toBe(1);
  });

  it("charges every wrong answer when they race", async () => {
    const guest = await signInAsGuest(app, env);
    await Promise.all(Array.from({ length: 4 }, () => send(guest, "voile")));
    expect((await readToday(guest)).step).toBe(4);
  });

  it("raises the level like any other XP", async () => {
    const guest = await signInAsGuest(app, env);
    await setXp(db, guest.userId, 149);
    expect((await answer(guest, WORD)).progress.levelUp).toBe(true);
  });

  it("refuses an answer to another day's riddle", async () => {
    const guest = await signInAsGuest(app, env);
    await readToday(guest);
    const response = await request(
      guest,
      "/riddles/today/answer",
      { number: number() + 1, guess: WORD },
      crypto.randomUUID(),
    );
    expect(response.status).toBe(409);
  });

  it("asks for an idempotency key", async () => {
    const guest = await signInAsGuest(app, env);
    const response = await request(guest, "/riddles/today/answer", {
      number: number(),
      guess: WORD,
    });
    expect(response.status).toBe(400);
  });
});

describe("GET /riddles/:number", () => {
  beforeEach(chooseTodaysWord);

  it("counts today's finished games, without the answer", async () => {
    const [winner, loser, playing] = [
      await signInAsGuest(app, env),
      await signInAsGuest(app, env),
      await signInAsGuest(app, env),
    ];
    await answer(winner, WORD);
    for (let i = 0; i < 7; i++) await answer(loser, "voile");
    await answer(playing, "voile");
    const response = await publicPage(number());
    expect(response.status).toBe(200);
    expect(publicRiddleSchema.parse(await response.json())).toEqual({
      number: number(),
      day: today(),
      isToday: true,
      played: 2,
      found: 1,
      answer: null,
    });
  });

  it("gives a past riddle's answer", async () => {
    const tomorrow = Date.now() + 86_400_000;
    const riddle = await publicRiddle(db, {
      number: number(),
      now: tomorrow,
      seed: "0".repeat(32),
    });
    expect(riddle?.answer).toEqual({ cardId: CARD_ID, word: WORD });
  });

  it("knows nothing of a riddle to come", async () => {
    expect((await publicPage(number() + 1)).status).toBe(404);
  });

  it("refuses a number that is none", async () => {
    expect((await publicPage(0)).status).toBe(404);
  });
});
