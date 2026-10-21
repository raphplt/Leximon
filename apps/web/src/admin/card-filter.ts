import type { CatalogCard } from "@leximon/contract";
import type { Rarity } from "@leximon/core";

export type EngravingFilter = "all" | "with" | "without";

export interface CardFilter {
  readonly query: string;
  readonly collectionId: string | null;
  readonly rarity: Rarity | null;
  readonly engraving: EngravingFilter;
}

/** Lower case, accents dropped: "écu" matches "ECU" and "ecu". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The cards matching the back office filters; the query looks in the word and its id. */
export function filterCards(cards: readonly CatalogCard[], filter: CardFilter): CatalogCard[] {
  const query = foldText(filter.query.trim());
  return cards.filter((card) => {
    if (filter.collectionId !== null && card.collectionId !== filter.collectionId) return false;
    if (filter.rarity !== null && card.rarity !== filter.rarity) return false;
    const engraved = (card.engraving ?? null) !== null;
    if (filter.engraving === "with" && !engraved) return false;
    if (filter.engraving === "without" && engraved) return false;
    return query === "" || foldText(card.word).includes(query) || card.id.includes(query);
  });
}
