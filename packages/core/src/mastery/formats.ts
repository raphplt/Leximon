/**
 * How each word of a review series is asked. A word that can rise is typed, the only proof of
 * memory (it alone raises the level). A new word, met right after its card, is asked its
 * definition. The others get one of the formats the player kept: the two multiple choices, the
 * word only heard, the word rebuilt from its letters. In free practice, the « demanding »
 * difficulty asks often to spell the word and draws wrong choices close to the answer; a review
 * that counts never changes with it, so that the memory model measures the same for everyone.
 */

import { type RandomSource, randomInt } from "../random";
import { pickDistinct, type QuizFormat, type SpelledFormat } from "./challenge";
import type { PracticeRules } from "./practice";

export const REVIEW_DIFFICULTIES = ["normal", "hard"] as const;
export type ReviewDifficulty = (typeof REVIEW_DIFFICULTIES)[number];

/** The formats a player kept, and their difficulty. The two multiple choices are always kept. */
export interface FormatChoices {
  readonly listen: boolean;
  readonly letters: boolean;
  readonly difficulty: ReviewDifficulty;
}

export type AskedFormat = QuizFormat | SpelledFormat;

/** Letters only, as many as tiles can hold: no spaces, hyphens or apostrophes to place. */
export function canSpellWithTiles(rules: PracticeRules, word: string): boolean {
  const letters = [...word];
  return (
    /^\p{L}+$/u.test(word) &&
    letters.length >= rules.tileWordMinLetters &&
    letters.length <= rules.tileWordMaxLetters
  );
}

export function pickFormat(
  random: RandomSource,
  rules: PracticeRules,
  word: {
    readonly counted: boolean;
    readonly fresh: boolean;
    readonly rising: boolean;
    readonly spellable: boolean;
  },
  choices: FormatChoices,
): AskedFormat {
  if (word.counted && word.rising) return "typed";
  if (word.fresh) return "definition";
  const tiles = choices.letters && word.spellable;
  if (
    !word.counted &&
    choices.difficulty === "hard" &&
    randomInt(random, 100) < rules.hardSpelledPercent
  ) {
    return tiles && randomInt(random, 2) === 0 ? "letters" : "typed";
  }
  const pool: AskedFormat[] = ["definition", "word"];
  if (choices.listen) pool.push("listen");
  if (tiles) pool.push("letters");
  return pool[randomInt(random, pool.length)] ?? "definition";
}

/**
 * The tiles of a word to rebuild: its letters, lowercased, and a few decoys, shuffled so that
 * the word never reads in order.
 */
export function letterTiles(
  random: RandomSource,
  rules: PracticeRules,
  word: string,
): readonly string[] {
  const letters = [...word.toLocaleLowerCase("fr")];
  const decoys = Array.from(
    { length: rules.decoyLetters },
    () => DECOY_LETTERS[randomInt(random, DECOY_LETTERS.length)] ?? "e",
  );
  const tiles = [...letters, ...decoys];
  for (let attempt = 0; attempt < 5; attempt++) {
    shuffle(random, tiles);
    if (tiles.slice(0, letters.length).join("") !== letters.join("")) break;
  }
  return tiles;
}

/** Common letters of French, so that a decoy does not stand out. */
const DECOY_LETTERS = [..."eeeaaiinnorsstuulcdmp"];

function shuffle(random: RandomSource, items: string[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    const kept = items[i] as string;
    items[i] = items[j] as string;
    items[j] = kept;
  }
}

/**
 * Where the wrong choices of a demanding question come from: the words of the same theme that
 * start with the same letter, or else of the same theme, or else of the same collection, the
 * first of these with enough words for a full set of choices.
 */
export function closeChoicePool(
  cardId: string,
  initialOf: (cardId: string) => string,
  sameTheme: readonly string[],
  sameCollection: readonly string[],
  needed: number,
): readonly string[] {
  const initial = initialOf(cardId);
  const others = sameTheme.filter((id) => id !== cardId);
  const close = others.filter((id) => initialOf(id) === initial);
  if (close.length >= needed) return close;
  if (others.length >= needed) return others;
  return sameCollection;
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
