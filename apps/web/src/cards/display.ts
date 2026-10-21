/** How card values are shown: pure functions, shared by every screen that draws a card. */

import { capitalize } from "../lib/pack-shape";

const WORD_MAX_SIZE = 34;
const WORD_MIN_SIZE = 18;
/** Width available to the word on the reference card, in px, with a small safety margin. */
const WORD_LINE_WIDTH = 252;
const WORD_LETTER_SPACING = -0.015;
/** Advance widths of Fraunces Black (SOFT 100) lowercase glyphs, in em, measured at 24 px. */
const LETTER_WIDTHS: Readonly<Record<string, number>> = {
  a: 0.594,
  b: 0.642,
  c: 0.55,
  d: 0.652,
  e: 0.554,
  f: 0.46,
  g: 0.61,
  h: 0.678,
  i: 0.347,
  j: 0.346,
  k: 0.655,
  l: 0.347,
  m: 0.993,
  n: 0.678,
  o: 0.616,
  p: 0.657,
  q: 0.642,
  r: 0.524,
  s: 0.539,
  t: 0.445,
  u: 0.666,
  v: 0.59,
  w: 0.907,
  x: 0.613,
  y: 0.609,
  z: 0.551,
  æ: 0.853,
  œ: 0.922,
  "-": 0.397,
  "'": 0.22,
  "’": 0.22,
  " ": 0.203,
};
/** For any glyph missing above: as wide as an "n". */
const DEFAULT_LETTER_WIDTH = 0.678;

/** Width of `word` set in the card's display font, in em. Accents do not change the width. */
function wordWidthEm(word: string): number {
  let width = 0;
  for (const letter of word.toLowerCase()) {
    const base = letter.normalize("NFD").replace(/\p{M}/gu, "");
    width +=
      (LETTER_WIDTHS[letter] ?? LETTER_WIDTHS[base] ?? DEFAULT_LETTER_WIDTH) + WORD_LETTER_SPACING;
  }
  return width;
}

/**
 * Font size of the word on the reference card, in px: the word stays on one line, shrinking
 * for long words rather than breaking mid-word. Beyond the minimum, the word may wrap.
 */
export function wordFontSize(word: string): number {
  const fitting = Math.floor(WORD_LINE_WIDTH / Math.max(wordWidthEm(word), 0.01));
  return Math.max(WORD_MIN_SIZE, Math.min(WORD_MAX_SIZE, fitting));
}

/**
 * Discreet frequency figure printed on a card (P22): "one occurrence in N words", e.g.
 * "1/3,6 M" or "1/7,7 Md". Below what Ngram measures, "< 1/Md".
 */
export function formatOdds(perBillion: number | null): string {
  if (perBillion === null || perBillion <= 0) return "< 1/Md";
  const oneIn = 1e9 / perBillion;
  if (oneIn >= 1e9) return `1/${twoDigits(oneIn / 1e9)} Md`;
  if (oneIn >= 1e6) return `1/${twoDigits(oneIn / 1e6)} M`;
  return `1/${twoDigits(oneIn / 1e3)} k`;
}

/**
 * The same figure as a sentence, for the reveal and the share text: "Un mot imprimé sur
 * 17 milliards." Below what Ngram measures, the word is simply not found in today's books.
 */
export function frequencyLine(perBillion: number | null): string {
  if (perBillion === null || perBillion <= 0) return "Introuvable dans les livres d'aujourd'hui.";
  const oneIn = 1e9 / perBillion;
  if (oneIn >= 1e9) return `Un mot imprimé sur ${largeCount(oneIn / 1e9, "milliard")}.`;
  if (oneIn >= 1e6) return `Un mot imprimé sur ${largeCount(oneIn / 1e6, "million")}.`;
  const rounded = Number(oneIn.toPrecision(2)).toLocaleString("fr-FR").replace(/\s/g, "\u00a0");
  return `Un mot imprimé sur ${rounded}.`;
}

/** What a player shares on a Légendaire: the word first, its rarity, then the boast. */
export function shareText(word: string, perBillion: number | null): string {
  return `${capitalize(word)}. ${frequencyLine(perBillion)} Moi, je l'ai.`;
}

/** "1 milliard", "1,5 milliard", "17 milliards": the noun takes an s from 2 on. */
function largeCount(value: number, noun: string): string {
  const rounded = Number(value.toPrecision(2));
  return `${twoDigits(value)}\u00a0${noun}${rounded >= 2 ? "s" : ""}`;
}

/** Two significant digits, French decimal comma, no trailing zero. */
function twoDigits(value: number): string {
  const rounded = Number(value.toPrecision(2));
  return rounded.toLocaleString("fr-FR", { maximumFractionDigits: 1 }).replace(/\s/g, " ");
}
