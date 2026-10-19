import type { Rarity } from "@leximon/core";
import { DEMO_CARDS } from "./demo-catalog";

/** What a card shows. Provisional shape until the published catalogue format is decided. */
export interface CatalogCard {
  readonly id: string;
  readonly word: string;
  readonly partOfSpeech: string;
  /** First attestation, e.g. "XIIIe s.". `null` when unknown. */
  readonly era: string | null;
  readonly definition: string;
  readonly quote: { readonly text: string; readonly author: string } | null;
  readonly rarity: Rarity;
  readonly collectionId: string;
  /** Modern written frequency (Google Books Ngram, D-020). `null` below what Ngram measures. */
  readonly perBillion: number | null;
}

export interface CatalogCollection {
  readonly id: string;
  readonly name: string;
}

const cardsById = new Map(DEMO_CARDS.map((card) => [card.id, card]));

export const COLLECTIONS: readonly CatalogCollection[] = [
  { id: "fondateurs", name: "Les Fondateurs" },
];

export function collectionName(collectionId: string): string {
  return COLLECTIONS.find((collection) => collection.id === collectionId)?.name ?? collectionId;
}

export function findCard(id: string): CatalogCard | undefined {
  return cardsById.get(id);
}

/**
 * The card to show for a drawn or owned id. An id missing from the catalogue (the server knows
 * cards the demo catalogue lacks) still gets a card rather than breaking the screen.
 */
export function cardOrPlaceholder(id: string, rarity: Rarity): CatalogCard {
  return (
    findCard(id) ?? {
      id,
      word: id,
      partOfSpeech: "mot",
      era: null,
      definition: "Ce mot n'est pas encore dans le catalogue.",
      quote: null,
      rarity,
      collectionId: "",
      perBillion: null,
    }
  );
}

export function cardsOfCollection(collectionId: string): CatalogCard[] {
  return DEMO_CARDS.filter((card) => card.collectionId === collectionId);
}

/**
 * Discreet frequency figure printed on a card (P22): "one occurrence in N words", e.g.
 * "1/3,6 M" or "1/7,7 Md". Below what Ngram measures, "< 1/Md".
 */
export function formatOdds(perBillion: number | null): string {
  if (perBillion === null || perBillion <= 0) return "< 1/Md";
  const oneIn = 1e9 / perBillion;
  if (oneIn >= 1e9) return `1/${twoDigits(oneIn / 1e9)} Md`;
  if (oneIn >= 1e6) return `1/${twoDigits(oneIn / 1e6)} M`;
  return `1/${twoDigits(oneIn / 1e3)} k`;
}

/** Two significant digits, French decimal comma, no trailing zero. */
function twoDigits(value: number): string {
  const rounded = Number(value.toPrecision(2));
  return rounded.toLocaleString("fr-FR", { maximumFractionDigits: 1 }).replace(/\s/g, " ");
}
