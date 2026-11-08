/**
 * Challenge questions on a word the player owns. Multiple choice, "definition": the word is shown,
 * pick its definition; "word": the definition is shown, pick the word. Wrong choices come from
 * other cards, preferably of the same collection. "typed": the definition is shown, type the word,
 * asked when a right answer can raise the level.
 */

import { type RandomSource, randomInt } from "../random";
import type { AnswerGrade, MasteryRules } from "./mastery";

/**
 * Every way a word is asked. "listen": the word is only heard, pick its definition. "pairs": four
 * words and their definitions to match, practice only.
 */
export const CHALLENGE_FORMATS = ["definition", "word", "typed", "listen", "pairs"] as const;
export type ChallengeFormat = (typeof CHALLENGE_FORMATS)[number];
/** The two multiple choices of the first clients, still the only ones of `GET /challenges`. */
export const CHOICE_FORMATS = ["definition", "word"] as const;
export type ChoiceFormat = (typeof CHOICE_FORMATS)[number];
/** Multiple choices of the review: four cards, one of them the answer. */
export const QUIZ_FORMATS = ["definition", "word", "listen"] as const;
export type QuizFormat = (typeof QUIZ_FORMATS)[number];

export const CHOICES_PER_QUESTION = 4;
/** Longest text accepted as a typed answer; the longest word of the catalog has 18 letters. */
export const TYPED_ANSWER_MAX_LENGTH = 60;

export interface ChoiceQuestion<F extends QuizFormat = QuizFormat> {
  readonly cardId: string;
  readonly format: F;
  /** Card ids, in display order; the answer is one of them. */
  readonly choices: readonly string[];
  readonly answerIndex: number;
}

export interface TypedQuestion {
  readonly cardId: string;
  readonly format: "typed";
}

/** A question of the first clients' sessions. */
export type Question = ChoiceQuestion<ChoiceFormat> | TypedQuestion;

/**
 * A word reduced to its letters for comparing a typed answer: case, accents, ligatures, spaces
 * and punctuation ignored.
 */
export function normalizeWord(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .replaceAll(/[^\p{L}\p{N}]/gu, "");
}

const HIDDEN = "…";

/**
 * The definition shown when the word is to be found: words of the same family hidden, so that
 * « Petit du renard » does not give away *renardeau*. A word of the definition is hidden when it
 * starts like the card's word over 5 letters or 60 % of it, whichever is longer, or over all of a
 * shorter word. Prefixed words are caught too: « Apaiser de nouveau » for *rapaiser*, « contraire
 * d'impeccable » for *peccable*.
 */
export function hideWordIn(definition: string, word: string): string {
  const target = normalizeWord(word);
  const needed = Math.min(target.length, Math.max(5, Math.ceil(target.length * 0.6)));
  return definition.replaceAll(/[\p{L}\p{M}]+/gu, (token) => {
    const normalized = normalizeWord(token);
    const family =
      sharedPrefix(normalized, target) >= needed ||
      stemInside(normalized, target) ||
      (target.length >= 5 && normalized.includes(target));
    return family ? HIDDEN : token;
  });
}

/**
 * The token, or its stem cut of one or two final letters (*menottes* in *emmenotter*), stands
 * inside the word over 5 letters at least and half of the word.
 */
function stemInside(token: string, word: string): boolean {
  const shortest = Math.max(5, token.length - 2, Math.ceil(word.length / 2));
  for (let length = token.length; length >= shortest; length--) {
    if (word.includes(token.slice(0, length))) return true;
  }
  return false;
}

function sharedPrefix(a: string, b: string): number {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
}

/**
 * Grades a typed answer. Right when it matches the word, case and accents aside. One slip (a
 * letter missing, extra, wrong, or two letters swapped) still counts as right, graded "hard", on a
 * word long enough, unless the text typed is another word of the catalog: `catalogWords` holds
 * every word, normalized.
 */
export function gradeTyped(
  rules: MasteryRules,
  typed: string,
  word: string,
  catalogWords: ReadonlySet<string>,
): AnswerGrade {
  const answer = normalizeWord(typed);
  const expected = normalizeWord(word);
  if (answer === expected) return "good";
  if (expected.length < rules.slipToleranceFromLetters || catalogWords.has(answer)) return "again";
  return oneSlipApart(answer, expected) ? "hard" : "again";
}

/** Distinct texts one edit apart: a letter inserted, deleted or replaced, or two adjacent swapped. */
function oneSlipApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    );
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/**
 * Builds one question, of `format` or of a format drawn at random. `pools` hold the other cards to
 * pick wrong choices from, nearest first: each is drawn from before the next, and the card itself
 * is ignored if present. Returns `null` when they are too small for a full set of choices.
 */
export function buildQuestion(
  random: RandomSource,
  cardId: string,
  pools: readonly (readonly string[])[],
): ChoiceQuestion<ChoiceFormat> | null;
export function buildQuestion<F extends QuizFormat>(
  random: RandomSource,
  cardId: string,
  pools: readonly (readonly string[])[],
  format: F,
): ChoiceQuestion<F> | null;
export function buildQuestion(
  random: RandomSource,
  cardId: string,
  pools: readonly (readonly string[])[],
  format?: QuizFormat,
): ChoiceQuestion | null {
  const needed = CHOICES_PER_QUESTION - 1;
  const taken = new Set([cardId]);
  const wrong: string[] = [];
  for (const pool of pools) {
    if (wrong.length === needed) break;
    const drawn = pickDistinct(
      random,
      pool.filter((id) => !taken.has(id)),
      needed - wrong.length,
    );
    for (const id of drawn) taken.add(id);
    wrong.push(...drawn);
  }
  if (wrong.length < needed) return null;

  const answerIndex = randomInt(random, CHOICES_PER_QUESTION);
  const choices = [...wrong];
  choices.splice(answerIndex, 0, cardId);
  const drawn = format ?? CHOICE_FORMATS[randomInt(random, CHOICE_FORMATS.length)] ?? "definition";
  return { cardId, format: drawn, choices, answerIndex };
}

/**
 * The broad class of a word, read from the part of speech its card prints. Choices of one class
 * keep a player from finding the answer by elimination, a verb among nouns for instance.
 */
export type WordClass = "noun" | "verb" | "adjective" | "other";

export function wordClassOf(partOfSpeech: string): WordClass {
  // A phrase is classed by what it stands for: « loc. v. » is a verb.
  const head =
    partOfSpeech
      .trim()
      .replace(/^loc\.\s*/, "")
      .split(/[\s.]/, 1)[0] ?? "";
  if (head === "n" || head === "nom") return "noun";
  if (head === "v" || head === "verb") return "verb";
  if (head === "adj") return "adjective";
  return "other";
}

/**
 * The pools of a question's wrong choices with the words of the card's class first: the class
 * within each pool, nearest first, then each pool whatever the class, so that a rare class still
 * makes a full question. A card of unknown class keeps its pools.
 */
export function sameClassFirst(
  cardId: string,
  classOf: (cardId: string) => WordClass | undefined,
  pools: readonly (readonly string[])[],
): readonly (readonly string[])[] {
  const wordClass = classOf(cardId);
  if (wordClass === undefined) return pools;
  return [...pools.map((pool) => pool.filter((id) => classOf(id) === wordClass)), ...pools];
}

/**
 * The other multiple choice format: a word missed comes back asked the other way round. A word
 * heard or shown comes back as its definition to name; a word to find, as its word to define.
 */
export function otherChoiceFormat(format: ChallengeFormat): ChoiceFormat {
  return format === "definition" || format === "listen" ? "word" : "definition";
}

/** Up to `count` distinct items, uniformly (partial Fisher-Yates on a copy). */
export function pickDistinct(
  random: RandomSource,
  items: readonly string[],
  count: number,
): string[] {
  const copy = [...items];
  const picked: string[] = [];
  for (let i = 0; i < count && i < copy.length; i++) {
    const j = i + randomInt(random, copy.length - i);
    const chosen = copy[j] as string;
    copy[j] = copy[i] as string;
    copy[i] = chosen;
    picked.push(chosen);
  }
  return picked;
}

/** Words of a session: due reviews first (most overdue first), then words never reviewed. */
export function planSession(
  due: readonly string[],
  neverReviewed: readonly string[],
  size: number,
): string[] {
  const words = [...due];
  for (const word of neverReviewed) {
    if (words.length >= size) break;
    if (!words.includes(word)) words.push(word);
  }
  return words.slice(0, size);
}
