import type { CatalogCard, CatalogCollectionFile } from "@leximon/contract";
import type { PackCollection } from "@/booster/pack-looks";

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

export interface Shelf {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly cards: readonly CatalogCard[];
}

export interface ShowcaseCard {
  readonly card: CatalogCard;
  readonly collectionName: string;
}

/** What the home page shows of the catalogue: a few cards, not the 2 MB of collections. */
export interface Showcase {
  readonly heroWords: readonly CatalogCard[];
  readonly shelves: readonly Shelf[];
  /** The first collection, for the sachet of the rules. */
  readonly pack: PackCollection | null;
  readonly trade: readonly ShowcaseCard[];
}

export const EMPTY_SHOWCASE: Showcase = { heroWords: [], shelves: [], pack: null, trade: [] };

export function showcaseOf(collections: readonly CatalogCollectionFile[]): Showcase {
  const cardsById = new Map(
    collections.flatMap((collection) => collection.cards.map((card) => [card.id, card] as const)),
  );
  const nameOf = (collectionId: string) =>
    collections.find((c) => c.id === collectionId)?.name ?? collectionId;
  const shelves = COLLECTION_SHOWCASE.flatMap(({ collectionId, cardIds }) => {
    const collection = collections.find((c) => c.id === collectionId);
    const cards = pickShowcase(cardsById, cardIds);
    if (collection === undefined || cards.length === 0) return [];
    return [{ id: collection.id, name: collection.name, count: collection.cards.length, cards }];
  });
  const first = collections[0];
  return {
    heroWords: pickShowcase(cardsById, HERO_WORD_IDS),
    shelves,
    pack: first === undefined ? null : { id: first.id, name: first.name, back: first.back },
    trade: pickShowcase(cardsById, TRADE_CARD_IDS).map((card) => ({
      card,
      collectionName: nameOf(card.collectionId),
    })),
  };
}
