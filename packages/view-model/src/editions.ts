import { type EditionsResponse, EMPTY_EDITIONS } from "@leximon/contract";
import { cardEditionOf } from "@leximon/core";

interface EditionWords {
  readonly name: string;
  /** With its article, in a sentence. */
  readonly the: string;
  /** How a print in it is said. */
  readonly printed: string;
}

const EDITION_WORDS: Readonly<Record<string, EditionWords>> = {
  sanguine: { name: "Sanguine", the: "la sanguine", printed: "à la sanguine" },
  lavis: { name: "Lavis", the: "le lavis", printed: "au lavis" },
  encre: { name: "Encre de Chine", the: "l'encre de Chine", printed: "à l'encre de Chine" },
};

/** The name of an edition; an id this version does not know keeps its own. */
export function editionName(id: string): string {
  return EDITION_WORDS[id]?.name ?? id;
}

/** The edition a card prints in, from the player's editions; `null` for the ordinary print. */
export function editionOfCard(editions: EditionsResponse | null, cardId: string): string | null {
  const { owned, album, cards } = editions ?? EMPTY_EDITIONS;
  return cardEditionOf({ album, card: cards[cardId] }, new Set(owned));
}

export const EDITIONS_TITLE = "Édition de bibliothèque";
export const PATRON_EDITIONS_TITLE = "Éditions de bibliothèque";
export const EDITION_PLAIN = "Ordinaire";
export const EDITION_ALBUM_ACTION = "Appliquer à tout l'album";
export const EDITION_FAILED = "Ton choix d'édition n'a pas été enregistré. Réessaie.";
export const EDITIONS_NOTE =
  "Ton profil public montre tes cartes épinglées dans leur édition. Une carte échangée part dans son impression ordinaire.";

export function editionAlbumDone(id: string | null): string {
  if (id === null) return "Tout ton album reprend son impression ordinaire.";
  return `Tout ton album est imprimé ${EDITION_WORDS[id]?.printed ?? `en ${editionName(id)}`}.`;
}

/** On the patron page: the editions owned, and where to use them. */
export function editionsOwnedLine(owned: readonly string[]): string {
  if (owned.length === 0) return "Tes éditions arrivent avec ton premier paiement.";
  const names = owned.map((id) => EDITION_WORDS[id]?.the ?? editionName(id));
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
  return `Tu possèdes ${list}. Choisis l'édition d'une carte depuis sa fiche.`;
}
