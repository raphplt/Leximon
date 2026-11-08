/**
 * Library editions: how a patron's card prints its engraving. The engraving is pasted on the card
 * as a plate of its own paper, in the edition's inks; the frame, the gem and the word keep the
 * rarity's colours, so that an edition never passes a card off as rarer than it is.
 */
export interface CardEdition {
  /** The plate's paper, under the engraving. */
  readonly paper: string;
  /** The lines. */
  readonly ink: string;
  /** The dark masses, printed out of register beside the lines. */
  readonly plate: string;
  readonly plateOpacity: number;
}

export const cardEditions: Readonly<Record<string, CardEdition>> = {
  sanguine: { paper: "#F4E7D7", ink: "#843A28", plate: "#D9A08A", plateOpacity: 0.75 },
  lavis: { paper: "#F2F0EA", ink: "#2E3A45", plate: "#8FA3B3", plateOpacity: 0.7 },
  encre: { paper: "#FFFDF7", ink: "#141210", plate: "#BDB5A8", plateOpacity: 0.55 },
};

/** The edition's colours, or `null` for an id this version does not know: it prints ordinary. */
export function editionColors(id: string | null | undefined): CardEdition | null {
  return id == null ? null : (cardEditions[id] ?? null);
}
