import type { CatalogCard } from "@leximon/contract";
import { rarityRank } from "@leximon/core";

export type CardSortColumn = "word" | "rarity" | "collection" | "engraving" | "frequency";
export type SortDirection = "asc" | "desc";

export interface CardSort {
  readonly column: CardSortColumn;
  readonly direction: SortDirection;
}

export const CARD_SORT_COLUMNS: readonly CardSortColumn[] = [
  "word",
  "rarity",
  "collection",
  "engraving",
  "frequency",
];

export function isSortColumn(value: unknown): value is CardSortColumn {
  return typeof value === "string" && (CARD_SORT_COLUMNS as readonly string[]).includes(value);
}

/**
 * Sorts cards for the back office table.
 * Tie-breaker is always the card word (and id) so results remain stable.
 */
export function sortCards(
  cards: readonly CatalogCard[],
  sort: CardSort,
  getCollectionName: (id: string) => string = (id) => id,
): CatalogCard[] {
  const { column, direction } = sort;
  const sign = direction === "asc" ? 1 : -1;

  return [...cards].sort((a, b) => {
    let diff = 0;

    switch (column) {
      case "word":
        diff = a.word.localeCompare(b.word, "fr") || a.id.localeCompare(b.id);
        return diff * sign;

      case "rarity":
        diff = rarityRank(a.rarity) - rarityRank(b.rarity);
        break;

      case "collection": {
        const colA = getCollectionName(a.collectionId);
        const colB = getCollectionName(b.collectionId);
        diff = colA.localeCompare(colB, "fr");
        break;
      }

      case "engraving": {
        const hasA = (a.engraving ?? null) !== null ? 1 : 0;
        const hasB = (b.engraving ?? null) !== null ? 1 : 0;
        diff = hasB - hasA;
        break;
      }

      case "frequency": {
        const freqA = a.perBillion ?? 0;
        const freqB = b.perBillion ?? 0;
        diff = freqA - freqB;
        break;
      }
    }

    if (diff !== 0) {
      return diff * sign;
    }

    return a.word.localeCompare(b.word, "fr") || a.id.localeCompare(b.id);
  });
}
