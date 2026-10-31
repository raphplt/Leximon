/**
 * The riddle of the day: the same word for everyone, to be typed. Its nature and length are shown
 * at once; each wrong answer, or a request, then uncovers a clue, then a letter. The last wrong
 * answer ends the game. Found, it earns XP and the card, a gift known in advance, not a draw.
 */

import type { Rarity } from "../booster/rarity";
import type { EpochMs } from "../booster/refill";
import { hideWordIn } from "../mastery/challenge";
import { type RandomSource, randomInt } from "../random";

export interface RiddleRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  /** Rarities a riddle's word comes from, to keep it within reach. */
  readonly rarities: readonly Rarity[];
  readonly minLetters: number;
  readonly maxLetters: number;
  /** A shorter definition cannot be cut into a clue. */
  readonly minDefinitionWords: number;
  /** Letters uncovered, from the first one, once the clues have run out. */
  readonly lettersShown: number;
  readonly xp: number;
}

export type RiddleSchedule = readonly [RiddleRules, ...RiddleRules[]];

export function riddleRulesAt(schedule: RiddleSchedule, time: EpochMs): RiddleRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export const RIDDLE_OUTCOMES = ["found", "lost"] as const;
export type RiddleOutcome = (typeof RIDDLE_OUTCOMES)[number];

/** The opening of the definition, the definition, its etymology. */
export const RIDDLE_CLUES = 3;

/** What a riddle shows, hidden words already taken out. */
export interface RiddleClues {
  readonly partOfSpeech: string;
  readonly opening: string;
  readonly definition: string;
  readonly etymology: string;
}

export interface RiddleCandidate {
  readonly word: string;
  readonly rarity: Rarity;
  readonly partOfSpeech: string;
  readonly definition: string;
  readonly etymology: string | null;
}

const CLAUSE_END = /[,;:]/;
/** The opening stops short of these words: « Cordage cousu en… » reads as a slip. */
const DANGLING =
  /^(à|au|aux|avec|ce|ces|cette|dans|de|des|dont|du|elle|elles|en|et|il|ils|la|le|les|l|d|on|ou|par|pour|qu|qui|que|sa|se|ses|son|sur|un|une|…|[,;:])$/i;
const OPENING_MIN_SHARE = 0.25;
const OPENING_MAX_SHARE = 0.6;
const OPENING_CUT_SHARE = 0.45;

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/**
 * The start of a definition, as a first clue: its first clause when that leaves something to
 * uncover, or else its first words. Always at least one word short of the definition.
 */
export function definitionOpening(definition: string): string {
  const words = wordsOf(definition);
  const fromShare = (share: number) => Math.max(1, Math.round(words.length * share));
  const clause = words.findIndex(
    (word, index) =>
      index + 1 >= fromShare(OPENING_MIN_SHARE) &&
      index + 1 <= fromShare(OPENING_MAX_SHARE) &&
      CLAUSE_END.test(word.at(-1) ?? ""),
  );
  let kept = clause === -1 ? fromShare(OPENING_CUT_SHARE) : clause + 1;
  kept = Math.min(kept, words.length - 1);
  while (kept > 1 && DANGLING.test((words[kept - 1] ?? "").replace(/.*['’]/, ""))) kept--;
  return `${words
    .slice(0, kept)
    .join(" ")
    .replace(/[\s,;:…]+$/, "")}…`;
}

/** The clues of a word, or `null` when it does not make a fair riddle. */
export function riddleCluesOf(rules: RiddleRules, card: RiddleCandidate): RiddleClues | null {
  const letters = [...card.word].length;
  if (
    card.etymology === null ||
    !rules.rarities.includes(card.rarity) ||
    letters < rules.minLetters ||
    letters > rules.maxLetters ||
    !/^\p{L}+$/u.test(card.word) ||
    wordsOf(card.definition).length < rules.minDefinitionWords
  ) {
    return null;
  }
  const definition = hideWordIn(card.definition, card.word);
  return {
    partOfSpeech: card.partOfSpeech,
    opening: definitionOpening(definition),
    definition,
    etymology: hideWordIn(card.etymology, card.word),
  };
}

/** A word never asked yet, then any word: the catalogue would have to run out first. */
export function pickRiddleWord(
  random: RandomSource,
  candidates: readonly string[],
  used: ReadonlySet<string>,
): string | null {
  const fresh = candidates.filter((cardId) => !used.has(cardId));
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool.length === 0 ? null : (pool[randomInt(random, pool.length)] ?? null);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayIndex(dayKey: string): number {
  return Math.round(Date.parse(`${dayKey}T00:00:00Z`) / DAY_MS);
}

/** The number of a day's riddle: 1 on `firstDay`. */
export function riddleNumber(firstDay: string, dayKey: string): number {
  return dayIndex(dayKey) - dayIndex(firstDay) + 1;
}

/** The day of a riddle's number. */
export function riddleDay(firstDay: string, number: number): string {
  return new Date((dayIndex(firstDay) + number - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** The highest step: every clue and letter uncovered. One more wrong answer ends the game. */
export function lastRiddleStep(rules: RiddleRules): number {
  return RIDDLE_CLUES + rules.lettersShown;
}

/** One answer: `found`, or a wrong answer or a request for a clue, which cost the same. */
export function advanceRiddle(
  rules: RiddleRules,
  step: number,
  found: boolean,
): { readonly step: number; readonly outcome: RiddleOutcome | null } {
  if (found) return { step, outcome: "found" };
  if (step >= lastRiddleStep(rules)) return { step, outcome: "lost" };
  return { step: step + 1, outcome: null };
}

export interface RiddleReveal {
  readonly opening: string | null;
  readonly definition: string | null;
  readonly etymology: string | null;
  /** The first letters of the word, as written on the card. */
  readonly letters: string;
}

/** What the player may read at this step. A finished game shows every clue. */
export function riddleReveal(
  clues: RiddleClues,
  word: string,
  step: number,
  finished: boolean,
): RiddleReveal {
  const seen = (clue: number) => finished || step >= clue;
  return {
    opening: seen(1) ? clues.opening : null,
    definition: seen(2) ? clues.definition : null,
    etymology: seen(3) ? clues.etymology : null,
    letters: finished ? word : [...word].slice(0, Math.max(0, step - RIDDLE_CLUES)).join(""),
  };
}
