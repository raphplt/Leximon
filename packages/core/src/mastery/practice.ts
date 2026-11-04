/**
 * The review: a series on all the words the player owns, or on a scope they pick (a collection,
 * a theme, the words they missed). Words due and the day's new words come first and count as a
 * normal review. The others are free practice: a word seen too early teaches the memory model
 * nothing, so they leave it untouched and earn a little XP, capped by day so that practice stays
 * a pleasure, not the fast way up.
 */

import type { EpochMs } from "../booster/refill";
import { type RandomSource, randomInt } from "../random";

export interface PracticeRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  readonly seriesSize: number;
  /** A multiple choice needs four words; a smaller scope is not offered. */
  readonly minWords: number;
  /** How far back a wrong answer makes a word « missed ». */
  readonly missedWindowMs: number;
  /** How many of the last words obtained make the « recent » scope. */
  readonly recentWords: number;
  readonly xpPerAnswer: number;
  readonly dailyXpCap: number;
  /** Lengths a player may choose; `seriesSize` is the default. */
  readonly lengths: readonly number[];
  /** New words a player may start each day (Paris time), to choose from. */
  readonly newWordsPerDay: readonly number[];
  readonly defaultNewWordsPerDay: number;
  /**
   * While words are due, at most one new word in this many questions: the pile of words to review
   * must not grow faster than it empties.
   */
  readonly newWordEvery: number;
  /** A word missed in a series comes back once, `catchUpGap` questions later, this many at most. */
  readonly catchUps: number;
  readonly catchUpGap: number;
  /**
   * Free practice picks among this many times as many of the most fragile words as it needs, so
   * that two series in a row do not ask the same words.
   */
  readonly fragilePool: number;
  /** Questions of the daily challenge's own series. */
  readonly dailyChallengeLength: number;
  /** Whether a free practice answer counts towards the daily goal. */
  readonly practiceCountsForDaily: boolean;
  /** Words rebuilt from tiles: long enough to be a puzzle, short enough to fit a phone. */
  readonly tileWordMinLetters: number;
  readonly tileWordMaxLetters: number;
  /** Letters added to the tiles that belong to no word. */
  readonly decoyLetters: number;
  /** In demanding practice, the percentage of questions where the word is spelled out. */
  readonly hardSpelledPercent: number;
  readonly pairsWords: number;
  /** A series ends with a round of pairs from this many questions. */
  readonly pairsMinQuestions: number;
}

export type PracticeSchedule = readonly [PracticeRules, ...PracticeRules[]];

export function practiceRulesAt(schedule: PracticeSchedule, time: EpochMs): PracticeRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** Longest list of cards a client may send for a series, from a filter of the album. */
export const PRACTICE_MAX_CARDS = 50;

/**
 * Words of a series: due words first (most overdue first), then words never reviewed, then a
 * random pick among the others, which are the only free practice.
 */
export function planPractice(
  random: RandomSource,
  due: readonly string[],
  neverReviewed: readonly string[],
  others: readonly string[],
  size: number,
): { readonly counted: readonly string[]; readonly free: readonly string[] } {
  const counted = [...due, ...neverReviewed].slice(0, size);
  const pool = [...others];
  const free: string[] = [];
  while (counted.length + free.length < size && pool.length > 0) {
    const [picked] = pool.splice(randomInt(random, pool.length), 1);
    if (picked !== undefined) free.push(picked);
  }
  return { counted, free };
}

/** A word the review may ask. */
export interface ReviewCandidate {
  readonly cardId: string;
  /** When the word is due; `null` when it was never reviewed. */
  readonly due: EpochMs | null;
  readonly obtainedAt: EpochMs;
  /** Recall FSRS predicts now (see `recallProbability`); `null` when never reviewed. */
  readonly recall: number | null;
}

export interface ReviewItem {
  readonly cardId: string;
  /** A review that counts: the word is due, or new and within the day's new words. */
  readonly counted: boolean;
  /** Never reviewed: the player meets it for the first time. */
  readonly fresh: boolean;
}

/**
 * The words of a review series, in the order asked.
 *
 * Words due come first, most overdue first. The day's new words, most recently obtained first
 * (the player remembers best the card they just revealed), take one question in `newWordEvery`
 * while words are due, then fill the series. Free practice completes it, picked among the words
 * whose predicted recall is lowest; a word never reviewed, beyond the day's new words, comes after
 * every word already reviewed. `first`, a word the player chose, opens the series.
 */
export function planReview(
  random: RandomSource,
  rules: PracticeRules,
  input: {
    readonly candidates: readonly ReviewCandidate[];
    readonly now: EpochMs;
    readonly size: number;
    readonly newWordsLeft: number;
    readonly first?: string | undefined;
  },
): readonly ReviewItem[] {
  const { candidates, now, size } = input;
  const due = candidates
    .filter((word) => word.due !== null && word.due <= now)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  const fresh = candidates
    .filter((word) => word.due === null)
    .sort((a, b) => b.obtainedAt - a.obtainedAt || a.cardId.localeCompare(b.cardId))
    .slice(0, Math.max(0, input.newWordsLeft));

  const firstWord = candidates.find((word) => word.cardId === input.first);
  const firstCounts =
    firstWord !== undefined && (due.includes(firstWord) || fresh.includes(firstWord));
  const items: ReviewItem[] = [];
  const taken = new Set<string>();
  const take = (word: ReviewCandidate, counted: boolean) => {
    items.push({ cardId: word.cardId, counted, fresh: word.due === null });
    taken.add(word.cardId);
  };
  if (firstWord !== undefined) take(firstWord, firstCounts);

  const dueLeft = due.filter((word) => !taken.has(word.cardId));
  const freshLeft = fresh.filter((word) => !taken.has(word.cardId));
  while (items.length < size && (dueLeft.length > 0 || freshLeft.length > 0)) {
    const freshTurn = (items.length + 1) % rules.newWordEvery === 0;
    const next =
      dueLeft.length > 0 && (!freshTurn || freshLeft.length === 0)
        ? dueLeft.shift()
        : freshLeft.shift();
    if (next !== undefined) take(next, true);
  }

  const free =
    items.length >= size ? [] : pickFragile(random, rules, candidates, taken, size - items.length);
  for (const word of free) take(word, false);
  return items;
}

/** `count` words among the most fragile ones not taken, in random order. */
function pickFragile(
  random: RandomSource,
  rules: PracticeRules,
  candidates: readonly ReviewCandidate[],
  taken: ReadonlySet<string>,
  count: number,
): ReviewCandidate[] {
  const pool = candidates
    .filter((word) => !taken.has(word.cardId))
    .sort((a, b) => (a.recall ?? 2) - (b.recall ?? 2))
    .slice(0, count * rules.fragilePool);
  const picked: ReviewCandidate[] = [];
  while (picked.length < count && pool.length > 0) {
    const [word] = pool.splice(randomInt(random, pool.length), 1);
    if (word !== undefined) picked.push(word);
  }
  return picked;
}

/** XP of a free practice answer: what is left of today's cap, at most one answer's worth. */
export function practiceXp(
  rules: PracticeRules,
  input: { readonly correct: boolean; readonly earnedToday: number },
): number {
  if (!input.correct) return 0;
  return Math.max(0, Math.min(rules.xpPerAnswer, rules.dailyXpCap - input.earnedToday));
}
