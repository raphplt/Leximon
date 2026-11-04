/**
 * The two questions played with the hands rather than picked: the word rebuilt from its tiles,
 * and the round of pairs. Their state lives here, the screens only draw it.
 */

// --- Letters -------------------------------------------------------------------------

export interface LettersState {
  /** Indexes of the tiles placed, in order. */
  readonly placed: readonly number[];
}

export const LETTERS_START: LettersState = { placed: [] };

/** How many slots the word takes: its letters, whatever their accents. */
export function letterSlots(word: string): number {
  return [...word].length;
}

export function placeTile(state: LettersState, index: number, slots: number): LettersState {
  if (state.placed.includes(index) || state.placed.length >= slots) return state;
  return { placed: [...state.placed, index] };
}

/** Takes back the tile of a slot and those after it, as one erases from there. */
export function takeBackFrom(state: LettersState, slot: number): LettersState {
  return { placed: state.placed.slice(0, Math.max(0, slot)) };
}

export function lettersSpelled(state: LettersState, tiles: readonly string[]): string {
  return state.placed.map((index) => tiles[index] ?? "").join("");
}

export const LETTERS_HINT =
  "Deux lettres ne servent pas. Touche une lettre placée pour la retirer.";
export const LETTERS_ACTION = "Valider le mot";

// --- Pairs ---------------------------------------------------------------------------

export type PairSide = "word" | "definition";

export interface PairsState {
  readonly matched: readonly string[];
  readonly picked: { readonly side: PairSide; readonly cardId: string } | null;
  readonly mistakes: number;
  /** The last wrong match, to shake it. */
  readonly wrong: { readonly word: string; readonly definition: string } | null;
}

export const PAIRS_START: PairsState = { matched: [], picked: null, mistakes: 0, wrong: null };

/** A word, then a definition (or the other way round): together they match or not. */
export function pickInPairs(state: PairsState, side: PairSide, cardId: string): PairsState {
  if (state.matched.includes(cardId)) return state;
  const { picked } = state;
  if (picked === null || picked.side === side) {
    return { ...state, picked: { side, cardId }, wrong: null };
  }
  if (picked.cardId === cardId) {
    return { ...state, matched: [...state.matched, cardId], picked: null, wrong: null };
  }
  const word = side === "word" ? cardId : picked.cardId;
  const definition = side === "definition" ? cardId : picked.cardId;
  return { ...state, picked: null, mistakes: state.mistakes + 1, wrong: { word, definition } };
}

export function pairsDone(state: PairsState, cards: readonly string[]): boolean {
  return cards.every((cardId) => state.matched.includes(cardId));
}

/** Said once every pair is found. */
export function pairsVerdict(mistakes: number): string {
  if (mistakes === 0) return "Toutes les paires du premier coup.";
  return mistakes === 1
    ? "Toutes les paires, avec une erreur."
    : `Toutes les paires, avec ${mistakes} erreurs.`;
}
