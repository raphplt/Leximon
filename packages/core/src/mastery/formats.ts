/**
 * How each word of a review series is asked. A word that can rise is typed, the only proof of
 * memory (it alone raises the level). A new word, met right after its card, is asked its
 * definition. The others get one of the formats the player kept: the two multiple choices, or the
 * word only heard. In free practice, the « demanding » difficulty asks often to type the word
 * and draws wrong choices close to the answer; a review
 * that counts never changes with it, so that the memory model measures the same for everyone.
 */

import { type RandomSource, randomInt } from "../random";
import { pickDistinct, type QuizFormat } from "./challenge";
import type { PracticeRules } from "./practice";

export const REVIEW_DIFFICULTIES = ["normal", "hard"] as const;
export type ReviewDifficulty = (typeof REVIEW_DIFFICULTIES)[number];

/** The formats a player kept, and their difficulty. The two multiple choices are always kept. */
export interface FormatChoices {
  readonly listen: boolean;
  readonly difficulty: ReviewDifficulty;
}

export type AskedFormat = QuizFormat | "typed";

export function pickFormat(
  random: RandomSource,
  rules: PracticeRules,
  word: {
    readonly counted: boolean;
    readonly fresh: boolean;
    readonly rising: boolean;
  },
  choices: FormatChoices,
): AskedFormat {
  if (word.counted && word.rising) return "typed";
  if (word.fresh) return "definition";
  if (
    !word.counted &&
    choices.difficulty === "hard" &&
    randomInt(random, 100) < rules.hardSpelledPercent
  ) {
    return "typed";
  }
  const pool: AskedFormat[] = ["definition", "word"];
  if (choices.listen) pool.push("listen");
  return pool[randomInt(random, pool.length)] ?? "definition";
}

/**
 * Where the wrong choices of a demanding question come from before the collection, nearest first:
 * the words of the same theme that start with the same letter, then the rest of the theme.
 */
export function closeChoicePools(
  cardId: string,
  initialOf: (cardId: string) => string,
  sameTheme: readonly string[],
): readonly (readonly string[])[] {
  const initial = initialOf(cardId);
  const others = sameTheme.filter((id) => id !== cardId);
  return [others.filter((id) => initialOf(id) === initial), others];
}

/**
 * The words of a round of pairs: the word asked and others the player owns, all different, or
 * `null` when there are not enough.
 */
export function pairsCards(
  random: RandomSource,
  rules: PracticeRules,
  cardId: string,
  owned: readonly string[],
): readonly string[] | null {
  const others = pickDistinct(
    random,
    owned.filter((id) => id !== cardId),
    rules.pairsWords - 1,
  );
  return others.length < rules.pairsWords - 1 ? null : [cardId, ...others];
}

/** A round of pairs ends a series long enough, in place of its last practice question. */
export function endsWithPairs(
  rules: PracticeRules,
  series: readonly { readonly counted: boolean }[],
): boolean {
  const last = series.at(-1);
  return series.length >= rules.pairsMinQuestions && last !== undefined && !last.counted;
}
