import {
  type Answer,
  answerBonuses,
  answerXp,
  BONUS_SCHEDULE,
  type BonusKind,
  type BoosterWallet,
  bonusRulesAt,
  buildQuestion,
  createFullWallet,
  createSeededRandom,
  creditReserve,
  type EpochMs,
  gameDayOf,
  gradeTyped,
  isDue,
  isProvenLevel,
  levelUpPossible,
  MASTERY_SCHEDULE,
  type MasteryLevel,
  type MasteryRules,
  type MemoryState,
  masteryRulesAt,
  newWordMastery,
  PRACTICE_SCHEDULE,
  type ProgressGain,
  planSession,
  practiceRulesAt,
  progressGain,
  type Question,
  type QuizFormat,
  REFILL_SCHEDULE,
  reserveCapacity,
  reviewWord,
  XP_SCHEDULE,
  xpRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, eq, type SQL, sql, type WithSubquery } from "drizzle-orm";
import { addXp } from "../progress/progress";
import type { CatalogIndex } from "./catalog-index";

const {
  boosterBonusAwards,
  boosterWallets,
  practiceAnswers,
  userMastery,
  userProgress,
  reviewLogs,
  userCards,
} = schema;

/**
 * Today's answers towards the daily goal, as a subquery of one `correct` column: the reviews, and
 * the free practice answers when the rules count them. Both read their (player, date) index.
 */
export function todaysAnswers(
  userId: string,
  day: { start: EpochMs; end: EpochMs },
  now: EpochMs,
): SQL {
  const countPractice = practiceRulesAt(PRACTICE_SCHEDULE, now).practiceCountsForDaily;
  return sql`(
    select ${reviewLogs.correct} as correct from ${reviewLogs}
    where ${reviewLogs.userId} = ${userId}
      and ${reviewLogs.reviewedAt} >= ${new Date(day.start)}
      and ${reviewLogs.reviewedAt} < ${new Date(day.end)}
    union all
    select ${practiceAnswers.correct} as correct from ${practiceAnswers}
    where ${countPractice} and ${practiceAnswers.userId} = ${userId}
      and ${practiceAnswers.answeredAt} >= ${new Date(day.start)}
      and ${practiceAnswers.answeredAt} < ${new Date(day.end)}
  ) answers`;
}

export interface ChallengeSession {
  readonly questions: readonly Question[];
  /** When the next owned word becomes due, if none is due now. */
  readonly nextDueAt: EpochMs | null;
}

/**
 * Picks the words of a challenge session: owned words due for review (most overdue first), then
 * owned words never reviewed (oldest first), and builds one question per word: the word to type
 * when a right answer can raise its level, a multiple choice otherwise.
 *
 * Reads only: nothing is written until an answer arrives, so abandoning a session costs nothing.
 */
export async function nextChallenges(
  db: Database,
  catalog: CatalogIndex,
  input: { userId: string; now: EpochMs; limit: number; seed: string },
): Promise<ChallengeSession> {
  const { userId, now, limit } = input;
  const rules = masteryRulesAt(MASTERY_SCHEDULE, now);
  const owned = sql`exists (select 1 from ${userCards} where ${userCards.userId} = ${userId}
    and ${userCards.cardId} = candidates.card_id and ${userCards.quantity} > 0)`;
  // One round trip: due words and never-reviewed words, each list bounded by the session size.
  const result = await db.execute<{
    card_id: string;
    due: boolean;
    level: MasteryLevel | null;
    last_reviewed_at: Date | string | null;
  }>(sql`
    select card_id, true as due, level, last_reviewed_at from (
      select ${userMastery.cardId} as card_id, ${userMastery.level}::text as level,
        ${userMastery.lastReviewedAt} as last_reviewed_at
      from ${userMastery}
      where ${userMastery.userId} = ${userId} and ${userMastery.due} <= ${new Date(now)}
      order by ${userMastery.due}
      limit ${limit * 2}
    ) candidates where ${owned}
    union all
    (select ${userCards.cardId} as card_id, false as due, null::text as level,
        null::timestamptz as last_reviewed_at
      from ${userCards}
      where ${userCards.userId} = ${userId} and ${userCards.quantity} > 0
        and not exists (select 1 from ${userMastery} where ${userMastery.userId} = ${userId}
          and ${userMastery.cardId} = ${userCards.cardId})
      group by ${userCards.cardId}
      order by min(${userCards.firstObtainedAt}), ${userCards.cardId}
      limit ${limit})
  `);
  const due = result.rows.filter((row) => row.due).map((row) => row.card_id);
  const fresh = result.rows.filter((row) => !row.due).map((row) => row.card_id);
  const words = planSession(due, fresh, limit);
  const reviewed = new Map(result.rows.map((row) => [row.card_id, row]));

  const random = createSeededRandom(input.seed);
  const questions: Question[] = [];
  for (const cardId of words) {
    const row = reviewed.get(cardId);
    const lastReviewedAt =
      row?.last_reviewed_at == null ? null : new Date(row.last_reviewed_at).getTime();
    if (
      row?.level != null &&
      catalog.wordOf.has(cardId) &&
      levelUpPossible(rules, row.level, lastReviewedAt, now)
    ) {
      questions.push({ cardId, format: "typed" });
      continue;
    }
    const collectionId = catalog.collectionOf.get(cardId);
    const sameCollection =
      collectionId === undefined ? [] : (catalog.byCollection.get(collectionId) ?? []);
    const question = buildQuestion(random, cardId, sameCollection, catalog.all);
    if (question !== null) questions.push(question);
  }

  if (questions.length > 0) {
    return { questions, nextDueAt: null };
  }
  const [next] = await db
    .select({ due: userMastery.due })
    .from(userMastery)
    .where(
      and(
        eq(userMastery.userId, userId),
        sql`exists (select 1 from ${userCards} where ${userCards.userId} = ${userId}
          and ${userCards.cardId} = ${userMastery.cardId} and ${userCards.quantity} > 0)`,
      ),
    )
    .orderBy(asc(userMastery.due))
    .limit(1);
  return { questions, nextDueAt: next === undefined ? null : next.due.getTime() };
}

/** The card picked among the choices, or the word typed. */
export type GivenAnswer =
  | { readonly format: QuizFormat; readonly chosenCardId: string }
  | { readonly format: "typed"; readonly typed: string };

export type AnswerInput = GivenAnswer & {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly cardId: string;
  readonly now: EpochMs;
};

/** Bonus boosters earned by one answer (see `answerBonuses` in core). */
export interface AnswerBonus {
  readonly daily: number;
  readonly gilded: number;
  /** Part of `daily + gilded` that fitted in the reserve. */
  readonly credited: number;
  /** Reserve after the answer. */
  readonly reserve: number;
}

export type AnswerResult =
  | {
      readonly kind: "answered";
      readonly correct: boolean;
      /** Right, but typed with one slip. */
      readonly slip: boolean;
      readonly level: MasteryLevel;
      readonly levelUp: boolean;
      readonly nextReviewAt: EpochMs;
      readonly bonus: AnswerBonus;
      readonly progress: ProgressGain;
    }
  | { readonly kind: "card_not_owned" }
  | { readonly kind: "not_due"; readonly nextReviewAt: EpochMs };

/**
 * Applies a challenge answer to the word's mastery, and awards the bonus boosters and the XP
 * it earns.
 *
 * The answer is right when the chosen card is the card asked about, or when the word typed matches
 * (see `gradeTyped`). The server does not keep the questions it served (stateless API): it only
 * accepts answers on owned words that are due, once per idempotency key. The format is read from
 * the answer itself, so nothing is taken on trust: only a typed answer can raise the level, and a
 * client that sends a choice to a typed question only gives that up. A client could always look
 * the answer up in the public catalogue.
 *
 * Lock order: the player's wallet first, then the word's mastery row. Opening a booster also locks
 * the wallet first (then copies), so the two never wait on each other in a cycle. Holding the
 * wallet serializes all the answers of a player: each one counts today's answers with every
 * earlier answer committed, so the daily goal is met by exactly one answer, even when answers race.
 *
 * One transaction, five round trips: BEGIN, lock (or create) the wallet, lock (or create) the
 * mastery row of an owned word along with the idempotency lookup, today's tally and the awards
 * already given, one combined write, COMMIT.
 */
export async function answerChallenge(
  db: Database,
  catalog: CatalogIndex,
  input: AnswerInput,
): Promise<AnswerResult> {
  const { userId, cardId, now } = input;
  const rules = masteryRulesAt(MASTERY_SCHEDULE, now);
  const bonusRules = bonusRulesAt(BONUS_SCHEDULE, now);
  const fresh = newWordMastery(rules, now);
  const wallet = createFullWallet(REFILL_SCHEDULE, now);
  const day = gameDayOf(now);

  return db.transaction(async (tx) => {
    const locked = await lockWallet(tx, userId, wallet);

    // Runs after the wallet lock, as a separate statement: its snapshot sees every answer and
    // award committed by the player's earlier requests. Creates the mastery row of a word
    // answered for the first time, or locks the existing one; returns nothing when the player owns
    // no copy of the word.
    const lookup = await tx.execute<AnswerLookupRow>(sql`
      with locked as (
        insert into ${userMastery} (user_id, card_id, level, due, stability, difficulty,
          scheduled_days, learning_steps, reps, lapses, state, last_reviewed_at, started_at)
        select ${userId}, ${cardId}, ${fresh.level}, ${new Date(fresh.memory.due)},
          ${fresh.memory.stability}, ${fresh.memory.difficulty}, ${fresh.memory.scheduledDays},
          ${fresh.memory.learningSteps}, ${fresh.memory.reps}, ${fresh.memory.lapses},
          ${fresh.memory.state}, null, ${new Date(now)}
        where exists (select 1 from ${userCards} where ${userCards.userId} = ${userId}
          and ${userCards.cardId} = ${cardId} and ${userCards.quantity} > 0)
        on conflict (user_id, card_id) do update set user_id = excluded.user_id
        returning level, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses,
          state, last_reviewed_at
      )
      select locked.*,
        (select json_build_object('correct', ${reviewLogs.correct}, 'rating', ${reviewLogs.rating},
            'levelAfter', ${reviewLogs.levelAfter})
          from ${reviewLogs}
          where ${reviewLogs.userId} = ${userId} and ${reviewLogs.challengeId} = ${input.idempotencyKey}
          limit 1) as previous,
        tally.day_answers, tally.day_correct, awards.awards,
        coalesce((select ${userProgress.xp} from ${userProgress}
          where ${userProgress.userId} = ${userId}), 0) as xp
      from locked
      cross join lateral (
        select count(*)::int as day_answers, (count(*) filter (where answers.correct))::int as day_correct
        from ${todaysAnswers(userId, day, now)}
      ) tally
      cross join lateral (
        select coalesce(json_agg(json_build_object('kind', ${boosterBonusAwards.kind},
          'awardKey', ${boosterBonusAwards.awardKey}, 'amount', ${boosterBonusAwards.amount},
          'credited', ${boosterBonusAwards.credited},
          'challengeId', ${boosterBonusAwards.challengeId})), '[]'::json) as awards
        from ${boosterBonusAwards}
        where ${boosterBonusAwards.userId} = ${userId}
          and ((${boosterBonusAwards.kind} = 'daily' and ${boosterBonusAwards.awardKey} = ${day.key})
            or (${boosterBonusAwards.kind} = 'gilded' and ${boosterBonusAwards.awardKey} = ${cardId})
            or ${boosterBonusAwards.challengeId} = ${input.idempotencyKey})
      ) awards
    `);
    const row = lookup.rows[0];
    if (row === undefined) {
      return { kind: "card_not_owned" };
    }
    const current = { level: row.level, memory: toMemory(row) };

    if (row.previous !== null) {
      const replayed = row.awards.filter((award) => award.challengeId === input.idempotencyKey);
      return {
        kind: "answered",
        correct: row.previous.correct,
        slip: row.previous.rating === SLIP_RATING,
        level: row.previous.levelAfter,
        levelUp: false,
        nextReviewAt: current.memory.due,
        bonus: summarize(replayed, locked.bonusBoosters),
        progress: progressGain(row.xp, 0),
      };
    }

    if (current.memory.lastReviewedAt !== null && !isDue(current.memory, now)) {
      return { kind: "not_due", nextReviewAt: current.memory.due };
    }

    const answer = gradeAnswer(rules, catalog, input);
    const correct = answer.grade !== "again";
    const outcome = reviewWord(rules, current, answer, now);
    const { memory } = outcome.mastery;
    const reviewedAt = new Date(now);

    const earned = answerBonuses(bonusRules, {
      day,
      tally: { answers: row.day_answers + 1, correct: row.day_correct + (correct ? 1 : 0) },
      dailyAwarded: row.awards.some((a) => a.kind === "daily" && a.awardKey === day.key),
      cardId,
      reachedGilded: outcome.levelUp && outcome.mastery.level === "gilded",
      gildedAwarded: row.awards.some((a) => a.kind === "gilded" && a.awardKey === cardId),
    });
    const credit = creditReserve(
      reserveCapacity(bonusRules, locked.reserveSlots),
      locked.bonusBoosters,
      earned,
    );

    const masteryUpdate = tx.$with("mastery_update").as(
      tx
        .update(userMastery)
        .set({
          level: outcome.mastery.level,
          due: new Date(memory.due),
          stability: memory.stability,
          difficulty: memory.difficulty,
          scheduledDays: memory.scheduledDays,
          learningSteps: memory.learningSteps,
          reps: memory.reps,
          lapses: memory.lapses,
          state: memory.state,
          lastReviewedAt: reviewedAt,
        })
        .where(and(eq(userMastery.userId, userId), eq(userMastery.cardId, cardId)))
        .returning({ cardId: userMastery.cardId }),
    );
    // Reaching the sketch only shows the word was met: no level XP before the ink.
    const xpGained = answerXp(xpRulesAt(XP_SCHEDULE, now), {
      correct,
      levelUp: outcome.levelUp && isProvenLevel(outcome.mastery.level),
    });
    // Written even for 0 XP: the statement then returns the exact total for the response.
    const progressUpsert = addXp(tx, "progress_upsert", userId, xpGained);
    const ctes: WithSubquery[] = [masteryUpdate, progressUpsert];
    if (credit.awards.length > 0) {
      // The primary key of the awards is a safety net: under the wallet lock, the awards read
      // above are complete, so the reserve computed from them is exact.
      const awardInsert = tx.$with("award_insert").as(
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
              awardedAt: reviewedAt,
            })),
          )
          .onConflictDoNothing()
          .returning({ kind: boosterBonusAwards.kind }),
      );
      ctes.push(awardInsert);
      if (credit.reserve !== locked.bonusBoosters) {
        ctes.push(
          tx.$with("wallet_update").as(
            tx
              .update(boosterWallets)
              .set({ bonusBoosters: credit.reserve })
              .where(
                and(eq(boosterWallets.userId, userId), sql`exists (select 1 from award_insert)`),
              )
              .returning({ cardId: boosterWallets.userId }),
          ),
        );
      }
    }
    const reviewInsert = tx.$with("review_insert").as(
      tx
        .insert(reviewLogs)
        .values({
          id: crypto.randomUUID(),
          userId,
          cardId,
          challengeId: input.idempotencyKey,
          format: input.format,
          correct,
          rating: outcome.rating,
          levelAfter: outcome.mastery.level,
          reviewedAt,
        })
        .returning({ id: reviewLogs.id }),
    );
    // Every data-modifying CTE runs, read or not; the statement returns the new XP total.
    const [progress] = await tx
      .with(...ctes, reviewInsert)
      .select({ xp: progressUpsert.xp })
      .from(progressUpsert);
    if (progress === undefined) {
      throw new Error(`XP missing for user ${userId} right after the answer`);
    }

    return {
      kind: "answered",
      correct,
      slip: answer.grade === "hard",
      level: outcome.mastery.level,
      levelUp: outcome.levelUp,
      nextReviewAt: memory.due,
      bonus: summarize(credit.awards, credit.reserve),
      progress: progressGain(progress.xp, xpGained),
    };
  });
}

/**
 * Creates the wallet of a player who never opened a booster (a full stock, as when it is
 * missing), or locks the existing one: on conflict, the no-op update takes the row lock.
 */
export async function lockWallet(
  tx: Pick<Database, "insert">,
  userId: string,
  wallet: BoosterWallet,
): Promise<{ readonly bonusBoosters: number; readonly reserveSlots: number }> {
  const [locked] = await tx
    .insert(boosterWallets)
    .values({
      userId,
      stored: wallet.stored,
      progressMs: wallet.progressMs,
      asOf: new Date(wallet.asOf),
    })
    .onConflictDoUpdate({ target: boosterWallets.userId, set: { userId: sql`excluded.user_id` } })
    .returning({
      bonusBoosters: boosterWallets.bonusBoosters,
      reserveSlots: boosterWallets.reserveSlots,
    });
  if (locked === undefined) {
    throw new Error(`Wallet missing for user ${userId} right after its creation`);
  }
  return locked;
}

/** FSRS rating of a right answer typed with a slip. */
const SLIP_RATING = 2;

function gradeAnswer(rules: MasteryRules, catalog: CatalogIndex, input: AnswerInput): Answer {
  if (input.format !== "typed") {
    return { grade: input.chosenCardId === input.cardId ? "good" : "again", typed: false };
  }
  const word = catalog.wordOf.get(input.cardId);
  if (word === undefined) {
    throw new Error(`Owned card ${input.cardId} missing from the published catalog`);
  }
  return { grade: gradeTyped(rules, input.typed, word, catalog.words), typed: true };
}

export interface StoredAward {
  readonly kind: BonusKind;
  readonly awardKey: string;
  readonly amount: number;
  readonly credited: number;
}

export function summarize(awards: readonly StoredAward[], reserve: number): AnswerBonus {
  const total = (kind: BonusKind) =>
    awards.filter((award) => award.kind === kind).reduce((sum, award) => sum + award.amount, 0);
  return {
    daily: total("daily"),
    gilded: total("gilded"),
    credited: awards.reduce((sum, award) => sum + award.credited, 0),
    reserve,
  };
}

interface AnswerLookupRow extends MasteryRow, Record<string, unknown> {
  previous: { correct: boolean; rating: number; levelAfter: MasteryLevel } | null;
  day_answers: number;
  day_correct: number;
  awards: (StoredAward & { challengeId: string })[];
  xp: number;
}

interface MasteryRow {
  level: MasteryLevel;
  due: Date | string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_reviewed_at: Date | string | null;
}

function toMemory(row: MasteryRow): MemoryState {
  return {
    due: new Date(row.due).getTime(),
    stability: row.stability,
    difficulty: row.difficulty,
    scheduledDays: row.scheduled_days,
    learningSteps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReviewedAt: row.last_reviewed_at === null ? null : new Date(row.last_reviewed_at).getTime(),
  };
}

export interface DailyTally {
  readonly goal: { readonly answers: number; readonly correct: number };
  readonly answers: number;
  readonly correct: number;
  readonly awarded: boolean;
}

/**
 * Today's answers towards the daily goal, in one read: the answers of the game day
 * (Paris time) and whether its bonus was already given. Same subquery as the answer tally.
 */
export async function dailyTally(db: Database, userId: string, now: EpochMs): Promise<DailyTally> {
  const rules = bonusRulesAt(BONUS_SCHEDULE, now);
  const day = gameDayOf(now);
  const result = await db.execute<{ answers: number; correct: number; awarded: boolean }>(sql`
    select count(*)::int as answers,
      (count(*) filter (where answers.correct))::int as correct,
      exists (select 1 from ${boosterBonusAwards}
        where ${boosterBonusAwards.userId} = ${userId}
          and ${boosterBonusAwards.kind} = 'daily'
          and ${boosterBonusAwards.awardKey} = ${day.key}) as awarded
    from ${todaysAnswers(userId, day, now)}
  `);
  const row = result.rows[0];
  return {
    goal: rules.dailyGoal,
    answers: row?.answers ?? 0,
    correct: row?.correct ?? 0,
    awarded: row?.awarded ?? false,
  };
}
