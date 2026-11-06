/**
 * `pnpm dev:bots <email> [--challenge]`: opens the jousts to an account and gives it bots to joust
 * against, then plays the bots' turns until stopped (Ctrl+C).
 *
 * The bots are friends of the account and come by every minute, so they answer a friendly joust as
 * well as a ranked one. Each answers at its own pace and finds the right word as often as its
 * skill says. With --challenge, each bot launches a friendly joust and plays its run first.
 *
 * Local database only: it refuses any other host.
 */

import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import {
  featureLevels,
  levelOf,
  pseudoKey,
  TRADE_SCHEDULE,
  UNLOCK_SCHEDULE,
  xpToReach,
} from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { generateSeed } from "../src/boosters/seed";
import { createCatalogIndexLoader } from "../src/challenges/catalog-index";
import { answerQuestion, launchJoust, nextQuestion, settleJoust } from "../src/jousts/jousts";

const {
  cards,
  friendships,
  joustQuestions,
  jousts,
  players,
  userCards,
  userMastery,
  userProgress,
  users,
} = schema;

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const BOT_LEVEL = 12;
const BOT_CARDS = 24;
const POLL_MS = 3_000;
const SEEN_EVERY_MS = 60_000;

interface Bot {
  readonly id: string;
  readonly pseudo: string;
  readonly code: string;
  /** Share of questions it gets right. */
  readonly skill: number;
  /** Seconds it takes to answer, at least and at most. */
  readonly thinks: readonly [number, number];
}

const BOTS: readonly Bot[] = [
  { id: "dev-bot-1", pseudo: "Bot Étourdi", code: "B0T00001", skill: 0.4, thinks: [4, 12] },
  { id: "dev-bot-2", pseudo: "Bot Lettré", code: "B0T00002", skill: 0.7, thinks: [3, 9] },
  { id: "dev-bot-3", pseudo: "Bot Érudit", code: "B0T00003", skill: 0.9, thinks: [2, 6] },
  { id: "dev-bot-4", pseudo: "Bot Éclair", code: "B0T00004", skill: 0.75, thinks: [1, 3] },
];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { challenge: { type: "boolean", default: false } },
});
const email = positionals[0]?.trim().toLowerCase();
if (email === undefined || !email.includes("@")) {
  console.error("Usage : pnpm dev:bots <email> [--challenge]");
  process.exit(1);
}

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
}
if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
  throw new Error("dev:bots only runs against a local database.");
}

const { db, close } = createDb(url, { maxConnections: 4 });
const loadCatalogIndex = createCatalogIndexLoader();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens the jousts to the account and raises it to their level. `null` when it cannot joust. */
async function prepareAccount(): Promise<{ id: string; code: string } | null> {
  const [account] = await db
    .select({ id: users.id, code: players.code, pseudo: players.pseudo })
    .from(users)
    .leftJoin(players, eq(players.userId, users.id))
    .where(and(eq(users.email, email as string), eq(users.isAnonymous, false)));
  if (account === undefined || account.code === null) {
    console.error(`Aucun compte pour ${email}. Connecte-toi d'abord une fois avec cette adresse.`);
    return null;
  }
  if (account.pseudo === null) {
    console.error(`${email} n'a pas de pseudo. Choisis-en un sur le site, puis relance.`);
    return null;
  }
  await db.update(players).set({ joustAccess: true }).where(eq(players.userId, account.id));
  const opensAt = featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, Date.now()).jousts;
  const [progress] = await db
    .select({ xp: userProgress.xp })
    .from(userProgress)
    .where(eq(userProgress.userId, account.id));
  if (levelOf(progress?.xp ?? 0).level < opensAt) {
    const xp = xpToReach(opensAt);
    await db
      .insert(userProgress)
      .values({ userId: account.id, xp })
      .onConflictDoUpdate({ target: userProgress.userId, set: { xp } });
    console.info(`${email} passe au niveau ${opensAt}, celui des joutes.`);
  }
  console.info(`Joutes ouvertes à ${email}.`);
  return { id: account.id, code: account.code };
}

/** Creates the bots, or refreshes them: access, level, cards in their deck, friends of the account. */
async function prepareBots(accountId: string): Promise<void> {
  const catalog = await loadCatalogIndex(db, Date.now());
  const defined = await db.select({ id: cards.id }).from(cards).where(isNotNull(cards.definition));
  const withDefinition = new Set(defined.map((card) => card.id));
  const pool = catalog.choiceCards.map((card) => card.id).filter((id) => withDefinition.has(id));
  if (pool.length < BOT_CARDS) {
    throw new Error("Catalogue vide : lance d'abord pnpm catalog:publish.");
  }
  const now = new Date();
  for (const [index, bot] of BOTS.entries()) {
    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values({
          id: bot.id,
          name: bot.pseudo,
          email: `bot-${index + 1}@bots.leximon.test`,
          emailVerified: true,
        })
        .onConflictDoNothing();
      await tx
        .insert(players)
        .values({
          userId: bot.id,
          code: bot.code,
          pseudo: bot.pseudo,
          pseudoKey: pseudoKey(bot.pseudo),
          pseudoChangedAt: now,
          joustAccess: true,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: players.userId,
          set: { joustAccess: true, lastSeenAt: now },
        });
      const xp = xpToReach(BOT_LEVEL);
      await tx
        .insert(userProgress)
        .values({ userId: bot.id, xp })
        .onConflictDoUpdate({ target: userProgress.userId, set: { xp } });

      const owned = await tx
        .select({ cardId: userCards.cardId })
        .from(userCards)
        .where(eq(userCards.userId, bot.id));
      if (owned.length === 0) {
        // Every few cards of the catalogue, from a different start for each bot.
        const step = Math.floor(pool.length / BOT_CARDS);
        const picked = Array.from(
          { length: BOT_CARDS },
          (_, n) => pool[(n * step + index * 7) % pool.length] as string,
        );
        await tx
          .insert(userCards)
          .values(picked.map((cardId) => ({ userId: bot.id, cardId, quantity: 1 })));
        const levels = ["sketch", "ink", "gilded"] as const;
        await tx.insert(userMastery).values(
          picked.map((cardId, n) => ({
            userId: bot.id,
            cardId,
            level: levels[n % levels.length] as (typeof levels)[number],
            due: now,
            stability: 10,
            difficulty: 5,
            scheduledDays: 10,
            learningSteps: 0,
            reps: 3,
            lapses: 0,
            state: 2,
            lastReviewedAt: now,
            startedAt: now,
          })),
        );
      }
      await tx
        .insert(friendships)
        .values([
          { userId: accountId, friendId: bot.id, createdAt: now },
          { userId: bot.id, friendId: accountId, createdAt: now },
        ])
        .onConflictDoNothing();
    });
  }
  console.info(`Bots prêts, amis de ${email} : ${BOTS.map((bot) => bot.pseudo).join(", ")}.`);
}

function botOf(userId: string): Bot | undefined {
  return BOTS.find((bot) => bot.id === userId);
}

const between = ([min, max]: readonly [number, number]) =>
  (min + Math.random() * (max - min)) * 1000;

/** Plays the bot's run through, question after question, as a player would, then settles it. */
async function playRun(bot: Bot, joustId: string): Promise<void> {
  for (;;) {
    const next = await nextQuestion(db, { userId: bot.id, joustId, now: Date.now() });
    if (next.kind !== "question") break;
    const [question] = await db
      .select({ cardId: joustQuestions.cardId })
      .from(joustQuestions)
      .where(
        and(
          eq(joustQuestions.joustId, joustId),
          eq(joustQuestions.answererId, bot.id),
          eq(joustQuestions.position, next.position),
        ),
      );
    if (question === undefined) break;
    await sleep(between(bot.thinks));
    const wrong = next.choices.filter((id) => id !== question.cardId);
    const chosen =
      Math.random() < bot.skill
        ? question.cardId
        : (wrong[Math.floor(Math.random() * wrong.length)] ?? question.cardId);
    const answer = await answerQuestion(db, {
      userId: bot.id,
      joustId,
      position: next.position,
      cardId: chosen,
      now: Date.now(),
    });
    if (answer.kind !== "answered" || answer.runOver) break;
  }
  await settleJoust(db, joustId, Date.now());
}

async function challenge(account: { id: string; code: string }): Promise<void> {
  const catalog = await loadCatalogIndex(db, Date.now());
  for (const bot of BOTS) {
    const result = await launchJoust(db, {
      userId: bot.id,
      target: { kind: "friendly", opponentCode: account.code },
      launchKey: randomUUID(),
      seed: generateSeed(),
      catalog,
      now: Date.now(),
    });
    if (result.kind === "launched") {
      console.info(`${bot.pseudo} te défie et joue sa manche…`);
      void playing(bot, result.joustId);
    } else {
      console.warn(`${bot.pseudo} n'a pas pu te défier (${JSON.stringify(result)}).`);
    }
  }
}

const inPlay = new Set<string>();

async function playing(bot: Bot, joustId: string): Promise<void> {
  if (inPlay.has(joustId)) return;
  inPlay.add(joustId);
  try {
    await playRun(bot, joustId);
    console.info(`${bot.pseudo} a fini sa manche.`);
  } catch (error) {
    console.error(`${bot.pseudo} a buté sur la joute ${joustId}`, error);
  } finally {
    inPlay.delete(joustId);
  }
}

/** Jousts where a bot has its turn: the challenger's run is closed and the bot's is not. */
async function botTurns(): Promise<{ bot: Bot; joustId: string }[]> {
  const rows = await db
    .select({ id: jousts.id, opponentId: jousts.opponentId })
    .from(jousts)
    .where(
      and(
        inArray(
          jousts.opponentId,
          BOTS.map((bot) => bot.id),
        ),
        isNull(jousts.endedAt),
        isNotNull(jousts.challengerDoneAt),
        isNull(jousts.opponentDoneAt),
      ),
    );
  return rows.flatMap((row) => {
    const bot = botOf(row.opponentId);
    return bot === undefined ? [] : [{ bot, joustId: row.id }];
  });
}

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});

try {
  const account = await prepareAccount();
  if (account === null) {
    process.exitCode = 1;
  } else {
    await prepareBots(account.id);
    if (values.challenge) await challenge(account);
    console.info("Les bots jouent leur tour dès que tu as joué le tien. Ctrl+C pour arrêter.");
    let seenAt = 0;
    while (!stopping) {
      if (Date.now() - seenAt > SEEN_EVERY_MS) {
        await db
          .update(players)
          .set({ lastSeenAt: new Date() })
          .where(
            inArray(
              players.userId,
              BOTS.map((bot) => bot.id),
            ),
          );
        seenAt = Date.now();
      }
      for (const { bot, joustId } of await botTurns()) {
        if (!inPlay.has(joustId)) {
          console.info(`${bot.pseudo} joue sa manche…`);
          void playing(bot, joustId);
        }
      }
      await sleep(POLL_MS);
    }
    while (inPlay.size > 0) await sleep(200);
  }
} finally {
  await close();
}
