/**
 * The round of pairs, matched by hand rather than picked: its state lives here, the screens only
 * draw it.
 */

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
