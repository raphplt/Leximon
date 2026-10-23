import {
  type CatalogCard,
  MASTERY_LEVEL_LABELS,
  type MasteryLevelCode,
  RARITY_LABELS,
} from "@leximon/contract";
import { RARITIES, type Rarity, rarityRank } from "@leximon/core";
import { formatCount } from "./format";

/** The album: what the player owns, collection by collection. */

export interface AlbumCollection {
  readonly id: string;
  readonly name: string;
  readonly cards: readonly CatalogCard[];
}

/** What the album knows about one reviewed word. */
export interface WordMemory {
  readonly level: MasteryLevelCode;
  /** Epoch ms when the word is due again. */
  readonly due: number;
  /** Memory stability in days. */
  readonly stability: number;
  /** Epoch ms of the last answer. */
  readonly lastReviewedAt: number | null;
}

export const ALBUM_FILTERS = ["all", "doubles", "review", "gilded", "missing"] as const;
export type AlbumFilter = (typeof ALBUM_FILTERS)[number];

const FILTER_LABELS: Readonly<Record<AlbumFilter, string>> = {
  all: "Toutes",
  doubles: "Doubles",
  review: "À réviser",
  gilded: "Dorure",
  missing: "Manquantes",
};

/** Theme labels; a theme missing here shows its slug with a capital. */
const THEME_LABELS: Readonly<Record<string, string>> = {
  "vie-quotidienne": "Vie quotidienne",
  metiers: "Métiers",
  nature: "Nature",
  arts: "Arts",
  sentiments: "Sentiments",
  religion: "Religion",
  sciences: "Sciences",
  insultes: "Insultes",
  guerre: "Guerre",
  corps: "Corps",
  droit: "Droit",
  argent: "Argent",
  loufoque: "Loufoque",
  cuisine: "Cuisine",
  galanterie: "Galanterie",
};

export function themeLabel(slug: string): string {
  return THEME_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1).replaceAll("-", " ");
}

export interface AlbumState {
  readonly collectionId: string;
  readonly rarity: Rarity | null;
  readonly filter: AlbumFilter;
  /** A theme slug, or `null` for every theme. */
  readonly theme: string | null;
  readonly search: string;
}

export interface AlbumInput {
  readonly collections: readonly AlbumCollection[];
  /** Copies owned, by card id. */
  readonly owned: ReadonlyMap<string, number>;
  readonly memory: ReadonlyMap<string, WordMemory>;
  readonly now: number;
}

export interface AlbumTab {
  readonly id: string;
  readonly name: string;
  readonly owned: number;
  readonly total: number;
  /** « 85/519 » */
  readonly count: string;
  readonly ratio: number;
}

export interface RarityChip {
  readonly rarity: Rarity;
  /** « 85/175 » */
  readonly count: string;
  readonly aria: string;
}

export interface OwnedItem {
  readonly kind: "owned";
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly quantity: number;
  readonly level: MasteryLevelCode;
  readonly levelLabel: string;
  readonly aria: string;
}

export interface MissingItem {
  readonly kind: "missing";
  readonly cardId: string;
  readonly rarity: Rarity;
  readonly aria: string;
}

/** The tile « 327 mots à trouver », which leads to Jouer. */
export interface MoreItem {
  readonly kind: "more";
  readonly left: number;
  readonly label: string;
}

export type AlbumItem = OwnedItem | MissingItem | MoreItem;

export interface AlbumView {
  /** « 590 mots sur 1 561 » */
  readonly headline: { readonly owned: string; readonly total: string };
  readonly tabs: readonly AlbumTab[];
  readonly rarities: readonly RarityChip[];
  readonly filters: readonly { readonly id: AlbumFilter; readonly label: string }[];
  readonly themes: readonly { readonly id: string; readonly label: string }[];
  readonly items: readonly AlbumItem[];
  /** A search runs through every collection; the tabs then stand aside. */
  readonly searching: boolean;
  readonly empty: string | null;
}

export const ALBUM_EMPTY = "Rien de ce côté. Pas pour longtemps.";

/** The tab that gathers every collection. */
export const ALL_COLLECTIONS = "tout";

/** Lower case, without accents: « Écrouelles » is found by typing « ecrou ». */
export function foldSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Rarest first, then alphabetical: the prizes lead the page. */
function albumOrder(a: CatalogCard, b: CatalogCard): number {
  return rarityRank(b.rarity) - rarityRank(a.rarity) || a.word.localeCompare(b.word, "fr");
}

/** Whether a challenge would ask this word now: due again, or never reviewed. */
export function isToReview(memory: WordMemory | undefined, now: number): boolean {
  return memory === undefined || memory.due <= now;
}

function matchesFilter(
  filter: AlbumFilter,
  quantity: number,
  memory: WordMemory | undefined,
  now: number,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "doubles":
      return quantity > 1;
    case "review":
      return isToReview(memory, now);
    case "gilded":
      return memory?.level === "gilded";
    case "missing":
      return false;
  }
}

function ownedItem(
  card: CatalogCard,
  collectionName: string,
  quantity: number,
  memory: WordMemory | undefined,
): OwnedItem {
  const level = memory?.level ?? "sketch";
  const levelLabel = MASTERY_LEVEL_LABELS[level];
  const copies = quantity > 1 ? `, ${quantity} exemplaires` : "";
  return {
    kind: "owned",
    card,
    collectionName,
    quantity,
    level,
    levelLabel,
    aria: `${card.word}, ${RARITY_LABELS[card.rarity]}, ${levelLabel}${copies}`,
  };
}

export function albumView(input: AlbumInput, state: AlbumState): AlbumView {
  const { collections, owned, memory, now } = input;
  const collectionTabs = collections.map((collection) => {
    const found = collection.cards.filter((card) => owned.has(card.id)).length;
    const total = collection.cards.length;
    return {
      id: collection.id,
      name: collection.name,
      owned: found,
      total,
      count: `${formatCount(found)}/${formatCount(total)}`,
      ratio: total === 0 ? 0 : found / total,
    };
  });
  const totalCards = collectionTabs.reduce((sum, tab) => sum + tab.total, 0);
  const totalOwned = collectionTabs.reduce((sum, tab) => sum + tab.owned, 0);
  const headline = { owned: formatCount(totalOwned), total: formatCount(totalCards) };
  const tabs: AlbumTab[] = [
    {
      id: ALL_COLLECTIONS,
      name: "Tout",
      owned: totalOwned,
      total: totalCards,
      count: `${formatCount(totalOwned)}/${formatCount(totalCards)}`,
      ratio: totalCards === 0 ? 0 : totalOwned / totalCards,
    },
    ...collectionTabs,
  ];

  const filters = ALBUM_FILTERS.map((id) => ({ id, label: FILTER_LABELS[id] }));
  const query = foldSearch(state.search);

  if (query !== "") {
    // Only owned words are searched: a missing word stays a surprise.
    const items = collections
      .flatMap((collection) =>
        collection.cards
          .filter((card) => owned.has(card.id) && foldSearch(card.word).includes(query))
          .map((card) => ({ card, name: collection.name })),
      )
      .sort((a, b) => albumOrder(a.card, b.card))
      .map(({ card, name }) => ownedItem(card, name, owned.get(card.id) ?? 1, memory.get(card.id)));
    return {
      headline,
      tabs,
      rarities: [],
      filters,
      themes: [],
      items,
      searching: true,
      empty: items.length === 0 ? ALBUM_EMPTY : null,
    };
  }

  // Every card in view, with the name of its own collection.
  const shown =
    state.collectionId === ALL_COLLECTIONS
      ? collections
      : collections.filter((c) => c.id === state.collectionId).slice(0, 1);
  const chosen = shown.length > 0 ? shown : collections.slice(0, 1);
  const pool = chosen.flatMap((c) => c.cards.map((card) => ({ card, name: c.name })));
  if (pool.length === 0) {
    return {
      headline,
      tabs,
      rarities: [],
      filters,
      themes: [],
      items: [],
      searching: false,
      empty: ALBUM_EMPTY,
    };
  }

  const rarities = RARITIES.flatMap((rarity) => {
    const cards = pool.filter(({ card }) => card.rarity === rarity);
    if (cards.length === 0) return [];
    const found = cards.filter(({ card }) => owned.has(card.id)).length;
    return [
      {
        rarity,
        count: `${formatCount(found)}/${formatCount(cards.length)}`,
        aria: `${RARITY_LABELS[rarity]}, ${found} sur ${cards.length}`,
      },
    ];
  }).reverse();

  const themes = [...new Set(pool.flatMap(({ card }) => card.themes))]
    .map((id) => ({ id, label: themeLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  const inView = pool
    .filter(
      ({ card }) =>
        (state.rarity === null || card.rarity === state.rarity) &&
        (state.theme === null || card.themes.includes(state.theme)),
    )
    .sort((a, b) => albumOrder(a.card, b.card));

  const ownedItems =
    state.filter === "missing"
      ? []
      : inView.flatMap(({ card, name }) => {
          const quantity = owned.get(card.id);
          const word = memory.get(card.id);
          if (quantity === undefined || !matchesFilter(state.filter, quantity, word, now)) {
            return [];
          }
          return [ownedItem(card, name, quantity, word)];
        });

  const missing =
    state.filter === "all" || state.filter === "missing"
      ? inView.filter(({ card }) => !owned.has(card.id)).map(({ card }) => card)
      : [];
  const missingItems: MissingItem[] = missing.map((card) => ({
    kind: "missing",
    cardId: card.id,
    rarity: card.rarity,
    aria: `Carte ${RARITY_LABELS[card.rarity]} pas encore trouvée`,
  }));
  const more: MoreItem[] =
    missing.length > 0 && state.filter === "all"
      ? [
          {
            kind: "more",
            left: missing.length,
            label: missing.length > 1 ? "mots à trouver" : "mot à trouver",
          },
        ]
      : [];

  const items: AlbumItem[] = [...ownedItems, ...more, ...missingItems];
  return {
    headline,
    tabs,
    rarities,
    filters,
    themes,
    items,
    searching: false,
    empty: items.length === 0 ? ALBUM_EMPTY : null,
  };
}
