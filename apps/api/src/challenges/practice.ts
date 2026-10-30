import type { PracticeQuestion, PracticeScope } from "@leximon/contract";
import {
  buildQuestion,
  createFullWallet,
  createSeededRandom,
  type EpochMs,
  gameDayOf,
  levelOf,
  levelUpPossible,
  MASTERY_SCHEDULE,
  type MasteryLevel,
  masteryRulesAt,
  PRACTICE_SCHEDULE,
  type PracticeRules,
  type ProgressGain,
  planPractice,
  practiceRulesAt,
  practiceXp,
  progressGain,
  REFILL_SCHEDULE,
  UNLOCK_SCHEDULE,
  type UnlockRules,
  unlockRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, gt, gte, sql } from "drizzle-orm";
import { addXp, readXp } from "../progress/progress";
import type { CatalogIndex } from "./catalog-index";
import { lockWallet } from "./challenges";

const { practiceAnswers, reviewLogs, userCards, userMastery, userProgress } = schema;

interface PoolWord {
  readonly cardId: string;
  readonly obtainedAt: EpochMs;
  readonly level: MasteryLevel | null;
  /** When the word is due; `null` when it was never reviewed. */
  readonly due: EpochMs | null;
  readonly lastReviewedAt: EpochMs | null;
}

/** Every word the player owns with its memory, in one read: a series needs all of them. */
async function ownedWords(db: Database, userId: string): Promise<readonly PoolWord[]> {
  const rows = await db
    .select({
      cardId: userCards.cardId,
      obtainedAt: sql<Date | string>`min(${userCards.firstObtainedAt})`,
      level: userMastery.level,
      due: userMastery.due,
      lastReviewedAt: userMastery.lastReviewedAt,
    })
    .from(userCards)
    .leftJoin(
      userMastery,
      and(eq(userMastery.userId, userCards.userId), eq(userMastery.cardId, userCards.cardId)),
    )
    .where(and(eq(userCards.userId, userId), gt(userCards.quantity, 0)))
    .groupBy(userCards.cardId, userMastery.level, userMastery.due, userMastery.lastReviewedAt);
  return rows.map((row) => ({
    cardId: row.cardId,
    obtainedAt: new Date(row.obtainedAt).getTime(),
    level: row.level,
    due: row.lastReviewedAt === null ? null : (row.due?.getTime() ?? null),
    lastReviewedAt: row.lastReviewedAt?.getTime() ?? null,
  }));
}

/** Words answered wrong lately, read through the journal's index on (player, date). */
async function missedWords(
  db: Database,
  userId: string,
  rules: PracticeRules,
  now: EpochMs,
): Promise<ReadonlySet<string>> {
  const rows = await db
    .selectDistinct({ cardId: reviewLogs.cardId })
    .from(reviewLogs)
    .where(
      and(
        eq(reviewLogs.userId, userId),
        gte(reviewLogs.reviewedAt, new Date(now - rules.missedWindowMs)),
        eq(reviewLogs.correct, false),
      ),
    );
  return new Set(rows.map((row) => row.cardId));
}

function recentWords(pool: readonly PoolWord[], rules: PracticeRules): readonly PoolWord[] {
  return [...pool].sort((a, b) => b.obtainedAt - a.obtainedAt).slice(0, rules.recentWords);
}

function inScope(
  scope: PracticeScope,
  pool: readonly PoolWord[],
  catalog: CatalogIndex,
  missed: ReadonlySet<string>,
  rules: PracticeRules,
): readonly PoolWord[] {
  switch (scope.kind) {
    case "collection":
      return pool.filter((word) => catalog.collectionOf.get(word.cardId) === scope.id);
    case "theme":
      return pool.filter((word) => catalog.themesOf.get(word.cardId)?.includes(scope.id));
    case "missed":
      return pool.filter((word) => missed.has(word.cardId));
    case "recent":
      return recentWords(pool, rules);
    case "cards": {
      const asked = new Set(scope.cardIds);
      return pool.filter((word) => asked.has(word.cardId));
    }
  }
}

function countsAsReview(word: PoolWord, now: EpochMs): boolean {
  return word.due === null || word.due <= now;
}

/** The level a scope asks for: themes and album filters open later. */
function scopeLevel(scope: PracticeScope, unlocks: UnlockRules): number {
  return scope.kind === "theme" || scope.kind === "cards" ? unlocks.levels.practice_choice : 1;
}

export interface PracticeSummary {
  readonly scopes: readonly {
    readonly scope: PracticeScope;
    readonly words: number;
    readonly due: number;
  }[];
  readonly xp: { readonly today: number; readonly cap: number };
}

/** The scopes the player can practise on, with what each holds. A closed theme stays listed. */
export async function practiceSummary(
  db: Database,
  catalog: CatalogIndex,
  input: { userId: string; now: EpochMs },
): Promise<PracticeSummary> {
  const { userId, now } = input;
  const rules = practiceRulesAt(PRACTICE_SCHEDULE, now);
  const [pool, missed, today] = await Promise.all([
    ownedWords(db, userId),
    missedWords(db, userId, rules, now),
    practiceXpToday(db, userId, now),
  ]);
  const collections = [...new Set(pool.flatMap((w) => catalog.collectionOf.get(w.cardId) ?? []))];
  const themes = [...new Set(pool.flatMap((w) => catalog.themesOf.get(w.cardId) ?? []))];
  const candidates: PracticeScope[] = [
    ...collections.map((id) => ({ kind: "collection" as const, id })),
    { kind: "missed" },
    { kind: "recent" },
    ...themes.map((id) => ({ kind: "theme" as const, id })),
  ];
  const scopes = candidates.flatMap((scope) => {
    const words = inScope(scope, pool, catalog, missed, rules);
    if (words.length < rules.minWords) return [];
    const due = words.filter((word) => countsAsReview(word, now)).length;
    return [{ scope, words: words.length, due }];
  });
  return { scopes, xp: { today, cap: rules.dailyXpCap } };
}

export type PracticeSeries =
  | { readonly kind: "ready"; readonly questions: readonly PracticeQuestion[] }
  | { readonly kind: "level_required"; readonly level: number }
  | { readonly kind: "scope_too_small"; readonly minWords: number };

/**
 * Picks the words of a series and builds their questions. Reads only, like a normal session:
 * nothing is written until an answer arrives.
 */
export async function startPractice(
  db: Database,
  catalog: CatalogIndex,
  input: { userId: string; scope: PracticeScope; now: EpochMs; seed: string },
): Promise<PracticeSeries> {
  const { userId, scope, now } = input;
  const unlocks = unlockRulesAt(UNLOCK_SCHEDULE, now);
  const level = scopeLevel(scope, unlocks);
  if (level > 1 && levelOf(await readXp(db, userId)).level < level) {
    return { kind: "level_required", level };
  }
  const rules = practiceRulesAt(PRACTICE_SCHEDULE, now);
  const [pool, missed] = await Promise.all([
    ownedWords(db, userId),
    scope.kind === "missed" ? missedWords(db, userId, rules, now) : new Set<string>(),
  ]);
  const words = inScope(scope, pool, catalog, missed, rules);
  if (words.length < rules.minWords) {
    return { kind: "scope_too_small", minWords: rules.minWords };
  }

  const byId = new Map(words.map((word) => [word.cardId, word]));
  const reviews = words.filter((word) => countsAsReview(word, now));
  const random = createSeededRandom(input.seed);
  const { counted, free } = planPractice(
    random,
    reviews
      .filter((word) => word.due !== null)
      .sort((a, b) => (a.due ?? 0) - (b.due ?? 0))
      .map((word) => word.cardId),
    reviews.filter((word) => word.due === null).map((word) => word.cardId),
    words.filter((word) => !countsAsReview(word, now)).map((word) => word.cardId),
    rules.seriesSize,
  );

  const mastery = masteryRulesAt(MASTERY_SCHEDULE, now);
  const multipleChoice = (cardId: string) => {
    const collectionId = catalog.collectionOf.get(cardId);
    const sameCollection =
      collectionId === undefined ? [] : (catalog.byCollection.get(collectionId) ?? []);
    return buildQuestion(random, cardId, sameCollection, catalog.all);
  };
  const questions: PracticeQuestion[] = [];
  for (const cardId of counted) {
    const word = byId.get(cardId);
    if (
      word?.level != null &&
      catalog.wordOf.has(cardId) &&
      levelUpPossible(mastery, word.level, word.lastReviewedAt, now)
    ) {
      questions.push({ cardId, format: "typed", counted: true });
      continue;
    }
    const question = multipleChoice(cardId);
    if (question !== null) {
      const { format, choices } = question;
      questions.push({ cardId, format, choices: [...choices], counted: true });
    }
  }
  for (const cardId of free) {
    const question = multipleChoice(cardId);
    if (question !== null) {
      const { format, choices } = question;
      questions.push({ cardId, format, choices: [...choices], counted: false });
    }
  }
  return { kind: "ready", questions };
}

/** Free practice XP earned today, Paris time. */
async function practiceXpToday(db: Database, userId: string, now: EpochMs): Promise<number> {
  const day = gameDayOf(now);
  const [row] = await db
    .select({ xp: sql<number>`coalesce(sum(${practiceAnswers.xp}), 0)::int` })
    .from(practiceAnswers)
    .where(
      and(
        eq(practiceAnswers.userId, userId),
        gte(practiceAnswers.answeredAt, new Date(day.start)),
        sql`${practiceAnswers.answeredAt} < ${new Date(day.end)}`,
      ),
    );
  return row?.xp ?? 0;
}

export type PracticeAnswerResult =
  | {
      readonly kind: "answered";
      readonly correct: boolean;
      readonly xpToday: number;
      readonly progress: ProgressGain;
    }
  | { readonly kind: "card_not_owned" };

/**
 * Applies a free practice answer: XP up to the daily cap, nothing else. The word's memory, the
 * daily goal and the clan's goal never see it.
 *
 * The wallet lock is the one every answer of the player takes: it serializes them, so the sum of
 * today's XP is exact and the cap holds when answers race.
 */
export async function answerPractice(
  db: Database,
  input: {
    userId: string;
    idempotencyKey: string;
    cardId: string;
    chosenCardId: string;
    now: EpochMs;
  },
): Promise<PracticeAnswerResult> {
  const { userId, cardId, now } = input;
  const rules = practiceRulesAt(PRACTICE_SCHEDULE, now);
  const day = gameDayOf(now);
  return db.transaction(async (tx) => {
    await lockWallet(tx, userId, createFullWallet(REFILL_SCHEDULE, now));

    const lookup = await tx.execute<{
      owned: boolean;
      previous: { correct: boolean } | null;
      earned_today: number;
      xp: number;
    }>(sql`
      select
        exists (select 1 from ${userCards} where ${userCards.userId} = ${userId}
          and ${userCards.cardId} = ${cardId} and ${userCards.quantity} > 0) as owned,
        (select json_build_object('correct', ${practiceAnswers.correct}) from ${practiceAnswers}
          where ${practiceAnswers.userId} = ${userId}
            and ${practiceAnswers.idempotencyKey} = ${input.idempotencyKey}) as previous,
        (select coalesce(sum(${practiceAnswers.xp}), 0)::int from ${practiceAnswers}
          where ${practiceAnswers.userId} = ${userId}
            and ${practiceAnswers.answeredAt} >= ${new Date(day.start)}
            and ${practiceAnswers.answeredAt} < ${new Date(day.end)}) as earned_today,
        coalesce((select ${userProgress.xp} from ${userProgress}
          where ${userProgress.userId} = ${userId}), 0) as xp
    `);
    const row = lookup.rows[0];
    if (row === undefined) throw new Error(`Practice lookup empty for user ${userId}`);
    if (row.previous !== null) {
      return {
        kind: "answered",
        correct: row.previous.correct,
        xpToday: row.earned_today,
        progress: progressGain(row.xp, 0),
      };
    }
    if (!row.owned) return { kind: "card_not_owned" };

    const correct = input.chosenCardId === cardId;
    const xpGained = practiceXp(rules, { correct, earnedToday: row.earned_today });
    const progressUpsert = addXp(tx, "progress_upsert", userId, xpGained);
    const answerInsert = tx.$with("answer_insert").as(
      tx
        .insert(practiceAnswers)
        .values({
          userId,
          idempotencyKey: input.idempotencyKey,
          correct,
          xp: xpGained,
          answeredAt: new Date(now),
        })
        .returning({ userId: practiceAnswers.userId }),
    );
    const [progress] = await tx
      .with(progressUpsert, answerInsert)
      .select({ xp: progressUpsert.xp })
      .from(progressUpsert);
    if (progress === undefined) {
      throw new Error(`XP missing for user ${userId} right after the answer`);
    }
    return {
      kind: "answered",
      correct,
      xpToday: row.earned_today + xpGained,
      progress: progressGain(progress.xp, xpGained),
    };
  });
}
