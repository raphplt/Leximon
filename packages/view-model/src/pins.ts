import { type Rarity, rarityRank } from "@leximon/core";
import { foldSearch } from "./album";
import { compareFrench, plural } from "./format";

/**
 * The cards pinned on the player's profile: which to pin, in which place, in which order.
 * The server checks that the player owns them and has the places; these only arrange the list.
 */

/** « 3 places », next to the pinned cards. */
export function pinnedSlotsLabel(slots: number): string {
  return plural(slots, "place", "places");
}

export type PinChange =
  | { readonly ok: true; readonly cardIds: string[] }
  | { readonly ok: false; readonly reason: "full" };

/**
 * Puts a card in a place: `at` replaces the card there, `null` takes the first free place.
 * A card already pinned elsewhere swaps with the one it replaces.
 */
export function placePin(
  pinned: readonly string[],
  slots: number,
  cardId: string,
  at: number | null,
): PinChange {
  const current = pinned.indexOf(cardId);
  if (at === null || at >= pinned.length) {
    if (current !== -1) return { ok: true, cardIds: [...pinned] };
    if (pinned.length >= slots) return { ok: false, reason: "full" };
    return { ok: true, cardIds: [...pinned, cardId] };
  }
  const cardIds = [...pinned];
  const replaced = cardIds[at];
  cardIds[at] = cardId;
  if (current !== -1 && replaced !== undefined) cardIds[current] = replaced;
  return { ok: true, cardIds };
}

/** Moves the card at `index` one place earlier (-1) or later (1); at an end, nothing moves. */
export function movePin(pinned: readonly string[], index: number, step: -1 | 1): string[] {
  const target = index + step;
  const cardIds = [...pinned];
  const moving = cardIds[index];
  const other = cardIds[target];
  if (moving === undefined || other === undefined) return cardIds;
  cardIds[index] = other;
  cardIds[target] = moving;
  return cardIds;
}

export function unpin(pinned: readonly string[], cardId: string): string[] {
  return pinned.filter((id) => id !== cardId);
}

export interface PinCandidate {
  readonly cardId: string;
  readonly word: string;
  readonly rarity: Rarity;
  /** Already on the profile. */
  readonly pinned: boolean;
}

/** How many cards the picker lists at once; a search narrows the rest. */
export const PIN_PICKER_LIMIT = 60;

/**
 * The cards the player can pin, rarest first then alphabetical, those matching the search
 * (« ecrou » finds « Écrouelles »); the ones already pinned come last, they are not a choice.
 * `more` counts those left out by the limit.
 */
export function pinCandidates(
  cards: Iterable<{ readonly id: string; readonly word: string; readonly rarity: Rarity }>,
  owned: ReadonlyMap<string, number>,
  pinned: readonly string[],
  search: string,
  limit = PIN_PICKER_LIMIT,
): { readonly items: PinCandidate[]; readonly more: number } {
  const wanted = foldSearch(search);
  const matching = [...cards]
    .filter((card) => (owned.get(card.id) ?? 0) > 0)
    .filter((card) => wanted === "" || foldSearch(card.word).includes(wanted))
    .map((card) => ({
      cardId: card.id,
      word: card.word,
      rarity: card.rarity,
      pinned: pinned.includes(card.id),
    }))
    .sort(
      (a, b) =>
        Number(a.pinned) - Number(b.pinned) ||
        rarityRank(b.rarity) - rarityRank(a.rarity) ||
        compareFrench(a.word, b.word),
    );
  return {
    items: matching.slice(0, limit),
    more: Math.max(0, matching.length - limit),
  };
}

export const PIN_TEXTS = {
  pin: "Épingler",
  unpin: "Désépingler",
  emptySlot: "Épingler une carte",
  pickerTitle: "Épingler une carte",
  search: "Chercher un de tes mots",
  noMatch: "Aucun de tes mots ne correspond.",
  noCards: "Pas encore de carte. Ouvre un sachet.",
  alreadyPinned: "Épinglée",
  change: "Changer",
  remove: "Retirer",
  earlier: "Avancer",
  later: "Reculer",
  pinned: "Épinglée à ton profil.",
  replaced: "Remplacée.",
  removed: "Retirée de ton profil.",
  fullTitle: "Tes places sont prises",
} as const;

/** The picker's title when it fills a taken place. */
export function replaceTitle(word: string): string {
  return `Remplacer ${word}`;
}

/** Under the cards listed when the limit leaves some out. */
export function morePinsLine(more: number): string {
  return `Et ${plural(more, "autre carte", "autres cartes")} — utilise la recherche pour tout voir.`;
}

/** Pinning from a card's sheet with every place taken: which one it pushes out. */
export function fullPinsLine(word: string): string {
  return `Laquelle laisse sa place à ${word} ?`;
}
