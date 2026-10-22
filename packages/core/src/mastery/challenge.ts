/**
 * Challenge questions: multiple choice on a word the player owns. "definition": the word
 * is shown, pick its definition; "word": the definition is shown, pick the word. Wrong choices
 * come from other cards, preferably of the same collection.
 */

import { type RandomSource, randomInt } from "../random";

export const CHALLENGE_FORMATS = ["definition", "word"] as const;
export type ChallengeFormat = (typeof CHALLENGE_FORMATS)[number];

export const CHOICES_PER_QUESTION = 4;

export interface Question {
  readonly cardId: string;
  readonly format: ChallengeFormat;
  /** Card ids, in display order; the answer is one of them. */
  readonly choices: readonly string[];
  readonly answerIndex: number;
}

/**
 * Builds one question. `sameCollection` and `wholeCatalog` are the other cards to pick wrong
 * choices from, in order of preference; the card itself is ignored if present. Returns `null`
 * when the catalog is too small for a full set of choices.
 */
export function buildQuestion(
  random: RandomSource,
  cardId: string,
  sameCollection: readonly string[],
  wholeCatalog: readonly string[],
): Question | null {
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
  const format = CHALLENGE_FORMATS[randomInt(random, CHALLENGE_FORMATS.length)] ?? "definition";
  return { cardId, format, choices, answerIndex };
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
