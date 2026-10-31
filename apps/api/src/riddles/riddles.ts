import type { PublicRiddle, RiddleResponse } from "@leximon/contract";
import {
  advanceRiddle,
  createFullWallet,
  createSeededRandom,
  type EpochMs,
  gameDayOf,
  gradeTyped,
  lastRiddleStep,
  MASTERY_SCHEDULE,
  masteryRulesAt,
  type ProgressGain,
  pickRiddleWord,
  progressGain,
  type Rarity,
  REFILL_SCHEDULE,
  RIDDLE_FIRST_DAY,
  RIDDLE_SCHEDULE,
  type RiddleClues,
  type RiddleOutcome,
  type RiddleRules,
  riddleDay,
  riddleNumber,
  riddleReveal,
  riddleRulesAt,
  XP_SCHEDULE,
  xpRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { lockWallet } from "../challenges/challenges";
import { addXp } from "../progress/progress";
import { completionXpOf, rarityCompletions } from "../progress/rarity-completions";

const { cards, dailyRiddles, riddlePlays, riddleWords, userCards, userProgress } = schema;

interface Riddle {
  readonly day: string;
  readonly cardId: string;
  readonly word: string;
  readonly rarity: Rarity;
  readonly clues: RiddleClues;
}

interface Play {
  readonly step: number;
  readonly outcome: RiddleOutcome | null;
  readonly xp: number;
  readonly cardGiven: boolean;
}

const NEW_PLAY: Play = { step: 0, outcome: null, xp: 0, cardGiven: false };

async function readRiddle(db: Pick<Database, "select">, day: string): Promise<Riddle | null> {
  const [row] = await db
    .select({
      cardId: dailyRiddles.cardId,
      clues: dailyRiddles.clues,
      word: cards.lemma,
      rarity: cards.rarity,
    })
    .from(dailyRiddles)
    .innerJoin(cards, eq(cards.id, dailyRiddles.cardId))
    .where(eq(dailyRiddles.day, day));
  return row === undefined ? null : { day, ...row };
}

/**
 * The riddle of a day, chosen by the first request that needs it: no scheduled task to miss.
 * Requests racing at midnight may each pick a word; the first insert wins and all read it back.
 * `null` while no catalogue with riddle words was published.
 */
async function riddleOfDay(db: Database, day: string, seed: string): Promise<Riddle | null> {
  const existing = await readRiddle(db, day);
  if (existing !== null) return existing;
  const [candidates, used] = await Promise.all([
    db
      .select({ cardId: riddleWords.cardId, clues: riddleWords.clues })
      .from(riddleWords)
      .innerJoin(cards, eq(cards.id, riddleWords.cardId))
      .where(isNull(cards.retiredAt)),
    db.select({ cardId: dailyRiddles.cardId }).from(dailyRiddles),
  ]);
  const cardId = pickRiddleWord(
    createSeededRandom(seed),
    candidates.map((candidate) => candidate.cardId),
    new Set(used.map((riddle) => riddle.cardId)),
  );
  const picked = candidates.find((candidate) => candidate.cardId === cardId);
  if (picked === undefined) return null;
  await db
    .insert(dailyRiddles)
    .values({ day, ...picked })
    .onConflictDoNothing();
  return readRiddle(db, day);
}

function riddleView(
  rules: RiddleRules,
  riddle: Riddle,
  play: Play,
  nextAt: EpochMs,
): RiddleResponse {
  const finished = play.outcome !== null;
  const { letters, ...clues } = riddleReveal(rules, riddle.clues, riddle.word, play.step, finished);
  return {
    number: riddleNumber(RIDDLE_FIRST_DAY, riddle.day),
    partOfSpeech: riddle.clues.partOfSpeech,
    letters: [...riddle.word].length,
    step: play.step,
    lastStep: lastRiddleStep(rules),
    clues,
    shownLetters: letters,
    outcome: play.outcome,
    answer: finished ? { cardId: riddle.cardId, word: riddle.word } : null,
    xp: play.xp,
    cardGiven: play.cardGiven,
    nextAt: new Date(nextAt).toISOString(),
  };
}

/** Today's riddle as this player stands; `null` while there is none. */
export async function todayRiddle(
  db: Database,
  input: { userId: string; now: EpochMs; seed: string },
): Promise<RiddleResponse | null> {
  const { userId, now } = input;
  const day = gameDayOf(now);
  const riddle = await riddleOfDay(db, day.key, input.seed);
  if (riddle === null) return null;
  const [play] = await db
    .select({
      step: riddlePlays.step,
      outcome: riddlePlays.outcome,
      xp: riddlePlays.xp,
      cardGiven: riddlePlays.cardGiven,
    })
    .from(riddlePlays)
    .where(and(eq(riddlePlays.userId, userId), eq(riddlePlays.day, day.key)));
  return riddleView(riddleRulesAt(RIDDLE_SCHEDULE, now), riddle, play ?? NEW_PLAY, day.end);
}

export type RiddleAnswerResult =
  | {
      readonly kind: "answered";
      readonly riddle: RiddleResponse;
      readonly progress: ProgressGain;
      readonly cardGiven: boolean;
    }
  /** The day changed since the player saw this riddle: they get the new one. */
  | { readonly kind: "riddle_over" };

/**
 * Applies an answer, or a request for a clue. The wallet lock is the one every answer of the
 * player takes: games of the same riddle from two devices run one after the other, so a step is
 * never lost and the reward is given once. The last key is kept, as a retry must not cost a step.
 *
 * The word is graded as a typed challenge answer is: one slip forgiven on a long enough word.
 */
export async function answerRiddle(
  db: Database,
  catalogWords: ReadonlySet<string>,
  input: {
    userId: string;
    idempotencyKey: string;
    number: number;
    guess: string | null;
    now: EpochMs;
  },
): Promise<RiddleAnswerResult> {
  const { userId, idempotencyKey, guess, now } = input;
  const day = gameDayOf(now);
  if (input.number !== riddleNumber(RIDDLE_FIRST_DAY, day.key)) return { kind: "riddle_over" };
  const riddle = await readRiddle(db, day.key);
  if (riddle === null) return { kind: "riddle_over" };

  const rules = riddleRulesAt(RIDDLE_SCHEDULE, now);
  const found =
    guess !== null &&
    gradeTyped(masteryRulesAt(MASTERY_SCHEDULE, now), guess, riddle.word, catalogWords) !== "again";

  return db.transaction(async (tx) => {
    await lockWallet(tx, userId, createFullWallet(REFILL_SCHEDULE, now));

    const lookup = await tx.execute<{
      play: (Play & { key: string }) | null;
      copies: number;
      known: boolean;
      xp: number;
    }>(sql`
      select
        (select json_build_object('step', ${riddlePlays.step}, 'outcome', ${riddlePlays.outcome},
            'xp', ${riddlePlays.xp}, 'cardGiven', ${riddlePlays.cardGiven},
            'key', ${riddlePlays.idempotencyKey})
          from ${riddlePlays} where ${riddlePlays.userId} = ${userId}
            and ${riddlePlays.day} = ${day.key}) as play,
        (select coalesce(sum(${userCards.quantity}), 0)::int from ${userCards}
          where ${userCards.userId} = ${userId} and ${userCards.cardId} = ${riddle.cardId}) as copies,
        exists (select 1 from ${userCards} where ${userCards.userId} = ${userId}
          and ${userCards.cardId} = ${riddle.cardId}) as known,
        coalesce((select ${userProgress.xp} from ${userProgress}
          where ${userProgress.userId} = ${userId}), 0) as xp
    `);
    const state = lookup.rows[0];
    if (state === undefined) throw new Error(`Riddle lookup empty for user ${userId}`);

    const before = state.play ?? NEW_PLAY;
    if (before.outcome !== null || state.play?.key === idempotencyKey) {
      return {
        kind: "answered",
        riddle: riddleView(rules, riddle, before, day.end),
        progress: progressGain(state.xp, 0),
        cardGiven: false,
      };
    }

    const next = advanceRiddle(rules, before.step, found);
    const won = next.outcome === "found";
    const cardGiven = won && state.copies === 0;
    const newWord = won && !state.known;
    const xpRules = xpRulesAt(XP_SCHEDULE, now);
    const earned = won ? rules.xp + (newWord ? xpRules.newWord[riddle.rarity] : 0) : 0;
    const answeredAt = new Date(now);
    const play: Play = { ...next, xp: earned, cardGiven };

    await tx
      .insert(riddlePlays)
      .values({ userId, day: day.key, ...play, idempotencyKey, answeredAt })
      .onConflictDoUpdate({
        target: [riddlePlays.userId, riddlePlays.day],
        set: { ...play, idempotencyKey, answeredAt },
      });
    if (cardGiven) {
      await tx
        .insert(userCards)
        .values({
          userId,
          cardId: riddle.cardId,
          quantity: 1,
          firstObtainedAt: answeredAt,
          lastObtainedAt: answeredAt,
        })
        .onConflictDoUpdate({
          target: [userCards.userId, userCards.cardId, userCards.variant],
          set: {
            quantity: sql`${userCards.quantity} + excluded.quantity`,
            lastObtainedAt: sql`excluded.last_obtained_at`,
          },
        });
    }

    let total = state.xp;
    let gained = 0;
    if (won) {
      const completions = newWord
        ? rarityCompletions(tx, xpRules, [{ userId, cardId: riddle.cardId }], answeredAt)
        : null;
      const progressUpsert = addXp(
        tx,
        "progress_upsert",
        userId,
        completions === null ? earned : sql<number>`${earned}::int + ${completionXpOf(userId)}`,
      );
      const [progress] = await (completions === null
        ? tx.with(progressUpsert)
        : tx.with(completions, progressUpsert)
      )
        .select({ xp: progressUpsert.xp })
        .from(progressUpsert);
      if (progress === undefined) {
        throw new Error(`XP missing for user ${userId} right after the riddle`);
      }
      total = progress.xp;
      gained = progress.xp - state.xp;
    }
    return {
      kind: "answered",
      riddle: riddleView(rules, riddle, play, day.end),
      progress: progressGain(total, gained),
      cardGiven,
    };
  });
}

/** A riddle's public page; `null` for a riddle to come, or a day without one. */
export async function publicRiddle(
  db: Database,
  input: { number: number; now: EpochMs; seed: string },
): Promise<PublicRiddle | null> {
  const { number, now } = input;
  const today = gameDayOf(now).key;
  const day = riddleDay(RIDDLE_FIRST_DAY, number);
  if (day > today) return null;
  const isToday = day === today;
  const riddle = isToday ? await riddleOfDay(db, day, input.seed) : await readRiddle(db, day);
  if (riddle === null) return null;
  const counts = await db
    .select({ outcome: riddlePlays.outcome, games: count() })
    .from(riddlePlays)
    .where(eq(riddlePlays.day, day))
    .groupBy(riddlePlays.outcome);
  const gamesOf = (outcome: RiddleOutcome) =>
    counts.find((row) => row.outcome === outcome)?.games ?? 0;
  return {
    number,
    day,
    isToday,
    played: gamesOf("found") + gamesOf("lost"),
    found: gamesOf("found"),
    answer: isToday ? null : { cardId: riddle.cardId, word: riddle.word },
  };
}
