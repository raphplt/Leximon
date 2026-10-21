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

/**
 * Three cards fanned out for each launch collection, the rarest in the middle. A few insults of
 * old slipped into « Caractères et travers ».
 */
export const COLLECTION_SHOWCASE = [
  { collectionId: "fondateurs", cardIds: ["aliboron", "talpinette", "cochenillier"] },
  { collectionId: "caracteres", cardIds: ["grigou", "charivarieur", "carabas"] },
  { collectionId: "metiers", cardIds: ["fouacier", "trouillotte", "claymore"] },
] as const;

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
