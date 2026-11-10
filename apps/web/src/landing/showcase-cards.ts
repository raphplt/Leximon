import type { CatalogCard, CatalogCollectionFile } from "@leximon/contract";
import { type PackCollection, packOf } from "../booster/pack-looks";

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
 * One card of each rarity, from the most printed word to one no book prints any more: the
 * rarity of a card is the word's. Mostly insults of old, the page's best argument.
 */
export const RARITY_LADDER_IDS = [
  "jobard",
  "venette",
  "coquefredouille",
  "grippeur",
  "batonnable",
  "pendardeau",
] as const;

/** Words to guess before the card turns: the insults of old, from the most to the least printed. */
export const GUESS_WORD_IDS = ["maroufle", "croutier", "coqueplumet", "digressionnaire"] as const;

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

/** A launch collection, named with its size. */
export interface Shelf {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly tagline: string | undefined;
  readonly back: string | undefined;
}

export interface ShowcaseCard {
  readonly card: CatalogCard;
  readonly collectionName: string;
}

/** What the home page shows of the catalogue: a few cards, not the 2 MB of collections. */
export interface Showcase {
  readonly heroWords: readonly CatalogCard[];
  readonly ladder: readonly ShowcaseCard[];
  readonly shelves: readonly Shelf[];
  /** The first collection, for the sachet of the rules. */
  readonly pack: PackCollection | null;
  readonly trade: readonly ShowcaseCard[];
  readonly guess: readonly ShowcaseCard[];
}

export const EMPTY_SHOWCASE: Showcase = {
  heroWords: [],
  ladder: [],
  shelves: [],
  pack: null,
  trade: [],
  guess: [],
};

export function showcaseOf(collections: readonly CatalogCollectionFile[]): Showcase {
  const cardsById = new Map(
    collections.flatMap((collection) => collection.cards.map((card) => [card.id, card] as const)),
  );
  const nameOf = (collectionId: string) =>
    collections.find((c) => c.id === collectionId)?.name ?? collectionId;
  const withCollection = (card: CatalogCard): ShowcaseCard => ({
    card,
    collectionName: nameOf(card.collectionId),
  });
  const shelves = collections.map((c) => ({
    id: c.id,
    name: c.name,
    count: c.cards.length,
    tagline: c.tagline,
    back: c.back,
  }));
  const first = collections[0];
  return {
    heroWords: pickShowcase(cardsById, HERO_WORD_IDS),
    ladder: pickShowcase(cardsById, RARITY_LADDER_IDS).map(withCollection),
    shelves,
    pack: first === undefined ? null : packOf(first),
    trade: pickShowcase(cardsById, TRADE_CARD_IDS).map(withCollection),
    guess: pickShowcase(cardsById, GUESS_WORD_IDS).map(withCollection),
  };
}
