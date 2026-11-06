import { type CatalogCard, RARITY_LABELS } from "@leximon/contract";
import { type EcuRules, RARITIES, type Rarity, type RecycleChoice } from "@leximon/core";
import { foldSearch } from "./album";
import { ecusLabel } from "./ecus";
import { compareFrench, formatCount, plural } from "./format";

/** The window where the player picks the doubles to recycle, card by card. */

export const RECYCLE_TITLE = "Recycler des doubles";
export const RECYCLE_OPEN = "Recycler des doubles";
export const RECYCLE_PICK_RULE =
  "Choisis les doubles à recycler. Il te reste toujours au moins un exemplaire de chaque carte, et le mot garde sa maîtrise.";
export const RECYCLE_SEARCH = "Chercher un mot";
export const RECYCLE_ALL_RARITIES = "Toutes";
export const RECYCLE_ALL_COLLECTIONS = "Toutes";
/** Picks, among the cards shown, every copy beyond the card and one double. */
export const RECYCLE_PICK_EXTRA = "Garder un double";
export const RECYCLE_PICK_EXTRA_HELP =
  "Coche, parmi les cartes affichées, ce qui dépasse la carte et un double, sans les Épiques ni les Légendaires.";
export const RECYCLE_CLEAR = "Tout décocher";
/** Picks, among the cards shown, every double: one copy of each card stays. */
export const RECYCLE_PICK_ALL = "Tout cocher";
export const RECYCLE_NONE_PICKED = "Choisis des doubles";
export const RECYCLE_CONFIRM_ACTION = "Oui, recycler";
export const RECYCLE_REVIEW = "Revoir mon choix";

export const RECYCLE_SORTS = ["copies", "rarity", "alpha"] as const;
export type RecycleSort = (typeof RECYCLE_SORTS)[number];

export const RECYCLE_SORT_LABELS: Readonly<Record<RecycleSort, string>> = {
  copies: "Le plus de doubles",
  rarity: "Les plus rares",
  alpha: "De A à Z",
};

export interface RecycleState {
  readonly sort: RecycleSort;
  readonly rarity: Rarity | null;
  readonly collectionId: string | null;
  readonly search: string;
}

export const RECYCLE_START: RecycleState = {
  sort: "copies",
  rarity: null,
  collectionId: null,
  search: "",
};

/** Copies picked, by card id; a card absent or at 0 is not recycled. */
export type RecyclePicks = ReadonlyMap<string, number>;

export interface RecycleRow {
  readonly cardId: string;
  readonly word: string;
  readonly rarity: Rarity;
  /** Copies owned. */
  readonly quantity: number;
  /** « 5 exemplaires ». */
  readonly owned: string;
  /** The most that may go: all but the last copy. */
  readonly max: number;
  readonly picked: number;
  /** « +3 écus » for the copies picked, « +1 écu l'un » before any. */
  readonly gain: string;
  /** Épique or Légendaire: asked once more before it goes. */
  readonly precious: boolean;
  readonly aria: string;
}

export interface RecycleView {
  readonly rows: readonly RecycleRow[];
  /** Said instead of rows: no double at all, or none for the filters. */
  readonly empty: string | null;
  /** The rarities and collections that have doubles, for their chips. */
  readonly rarities: readonly Rarity[];
  readonly collections: readonly { readonly id: string; readonly name: string }[];
  /** « 23 cartes ont des doubles ». */
  readonly count: string;
  readonly choice: readonly RecycleChoice[];
  readonly copies: number;
  readonly ecus: number;
  /** « Recycler 7 doubles, +23 écus »; `null` with nothing picked. */
  readonly action: string | null;
  /** Asked before recycling when the choice holds Épiques or Légendaires; `null` otherwise. */
  readonly confirm: string | null;
}

/** Whether a card's doubles count as rare enough to be asked about once more. */
function isPrecious(rules: EcuRules, rarity: Rarity): boolean {
  return !rules.recycledTogether.includes(rarity);
}

const rarityRank = (rarity: Rarity) => RARITIES.indexOf(rarity);

function order(sort: RecycleSort): (a: RecycleRow, b: RecycleRow) => number {
  const byWord = (a: RecycleRow, b: RecycleRow) => compareFrench(a.word, b.word);
  switch (sort) {
    case "copies":
      return (a, b) => b.quantity - a.quantity || byWord(a, b);
    case "rarity":
      return (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || byWord(a, b);
    case "alpha":
      return byWord;
  }
}

/**
 * Every card with a double, filtered and sorted, with the copies picked and what they bring. The
 * total counts every pick, also those the filters hide, since they still go.
 */
export function recycleView(
  rules: EcuRules,
  cards: readonly CatalogCard[],
  collectionNames: ReadonlyMap<string, string>,
  owned: ReadonlyMap<string, number>,
  picks: RecyclePicks,
  state: RecycleState,
): RecycleView {
  const all = cards.flatMap((card): RecycleRow[] => {
    const quantity = owned.get(card.id) ?? 0;
    if (quantity < 2) return [];
    const max = quantity - 1;
    const picked = Math.min(picks.get(card.id) ?? 0, max);
    const value = rules.recycleValue[card.rarity];
    const gain = picked === 0 ? `+${ecusLabel(value)} l'un` : `+${ecusLabel(picked * value)}`;
    return [
      {
        cardId: card.id,
        word: card.word,
        rarity: card.rarity,
        quantity,
        owned: plural(quantity, "exemplaire", "exemplaires"),
        max,
        picked,
        gain,
        precious: isPrecious(rules, card.rarity),
        aria: `${card.word}, ${RARITY_LABELS[card.rarity]}, ${plural(quantity, "exemplaire", "exemplaires")}, ${formatCount(picked)} à recycler`,
      },
    ];
  });
  const collectionOf = new Map(cards.map((card) => [card.id, card.collectionId]));
  const search = foldSearch(state.search);
  const rows = all
    .filter(
      (row) =>
        (state.rarity === null || row.rarity === state.rarity) &&
        (state.collectionId === null || collectionOf.get(row.cardId) === state.collectionId) &&
        (search === "" || foldSearch(row.word).startsWith(search)),
    )
    .sort(order(state.sort));

  const picked = all.filter((row) => row.picked > 0);
  const choice = picked.map((row) => ({ cardId: row.cardId, copies: row.picked }));
  const copies = picked.reduce((sum, row) => sum + row.picked, 0);
  const ecus = picked.reduce((sum, row) => sum + row.picked * rules.recycleValue[row.rarity], 0);
  const precious = picked.filter((row) => row.precious);

  const collectionIds = new Set(all.map((row) => collectionOf.get(row.cardId)));
  return {
    rows,
    empty:
      all.length === 0
        ? "Tu n'as aucun double pour l'instant."
        : rows.length === 0
          ? "Aucun double ne correspond à ces filtres."
          : null,
    rarities: RARITIES.filter((rarity) => all.some((row) => row.rarity === rarity)),
    collections: [...collectionNames]
      .filter(([id]) => collectionIds.has(id))
      .map(([id, name]) => ({ id, name })),
    count: `${plural(all.length, "carte a", "cartes ont")} des doubles`,
    choice,
    copies,
    ecus,
    action:
      copies === 0 ? null : `Recycler ${plural(copies, "double", "doubles")}, +${ecusLabel(ecus)}`,
    confirm: preciousConfirm(precious),
  };
}

function preciousConfirm(rows: readonly RecycleRow[]): string | null {
  const [only] = rows;
  if (only === undefined) return null;
  if (rows.length === 1 && only.picked === 1) {
    return `Tu vas recycler un double de la carte ${RARITY_LABELS[only.rarity]} « ${only.word} ».`;
  }
  const copies = rows.reduce((sum, row) => sum + row.picked, 0);
  const words = rows.map((row) => `« ${row.word} »`);
  const list =
    words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} et ${words.at(-1)}`;
  return `Tu vas recycler ${formatCount(copies)} doubles de cartes Épiques ou Légendaires, ${list}.`;
}

/** A tap on a row: picks what goes beyond the card and one double (one at least), or unpicks. */
export function toggledPick(rules: EcuRules, picks: RecyclePicks, row: RecycleRow): RecyclePicks {
  const next = new Map(picks);
  if (row.picked > 0) {
    next.delete(row.cardId);
    return next;
  }
  next.set(row.cardId, Math.min(row.max, Math.max(1, row.quantity - rules.copiesKept)));
  return next;
}

/** The stepper of a row, kept between 0 and all but the last copy. */
export function steppedPick(picks: RecyclePicks, row: RecycleRow, step: 1 | -1): RecyclePicks {
  const next = new Map(picks);
  const copies = Math.max(0, Math.min(row.max, row.picked + step));
  if (copies === 0) next.delete(row.cardId);
  else next.set(row.cardId, copies);
  return next;
}

/**
 * « Garder un double »: among the rows shown, every copy beyond the card and one double, of the
 * rarities recycled together. The rest of the choice stays.
 */
export function extraPicks(
  rules: EcuRules,
  picks: RecyclePicks,
  rows: readonly RecycleRow[],
): RecyclePicks {
  const next = new Map(picks);
  for (const row of rows) {
    if (row.precious || row.quantity <= rules.copiesKept) continue;
    next.set(row.cardId, row.quantity - rules.copiesKept);
  }
  return next;
}

/**
 * « Tout cocher »: among the rows shown, every copy but the last, whatever the rarity; the
 * Épiques and Légendaires among them are asked about once more before they go.
 */
export function allPicks(picks: RecyclePicks, rows: readonly RecycleRow[]): RecyclePicks {
  const next = new Map(picks);
  for (const row of rows) next.set(row.cardId, row.max);
  return next;
}

/** « Tout décocher »: the rows shown lose their pick, the hidden ones keep theirs. */
export function clearedPicks(picks: RecyclePicks, rows: readonly RecycleRow[]): RecyclePicks {
  const next = new Map(picks);
  for (const row of rows) next.delete(row.cardId);
  return next;
}

/** Whether the player holds a double of any card: the recycling button shows only then. */
export function hasDoubles(owned: ReadonlyMap<string, number>): boolean {
  for (const quantity of owned.values()) if (quantity >= 2) return true;
  return false;
}
