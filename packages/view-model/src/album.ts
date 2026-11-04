import {
  type CatalogCard,
  MASTERY_LEVEL_LABELS,
  type MasteryLevelCode,
  type MasteryResponse,
  type OwnedCardsResponse,
  RARITY_LABELS,
} from "@leximon/contract";
import { gameDayOf, RARITIES, type Rarity, rarityRank } from "@leximon/core";
import { compareFrench, formatCount, plural } from "./format";
import type { CompareFilter } from "./friends";

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

/** When the player first got a card, and whether they have opened its sheet since. */
export interface CardDate {
  readonly firstObtainedAt: number;
  readonly read: boolean;
}

type OwnedCopy = OwnedCardsResponse["cards"][number];

/** Copies owned, by card id: the API counts each variant apart. */
export function copiesByCard(owned: readonly OwnedCopy[]): Map<string, number> {
  const byCard = new Map<string, number>();
  for (const card of owned) {
    byCard.set(card.cardId, (byCard.get(card.cardId) ?? 0) + card.quantity);
  }
  return byCard;
}

/** A card is read once any of its variants is: a new variant of a word read is not new. */
export function datesByCard(owned: readonly OwnedCopy[]): Map<string, CardDate> {
  const byCard = new Map<string, CardDate>();
  for (const card of owned) {
    const known = byCard.get(card.cardId);
    const firstObtainedAt = Date.parse(card.firstObtainedAt);
    const read = card.readAt != null;
    byCard.set(card.cardId, {
      firstObtainedAt: Math.min(firstObtainedAt, known?.firstObtainedAt ?? firstObtainedAt),
      read: read || (known?.read ?? false),
    });
  }
  return byCard;
}

/** What the player remembers of each reviewed word, by card id. */
export function memoriesByCard(words: MasteryResponse["words"]): Map<string, WordMemory> {
  return new Map(
    words.map((word) => [
      word.cardId,
      {
        level: word.level,
        due: Date.parse(word.due),
        stability: word.stability,
        lastReviewedAt: word.lastReviewedAt === null ? null : Date.parse(word.lastReviewedAt),
      },
    ]),
  );
}

/** Cards just got that the player did not own: new until their sheet is opened. */
export function datesAfterGain(
  dates: ReadonlyMap<string, CardDate>,
  cardIds: readonly string[],
  ownedBefore: ReadonlyMap<string, number>,
  now: number,
): Map<string, CardDate> {
  const next = new Map(dates);
  for (const id of cardIds) {
    if ((ownedBefore.get(id) ?? 0) === 0 && !next.has(id)) {
      next.set(id, { firstObtainedAt: now, read: false });
    }
  }
  return next;
}

export const ALBUM_FILTERS = [
  "all",
  "new",
  "today",
  "doubles",
  "review",
  "gilded",
  "missing",
] as const;
export type AlbumFilter = (typeof ALBUM_FILTERS)[number];

const FILTER_LABELS: Readonly<Record<AlbumFilter, string>> = {
  all: "Toutes",
  new: "Nouveaux",
  today: "Aujourd'hui",
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

/** How the album lays out the cards owned; the missing ones always come last. */
export const ALBUM_SORTS = ["alpha", "rarity", "recent"] as const;
export type AlbumSort = (typeof ALBUM_SORTS)[number];

export const ALBUM_SORT_LABELS: Readonly<Record<AlbumSort, string>> = {
  alpha: "De A à Z",
  rarity: "Par rareté",
  recent: "Les plus récentes",
};

export const ALBUM_SORT_TITLE = "Trier";

export function isAlbumSort(value: unknown): value is AlbumSort {
  return typeof value === "string" && (ALBUM_SORTS as readonly string[]).includes(value);
}

/** The theme chips, folded away until asked for. */
export const ALBUM_THEME_TEXTS = {
  show: "Voir les thèmes",
  hide: "Cacher les thèmes",
} as const;

export interface AlbumState {
  readonly collectionId: string;
  /** Alphabetical when left out. */
  readonly sort?: AlbumSort;
  readonly rarity: Rarity | null;
  readonly filter: AlbumFilter;
  /** A theme slug, or `null` for every theme. */
  readonly theme: string | null;
  readonly search: string;
  /** Comparing with a friend's album: what only they have, only the player, or both. */
  readonly compare?: CompareFilter | null;
}

export interface AlbumInput {
  readonly collections: readonly AlbumCollection[];
  /** Copies owned, by card id. */
  readonly owned: ReadonlyMap<string, number>;
  readonly memory: ReadonlyMap<string, WordMemory>;
  /** Unknown cards (not read yet from the server) are neither new nor from today. */
  readonly dates: ReadonlyMap<string, CardDate>;
  readonly now: number;
  /** The cards a friend owns, when comparing albums. */
  readonly friend?: ReadonlySet<string>;
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
  /** Its sheet was never opened: tagged « Nouveau ». */
  readonly fresh: boolean;
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

/** A letter of the bar beside the album, and the first card under it; `null` when none. */
export interface AlbumLetter {
  readonly letter: string;
  readonly index: number | null;
}

export interface AlbumView {
  /** « 590 mots sur 1 561 » */
  readonly headline: { readonly owned: string; readonly total: string };
  readonly tabs: readonly AlbumTab[];
  readonly rarities: readonly RarityChip[];
  readonly filters: readonly {
    readonly id: AlbumFilter;
    readonly label: string;
    /** Cards it would show, for the filters worth a count (« Nouveaux »); `null` otherwise. */
    readonly count: number | null;
  }[];
  readonly themes: readonly { readonly id: string; readonly label: string }[];
  readonly items: readonly AlbumItem[];
  /** The bar of letters, for an alphabetical album long enough to need it; empty otherwise. */
  readonly letters: readonly AlbumLetter[];
  /** A search runs through every collection; the tabs then stand aside. */
  readonly searching: boolean;
  readonly empty: string | null;
}

export const ALBUM_EMPTY = "Aucune carte ne correspond à ce filtre.";

/** The album's panel of filters, on the phone. */
export const ALBUM_FILTER_TEXTS = {
  button: "Filtres",
  rarity: "Rareté",
  show: "Afficher",
  themes: "Thèmes",
  apply: "Voir les cartes",
  clear: "Effacer les filtres",
} as const;

/** Filters in use, shown on the button that opens them. A comparison sets aside « Afficher ». */
export function activeFilterCount(state: AlbumState): number {
  const shown = state.compare == null && state.filter !== "all";
  return [state.rarity !== null, shown, state.theme !== null].filter(Boolean).length;
}

/** « Filtres, 2 actifs » */
export function filterButtonLabel(count: number): string {
  if (count === 0) return ALBUM_FILTER_TEXTS.button;
  return `${ALBUM_FILTER_TEXTS.button}, ${plural(count, "actif", "actifs")}`;
}

/** The same album with no filter on. The collection, the search and a comparison stay. */
export function withoutFilters(state: AlbumState): AlbumState {
  return { ...state, rarity: null, filter: "all", theme: null };
}

/** The tab that gathers every collection. */
export const ALL_COLLECTIONS = "tout";

/** Lower case, without accents: « Écrouelles » is found by typing « ecrou ». */
export function foldSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

const WORD_PLACES = new WeakMap<readonly AlbumCollection[], ReadonlyMap<string, number>>();

/**
 * Each card's place in French order, worked out once per catalogue: the album sorts again on
 * every filter and every letter typed, and a collator's comparison is slow on a phone.
 */
function wordPlaces(collections: readonly AlbumCollection[]): ReadonlyMap<string, number> {
  const known = WORD_PLACES.get(collections);
  if (known !== undefined) return known;
  const places = new Map(
    collections
      .flatMap((collection) => collection.cards)
      .sort((a, b) => compareFrench(a.word, b.word))
      .map((card, place) => [card.id, place]),
  );
  WORD_PLACES.set(collections, places);
  return places;
}

/** Rarest first, then alphabetical: the prizes lead the page. */
function albumOrder(a: CatalogCard, b: CatalogCard, places: ReadonlyMap<string, number>): number {
  return (
    rarityRank(b.rarity) - rarityRank(a.rarity) || (places.get(a.id) ?? 0) - (places.get(b.id) ?? 0)
  );
}

/** The order of the cards owned, for the sort chosen. */
function ownedOrder(
  sort: AlbumSort,
  places: ReadonlyMap<string, number>,
  dates: ReadonlyMap<string, CardDate>,
): (a: CatalogCard, b: CatalogCard) => number {
  const place = (card: CatalogCard) => places.get(card.id) ?? 0;
  switch (sort) {
    case "alpha":
      return (a, b) => place(a) - place(b);
    case "rarity":
      return (a, b) => albumOrder(a, b, places);
    case "recent":
      return (a, b) =>
        (dates.get(b.id)?.firstObtainedAt ?? 0) - (dates.get(a.id)?.firstObtainedAt ?? 0) ||
        place(a) - place(b);
  }
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Below this many cards, the album fits in a few rows: no bar of letters. */
const LETTERS_FROM = 24;

/** The bar of letters of an alphabetical album: each letter leads to the first word under it. */
export function albumLetters(items: readonly AlbumItem[]): readonly AlbumLetter[] {
  const owned = items.filter((item) => item.kind === "owned").length;
  if (owned < LETTERS_FROM) return [];
  const first = new Map<string, number>();
  items.forEach((item, index) => {
    if (item.kind !== "owned") return;
    const letter = foldedWord(item.card)
      .charAt(0)
      .replace("œ", "o")
      .replace("æ", "a")
      .toUpperCase();
    if (!first.has(letter)) first.set(letter, index);
  });
  return ALPHABET.map((letter) => ({ letter, index: first.get(letter) ?? null }));
}

const FOLDED_WORDS = new WeakMap<CatalogCard, string>();

function foldedWord(card: CatalogCard): string {
  const known = FOLDED_WORDS.get(card);
  if (known !== undefined) return known;
  const folded = foldSearch(card.word);
  FOLDED_WORDS.set(card, folded);
  return folded;
}

/** Whether a challenge would ask this word now: due again, or never reviewed. */
export function isToReview(memory: WordMemory | undefined, now: number): boolean {
  return memory === undefined || memory.due <= now;
}

export function isFresh(date: CardDate | undefined): boolean {
  return date !== undefined && !date.read;
}

function matchesFilter(
  filter: AlbumFilter,
  quantity: number,
  memory: WordMemory | undefined,
  date: CardDate | undefined,
  now: number,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "new":
      return isFresh(date);
    case "today":
      return date !== undefined && gameDayOf(date.firstObtainedAt).key === gameDayOf(now).key;
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
  date: CardDate | undefined,
): OwnedItem {
  // A word owned but never answered has no memory yet: it waits on a blank page.
  const level = memory?.level ?? "blank";
  const levelLabel = MASTERY_LEVEL_LABELS[level];
  const copies = quantity > 1 ? `, ${quantity} exemplaires` : "";
  const fresh = isFresh(date);
  return {
    kind: "owned",
    card,
    collectionName,
    quantity,
    level,
    levelLabel,
    fresh,
    aria: `${card.word}, ${RARITY_LABELS[card.rarity]}, ${levelLabel}${copies}${fresh ? ", nouveau" : ""}`,
  };
}

export function albumView(input: AlbumInput, state: AlbumState): AlbumView {
  const { collections, owned, memory, dates, now } = input;
  const places = wordPlaces(collections);
  const sort = state.sort ?? "alpha";
  const order = ownedOrder(sort, places, dates);
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

  const freshCount = [...owned.keys()].filter((id) => isFresh(dates.get(id))).length;
  const filters = ALBUM_FILTERS.map((id) => ({
    id,
    label: FILTER_LABELS[id],
    count: id === "new" ? freshCount : null,
  }));
  const query = foldSearch(state.search);

  if (query !== "") {
    // Only owned words are searched: a missing word stays a surprise.
    const items = collections
      .flatMap((collection) =>
        collection.cards
          .filter((card) => owned.has(card.id) && foldedWord(card).includes(query))
          .map((card) => ({ card, name: collection.name })),
      )
      .sort((a, b) => order(a.card, b.card))
      .map(({ card, name }) =>
        ownedItem(card, name, owned.get(card.id) ?? 1, memory.get(card.id), dates.get(card.id)),
      );
    return {
      headline,
      tabs,
      rarities: [],
      filters,
      themes: [],
      items,
      letters: sort === "alpha" ? albumLetters(items) : [],
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
      letters: [],
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
  });

  const themes = [...new Set(pool.flatMap(({ card }) => card.themes))]
    .map((id) => ({ id, label: themeLabel(id) }))
    .sort((a, b) => compareFrench(a.label, b.label));

  const inView = pool
    .filter(
      ({ card }) =>
        (state.rarity === null || card.rarity === state.rarity) &&
        (state.theme === null || card.themes.includes(state.theme)),
    )
    .sort((a, b) => albumOrder(a.card, b.card, places));

  const compare = state.compare ?? null;
  if (compare !== null && input.friend !== undefined) {
    const friend = input.friend;
    const items = (
      compare === "theirs" ? inView : [...inView].sort((a, b) => order(a.card, b.card))
    ).flatMap(({ card, name }): AlbumItem[] => {
      const quantity = owned.get(card.id);
      const theirs = friend.has(card.id);
      if (compare === "theirs") return quantity === undefined && theirs ? [missingItem(card)] : [];
      const keep = quantity !== undefined && (compare === "both" ? theirs : !theirs);
      return keep ? [ownedItem(card, name, quantity, memory.get(card.id), dates.get(card.id))] : [];
    });
    return {
      headline,
      tabs,
      rarities,
      filters,
      themes,
      items,
      letters: sort === "alpha" ? albumLetters(items) : [],
      searching: false,
      empty: items.length === 0 ? ALBUM_EMPTY : null,
    };
  }

  const ownedItems =
    state.filter === "missing"
      ? []
      : [...inView]
          .sort((a, b) => order(a.card, b.card))
          .flatMap(({ card, name }) => {
            const quantity = owned.get(card.id);
            const word = memory.get(card.id);
            const date = dates.get(card.id);
            if (quantity === undefined || !matchesFilter(state.filter, quantity, word, date, now)) {
              return [];
            }
            return [ownedItem(card, name, quantity, word, date)];
          });

  const missing =
    state.filter === "all" || state.filter === "missing"
      ? inView.filter(({ card }) => !owned.has(card.id)).map(({ card }) => card)
      : [];
  const missingItems = missing.map(missingItem);
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
    letters: sort === "alpha" ? albumLetters(items) : [],
    searching: false,
    empty: items.length === 0 ? ALBUM_EMPTY : null,
  };
}

function missingItem(card: CatalogCard): MissingItem {
  return {
    kind: "missing",
    cardId: card.id,
    rarity: card.rarity,
    aria: `Carte ${RARITY_LABELS[card.rarity]} pas encore trouvée`,
  };
}
