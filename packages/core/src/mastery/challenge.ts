/**
 * Challenge questions on a word the player owns. Multiple choice, "definition": the word is shown,
 * pick its definition; "word": the definition is shown, pick the word. Wrong choices come from
 * other cards, preferably of the same collection. "typed": the definition is shown, type the word,
 * asked when a right answer can raise the level.
 */

import { type RandomSource, randomInt } from "../random";
import type { AnswerGrade, MasteryRules } from "./mastery";

export const CHALLENGE_FORMATS = ["definition", "word", "typed"] as const;
export type ChallengeFormat = (typeof CHALLENGE_FORMATS)[number];
export const CHOICE_FORMATS = ["definition", "word"] as const;
export type ChoiceFormat = (typeof CHOICE_FORMATS)[number];

export const CHOICES_PER_QUESTION = 4;
/** Longest text accepted as a typed answer; the longest word of the catalog has 18 letters. */
export const TYPED_ANSWER_MAX_LENGTH = 60;

export interface ChoiceQuestion {
  readonly cardId: string;
  readonly format: ChoiceFormat;
  /** Card ids, in display order; the answer is one of them. */
  readonly choices: readonly string[];
  readonly answerIndex: number;
}

export interface TypedQuestion {
  readonly cardId: string;
  readonly format: "typed";
}

export type Question = ChoiceQuestion | TypedQuestion;

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
 * Builds one question, of `format` or of a format drawn at random. `sameCollection` and
 * `wholeCatalog` are the other cards to pick wrong choices from, in order of preference; the card
 * itself is ignored if present. Returns `null` when the catalog is too small for a full set of
 * choices.
 */
export function buildQuestion(
  random: RandomSource,
  cardId: string,
  sameCollection: readonly string[],
  wholeCatalog: readonly string[],
  format?: ChoiceFormat,
): ChoiceQuestion | null {
  const wrong = pickDistinct(
    random,
    sameCollection.filter((id) => id !== cardId),
    CHOICES_PER_QUESTION - 1,
  );
  if (wrong.length < CHOICES_PER_QUESTION - 1) {
    const taken = new Set([cardId, ...wrong]);
    const more = wholeCatalog.filter((id) => !taken.has(id));
    wrong.push(...pickDistinct(random, more, CHOICES_PER_QUESTION - 1 - wrong.length));
  }
  if (wrong.length < CHOICES_PER_QUESTION - 1) return null;

  const answerIndex = randomInt(random, CHOICES_PER_QUESTION);
  const choices = [...wrong];
  choices.splice(answerIndex, 0, cardId);
  const drawn = format ?? CHOICE_FORMATS[randomInt(random, CHOICE_FORMATS.length)] ?? "definition";
  return { cardId, format: drawn, choices, answerIndex };
}

/** The other multiple choice format: a word missed comes back asked the other way round. */
export function otherChoiceFormat(format: ChallengeFormat): ChoiceFormat {
  return format === "definition" ? "word" : "definition";
}

/** Up to `count` distinct items, uniformly (partial Fisher-Yates on a copy). */
function pickDistinct(random: RandomSource, items: readonly string[], count: number): string[] {
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
