import type { CatalogCard } from "@leximon/contract";

/**
 * Cards shown on the home page, left to right: a common, the legendary in the middle, a precious,
 * each with its engraving. Chosen by hand for their charm; catalogue ids never change.
 */
export const SHOWCASE_CARD_IDS = ["orvietan", "charivarieur", "lucubrateur"] as const;

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
