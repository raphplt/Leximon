import type { PracticeQuestion, PracticeScope } from "@leximon/contract";
import {
  answerBonuses,
  BONUS_SCHEDULE,
  bonusRulesAt,
  buildQuestion,
  createFullWallet,
  createSeededRandom,
  creditReserve,
  type EpochMs,
  gameDayOf,
  gradeTyped,
  levelOf,
  levelUpPossible,
  MASTERY_SCHEDULE,
  type MasteryLevel,
  type MemoryState,
  masteryRulesAt,
  PRACTICE_SCHEDULE,
  type PracticeRules,
  type ProgressGain,
  planPractice,
  practiceRulesAt,
  practiceXp,
  progressGain,
  type QuizFormat,
  REFILL_SCHEDULE,
  reserveCapacity,
  UNLOCK_SCHEDULE,
  type UnlockRules,
  unlockRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, gt, gte, sql, type WithSubquery } from "drizzle-orm";
import { addXp, readXp } from "../progress/progress";
import type { CatalogIndex } from "./catalog-index";
import {
  type AnswerBonus,
  lockWallet,
  type StoredAward,
  summarize,
  todaysAnswers,
} from "./challenges";

const {
  boosterBonusAwards,
  boosterWallets,
  practiceAnswers,
  reviewLogs,
  userCards,
  userMastery,
  userProgress,
} = schema;

export interface PoolWord {
  readonly cardId: string;
  readonly obtainedAt: EpochMs;
  readonly level: MasteryLevel | null;
  /** When the word is due; `null` when it was never reviewed. */
  readonly due: EpochMs | null;
  readonly lastReviewedAt: EpochMs | null;
  /** FSRS memory; `null` when the word was never reviewed. */
  readonly memory: MemoryState | null;
  readonly startedAt: EpochMs | null;
}

/** Every word the player owns with its memory, in one read: a series needs all of them. */
export async function ownedWords(db: Database, userId: string): Promise<readonly PoolWord[]> {
  const rows = await db
    .select({
      cardId: userCards.cardId,
      obtainedAt: sql<Date | string>`min(${userCards.firstObtainedAt})`,
      level: userMastery.level,
      due: userMastery.due,
      stability: userMastery.stability,
      difficulty: userMastery.difficulty,
      scheduledDays: userMastery.scheduledDays,
      learningSteps: userMastery.learningSteps,
      reps: userMastery.reps,
      lapses: userMastery.lapses,
      state: userMastery.state,
      lastReviewedAt: userMastery.lastReviewedAt,
      startedAt: userMastery.startedAt,
    })
    .from(userCards)
    .leftJoin(
      userMastery,
      and(eq(userMastery.userId, userCards.userId), eq(userMastery.cardId, userCards.cardId)),
    )
    .where(and(eq(userCards.userId, userId), gt(userCards.quantity, 0)))
    // The mastery row is unique per card: grouping by its key lets every column of it through.
    .groupBy(userCards.cardId, userMastery.userId, userMastery.cardId);
  return rows.map((row) => {
    const lastReviewedAt = row.lastReviewedAt?.getTime() ?? null;
    const reviewed = lastReviewedAt !== null && row.due !== null;
    return {
      cardId: row.cardId,
      obtainedAt: new Date(row.obtainedAt).getTime(),
      level: row.level,
      due: reviewed ? (row.due?.getTime() ?? null) : null,
      lastReviewedAt,
      memory:
        reviewed && row.due !== null
          ? {
              due: row.due.getTime(),
              stability: row.stability ?? 0,
              difficulty: row.difficulty ?? 0,
              scheduledDays: row.scheduledDays ?? 0,
              learningSteps: row.learningSteps ?? 0,
              reps: row.reps ?? 0,
              lapses: row.lapses ?? 0,
              state: row.state ?? 0,
              lastReviewedAt,
            }
          : null,
      startedAt: row.startedAt?.getTime() ?? null,
    };
  });
}

/** Words answered wrong lately, read through the journal's index on (player, date). */
export async function missedWords(
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

export function inScope(
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

export function countsAsReview(word: PoolWord, now: EpochMs): boolean {
  return word.due === null || word.due <= now;
}

/** The level a scope asks for: themes and album filters open later. */
export function scopeLevel(scope: PracticeScope, unlocks: UnlockRules): number {
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
export async function practiceXpToday(db: Database, userId: string, now: EpochMs): Promise<number> {
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
      readonly bonus: AnswerBonus;
    }
  | { readonly kind: "card_not_owned" };

/**
 * Applies a free practice answer: XP up to the daily cap, and the daily bonus when the rules count
 * free practice towards the daily goal. The word's memory and the clan's goal never see it.
 *
 * The wallet lock is the one every answer of the player takes: it serializes them, so the sum of
 * today's XP is exact, the cap holds when answers race, and the daily goal is met once.
 */
export type PracticeAnswer =
  | { readonly chosenCardId: string; readonly format?: QuizFormat | undefined }
  | { readonly format: "typed"; readonly typed: string }
  | { readonly format: "pairs"; readonly mistakes: number };

/** A typed word gets the slip a review allows; a round of pairs is right without a mistake. */
function practiceCorrect(
  catalog: CatalogIndex,
  cardId: string,
  answer: PracticeAnswer,
  now: EpochMs,
): boolean {
  if ("chosenCardId" in answer) return answer.chosenCardId === cardId;
  if (answer.format === "pairs") return answer.mistakes === 0;
  const word = catalog.wordOf.get(cardId);
  if (word === undefined) return false;
  return (
    gradeTyped(masteryRulesAt(MASTERY_SCHEDULE, now), answer.typed, word, catalog.words) !== "again"
  );
}

export async function answerPractice(
  db: Database,
  catalog: CatalogIndex,
  input: {
    userId: string;
    idempotencyKey: string;
    cardId: string;
    answer: PracticeAnswer;
    now: EpochMs;
  },
): Promise<PracticeAnswerResult> {
  const { userId, cardId, now } = input;
  const rules = practiceRulesAt(PRACTICE_SCHEDULE, now);
  const bonusRules = bonusRulesAt(BONUS_SCHEDULE, now);
  const day = gameDayOf(now);
  return db.transaction(async (tx) => {
    const locked = await lockWallet(tx, userId, createFullWallet(REFILL_SCHEDULE, now));

    const lookup = await tx.execute<{
      owned: boolean;
      previous: { correct: boolean } | null;
      earned_today: number;
      xp: number;
      day_answers: number;
      day_correct: number;
      awards: (StoredAward & { challengeId: string })[];
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
          where ${userProgress.userId} = ${userId}), 0) as xp,
        tally.day_answers, tally.day_correct,
        (select coalesce(json_agg(json_build_object('kind', ${boosterBonusAwards.kind},
            'awardKey', ${boosterBonusAwards.awardKey}, 'amount', ${boosterBonusAwards.amount},
            'credited', ${boosterBonusAwards.credited},
            'challengeId', ${boosterBonusAwards.challengeId})), '[]'::json)
          from ${boosterBonusAwards}
          where ${boosterBonusAwards.userId} = ${userId}
            and ((${boosterBonusAwards.kind} = 'daily' and ${boosterBonusAwards.awardKey} = ${day.key})
              or ${boosterBonusAwards.challengeId} = ${input.idempotencyKey})) as awards
      from (
        select count(*)::int as day_answers,
          (count(*) filter (where answers.correct))::int as day_correct
        from ${todaysAnswers(userId, day, now)}
      ) tally
    `);
    const row = lookup.rows[0];
    if (row === undefined) throw new Error(`Practice lookup empty for user ${userId}`);
    if (row.previous !== null) {
      const replayed = row.awards.filter((award) => award.challengeId === input.idempotencyKey);
      return {
        kind: "answered",
        correct: row.previous.correct,
        xpToday: row.earned_today,
        progress: progressGain(row.xp, 0),
        bonus: summarize(replayed, locked.bonusBoosters),
      };
    }
    if (!row.owned) return { kind: "card_not_owned" };

    const correct = practiceCorrect(catalog, cardId, input.answer, now);
    const xpGained = practiceXp(rules, { correct, earnedToday: row.earned_today });
    const earned = rules.practiceCountsForDaily
      ? answerBonuses(bonusRules, {
          day,
          tally: { answers: row.day_answers + 1, correct: row.day_correct + (correct ? 1 : 0) },
          dailyAwarded: row.awards.some((a) => a.kind === "daily" && a.awardKey === day.key),
          cardId,
          reachedGilded: false,
          gildedAwarded: true,
        })
      : [];
    const credit = creditReserve(
      reserveCapacity(bonusRules, locked.reserveSlots),
      locked.bonusBoosters,
      earned,
    );
    const answeredAt = new Date(now);

    const progressUpsert = addXp(tx, "progress_upsert", userId, xpGained);
    const ctes: WithSubquery[] = [progressUpsert];
    ctes.push(
      tx.$with("answer_insert").as(
        tx
          .insert(practiceAnswers)
          .values({
            userId,
            idempotencyKey: input.idempotencyKey,
            cardId,
            format: input.answer.format ?? null,
            correct,
            xp: xpGained,
            answeredAt,
          })
          .returning({ userId: practiceAnswers.userId }),
      ),
    );
    if (credit.awards.length > 0) {
      ctes.push(
        tx.$with("award_insert").as(
          tx
            .insert(boosterBonusAwards)
            .values(
              credit.awards.map((award) => ({
                userId,
                kind: award.kind,
                awardKey: award.awardKey,
                amount: award.amount,
                credited: award.credited,
                challengeId: input.idempotencyKey,
                awardedAt: answeredAt,
              })),
            )
            .onConflictDoNothing()
            .returning({ kind: boosterBonusAwards.kind }),
        ),
      );
      if (credit.reserve !== locked.bonusBoosters) {
        ctes.push(
          tx.$with("wallet_update").as(
            tx
              .update(boosterWallets)
              .set({ bonusBoosters: credit.reserve })
              .where(
                and(eq(boosterWallets.userId, userId), sql`exists (select 1 from award_insert)`),
              )
              .returning({ userId: boosterWallets.userId }),
          ),
        );
      }
    }
    // Every data-modifying CTE runs, read or not; the statement returns the new XP total.
    const [progress] = await tx
      .with(...ctes)
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
      bonus: summarize(credit.awards, credit.reserve),
    };
  });
}
