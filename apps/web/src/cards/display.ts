/** How the word is set on a card: font metrics of the web display font. */

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
