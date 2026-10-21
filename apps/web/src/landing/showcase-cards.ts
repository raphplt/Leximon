import type { CatalogCard } from "@leximon/contract";

/**
 * Words the home page draws from, one at a time: every published card that has its engraving.
 * Catalogue ids never change.
 */
export const HERO_WORD_IDS = [
  "charivarieur",
  "orvietan",
  "lucubrateur",
  "antitonnerre",
  "trouillotte",
  "griviere",
  "fouacier",
  "canephore",
  "claymore",
  "barbouquine",
  "talpinette",
  "cochenillier",
] as const;

/** Insults of old from « Caractères et travers », the collection the home page shows off. */
export const INSULT_COLLECTION_ID = "caracteres";
export const INSULT_IDS = [
  "belitre",
  "grigou",
  "dadais",
  "bestiasse",
  "poetereau",
  "faraud",
] as const;

/** The first sense of a definition, the part before the first semicolon. */
export function firstSense(definition: string): string {
  const [first = definition] = definition.split(" ; ");
  return /[.!?…]$/.test(first) ? first : `${first}.`;
}

/** The two cards swapped in the trade figure, both in the public domain. */
export const TRADE_CARD_IDS = ["antitonnerre", "griviere"] as const;

/** The cards found in the catalogue, in the given order; missing ones are skipped. */
export function pickShowcase(
  cardsById: ReadonlyMap<string, CatalogCard>,
  ids: readonly string[],
): CatalogCard[] {
  return ids.flatMap((id) => {
    const card = cardsById.get(id);
    return card === undefined ? [] : [card];
  });
}
