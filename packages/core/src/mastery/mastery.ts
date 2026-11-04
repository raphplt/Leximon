/**
 * Mastery of a word: spaced repetition with FSRS decides when a word comes back in a
 * challenge, and the right answers raise the card's level: a blank page, then sketch, ink and
 * gilded. A level never goes down, even after a forgotten word.
 */

import {
  createEmptyCard,
  type Card as FsrsCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
} from "ts-fsrs";
import type { EpochMs } from "../booster/refill";

export const MASTERY_LEVELS = ["blank", "sketch", "ink", "gilded"] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export interface MasteryRules {
  /** Period start; the rules in force at the time of each answer apply. */
  readonly startsAt: EpochMs;
  /** Probability of recalling a word when it comes back (FSRS target). */
  readonly requestRetention: number;
  /** Longest interval between two reviews of a word. */
  readonly maximumIntervalDays: number;
  /**
   * Days from which each level is reached. With `levelBy: "stability"`, the memory stability
   * FSRS predicts after the answer. With `"provenRecall"`, the time between the previous review
   * and a right answer typed from memory: the word was actually recalled that long after, not
   * recognised among choices where a guess is right once in four. A level is climbed one step per
   * answer.
   */
  readonly levelThresholdDays: Readonly<Record<"ink" | "gilded", number>>;
  readonly levelBy: "stability" | "provenRecall";
  /** Typed words at least this long forgive one slip (a letter missing, extra, wrong or swapped). */
  readonly slipToleranceFromLetters: number;
  /**
   * Level of a word answered for the first time. From a blank page, the first right answer
   * reaches the sketch, typed or not: it only shows the word was met.
   */
  readonly startLevel: "blank" | "sketch";
}

/** "again": wrong. "hard": right, typed with a slip. "good": right. */
export type AnswerGrade = "again" | "hard" | "good";

export interface Answer {
  readonly grade: AnswerGrade;
  /** Typed from memory rather than picked among choices. */
  readonly typed: boolean;
}

export type MasterySchedule = readonly [MasteryRules, ...MasteryRules[]];

/** FSRS memory state of one word for one player, as stored. */
export interface MemoryState {
  readonly due: EpochMs;
  readonly stability: number;
  readonly difficulty: number;
  readonly scheduledDays: number;
  readonly learningSteps: number;
  readonly reps: number;
  readonly lapses: number;
  /** FSRS state: 0 new, 1 learning, 2 review, 3 relearning. */
  readonly state: number;
  readonly lastReviewedAt: EpochMs | null;
}

export interface WordMastery {
  readonly level: MasteryLevel;
  readonly memory: MemoryState;
}

export interface ReviewOutcome {
  readonly mastery: WordMastery;
  /** FSRS rating recorded in the review log: 1 forgotten, 2 recalled with a slip, 3 recalled. */
  readonly rating: number;
  /** The answer raised the level. */
  readonly levelUp: boolean;
}

export function masteryRulesAt(schedule: MasterySchedule, time: EpochMs): MasteryRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** A word never reviewed: due at once, at the start level. */
export function newWordMastery(rules: MasteryRules, now: EpochMs): WordMastery {
  return { level: rules.startLevel, memory: fromFsrs(createEmptyCard(new Date(now))) };
}

export function isDue(memory: MemoryState, now: EpochMs): boolean {
  return memory.due <= now;
}

const DAY_MS = 86_400_000;

/** Level after a right answer given `recalledAfterDays` after the previous review. */
export function provenLevel(
  rules: MasteryRules,
  recalledAfterDays: number,
  current: MasteryLevel,
): MasteryLevel {
  if (current === "gilded" || current === "blank") return current;
  const next = current === "sketch" ? "ink" : "gilded";
  return recalledAfterDays >= rules.levelThresholdDays[next] ? next : current;
}

/**
 * Whether a right typed answer now would raise the level. The challenge then asks for the word
 * typed; otherwise it asks a multiple choice question, which keeps the word in memory.
 */
export function levelUpPossible(
  rules: MasteryRules,
  level: MasteryLevel,
  lastReviewedAt: EpochMs | null,
  now: EpochMs,
): boolean {
  if (rules.levelBy !== "provenRecall" || lastReviewedAt === null) return false;
  return provenLevel(rules, (now - lastReviewedAt) / DAY_MS, level) !== level;
}

/** Level reached with this stability, never below the current one. */
export function levelFor(
  rules: MasteryRules,
  stabilityDays: number,
  current: MasteryLevel,
): MasteryLevel {
  const reached =
    stabilityDays >= rules.levelThresholdDays.gilded
      ? "gilded"
      : stabilityDays >= rules.levelThresholdDays.ink
        ? "ink"
        : "sketch";
  return MASTERY_LEVELS.indexOf(reached) > MASTERY_LEVELS.indexOf(current) ? reached : current;
}

/** Whether reaching this level proves recall over time, and earns the level's XP and rewards. */
export function isProvenLevel(level: MasteryLevel): boolean {
  return level === "ink" || level === "gilded";
}

function scheduler(rules: MasteryRules) {
  return fsrs(
    generatorParameters({
      request_retention: rules.requestRetention,
      maximum_interval: rules.maximumIntervalDays,
      enable_fuzz: false,
      enable_short_term: false,
    }),
  );
}

/** Probability, between 0 and 1, that the player recalls the word now, as FSRS predicts it. */
export function recallProbability(rules: MasteryRules, memory: MemoryState, now: EpochMs): number {
  return scheduler(rules).get_retrievability(toFsrs(memory), new Date(now), false);
}

const RATINGS: Readonly<Record<AnswerGrade, Rating.Again | Rating.Hard | Rating.Good>> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
};

/**
 * Applies one challenge answer, rated by its grade. Without fuzz or short-term steps, the result
 * depends only on its inputs, and a forgotten word comes back the next day rather than minutes
 * later.
 */
export function reviewWord(
  rules: MasteryRules,
  current: WordMastery,
  answer: Answer,
  now: EpochMs,
): ReviewOutcome {
  const rating = RATINGS[answer.grade];
  const { card } = scheduler(rules).next(toFsrs(current.memory), new Date(now), rating);
  const memory = fromFsrs(card);
  const level = levelAfter(rules, current, memory, answer, now);
  return { mastery: { level, memory }, rating, levelUp: level !== current.level };
}

function levelAfter(
  rules: MasteryRules,
  current: WordMastery,
  memory: MemoryState,
  answer: Answer,
  now: EpochMs,
): MasteryLevel {
  if (current.level === "blank") return answer.grade === "again" ? "blank" : "sketch";
  if (rules.levelBy === "stability") return levelFor(rules, memory.stability, current.level);
  const previous = current.memory.lastReviewedAt;
  if (answer.grade === "again" || !answer.typed || previous === null) return current.level;
  return provenLevel(rules, (now - previous) / DAY_MS, current.level);
}

function toFsrs(memory: MemoryState): FsrsCard {
  return {
    due: new Date(memory.due),
    stability: memory.stability,
    difficulty: memory.difficulty,
    elapsed_days: 0,
    scheduled_days: memory.scheduledDays,
    learning_steps: memory.learningSteps,
    reps: memory.reps,
    lapses: memory.lapses,
    state: memory.state as State,
    ...(memory.lastReviewedAt === null ? {} : { last_review: new Date(memory.lastReviewedAt) }),
  };
}

function fromFsrs(card: FsrsCard): MemoryState {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReviewedAt: card.last_review === undefined ? null : card.last_review.getTime(),
  };
}

export { State as MemoryPhase };
