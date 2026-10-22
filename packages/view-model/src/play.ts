import type { BoosterSource, BoosterWalletResponse } from "@leximon/contract";
import {
  canOpenCollection,
  type EpochMs,
  RARITIES,
  type Rarity,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
} from "@leximon/core";
import { levelBadge, levelsOfFeatures } from "./features";
import { formatCount, formatWait } from "./format";

/** The Jouer screen and the stock shown in the top bar. */

// --- Stock --------------------------------------------------------------------------------

export interface StockView {
  readonly stored: number;
  readonly capacity: number;
  readonly bonus: number;
  /** Nothing to open: the sachet turns grey and still. */
  readonly empty: boolean;
  /** « +1 dans 18 min », « plein », « 2 bonus »: the note beside the count. */
  readonly note: string;
  /** « Ouvrir le sachet », « Ouvrir un sachet bonus », « Prochain dans 18 min ». */
  readonly action: string;
  /** « 18 min », « plein »: the short form of the top bar chip. */
  readonly refillShort: string;
  /** « 4 sachets sur 6, 2 bonus en réserve », for screen readers. */
  readonly description: string;
}

export function stockView(wallet: BoosterWalletResponse, now: EpochMs): StockView {
  const wait =
    wallet.nextRefillAt === null ? null : formatWait(Date.parse(wallet.nextRefillAt) - now);
  const { stored, capacity, bonus } = wallet;
  const note =
    stored >= capacity ? "plein" : stored === 0 && bonus > 0 ? `${bonus} bonus` : `+1 dans ${wait}`;
  return {
    stored,
    capacity,
    bonus,
    empty: stored === 0 && bonus === 0,
    note,
    action:
      stored > 0
        ? "Ouvrir le sachet"
        : bonus > 0
          ? "Ouvrir un sachet bonus"
          : `Prochain dans ${wait}`,
    refillShort: wait ?? "plein",
    description: `${stored} ${stored > 1 ? "sachets" : "sachet"} sur ${capacity}, ${bonus} bonus en réserve`,
  };
}

/** The recap's button once the cards are seen: open another, a bonus, or wait. */
export function openAgainLabel(wallet: BoosterWalletResponse, now: EpochMs): string {
  if (wallet.stored > 0) return "Ouvrir un autre sachet";
  if (wallet.bonus > 0) return "Ouvrir un sachet bonus";
  const wait =
    wallet.nextRefillAt === null ? "" : `, ${formatWait(Date.parse(wallet.nextRefillAt) - now)}`;
  return `Plus de sachet${wait}`;
}

// --- Reserve of bonus sachets ---------------------------------------------------------------

export interface ReserveView {
  /** « 3 sachets bonus ». */
  readonly headline: string;
  /** « Dont 1 garni, ouvert en premier. », or nothing without a garni. */
  readonly garni: string | null;
  /** « 3 places prises sur 12. » */
  readonly places: string;
  readonly rule: string;
  readonly sources: string;
  /** The free stock is empty: a bonus opens now. */
  readonly openNow: boolean;
}

/** What the top bar's bonus chip opens: the reserve, when it serves, where it fills from. */
export function reserveView(wallet: BoosterWalletResponse): ReserveView {
  const { bonus, garni, bonusCap, stored } = wallet;
  return {
    headline: `${bonus} ${bonus > 1 ? "sachets bonus" : "sachet bonus"}`,
    garni:
      garni === 0
        ? null
        : garni > 1
          ? `Dont ${garni} garnis, ouverts en premier.`
          : "Dont 1 garni, ouvert en premier.",
    places: `${bonus} ${bonus > 1 ? "places prises" : "place prise"} sur ${bonusCap}.`,
    rule: "Ils s'ouvrent quand ton stock gratuit est vide.",
    sources:
      "Ils viennent des coffrets, du défi du jour, des cartes dorées et des objectifs de clan.",
    openNow: stored === 0 && bonus > 0,
  };
}

// --- Collection of the sachet --------------------------------------------------------------

export interface CollectionChoice {
  readonly id: string;
  readonly name: string;
  readonly short: string;
  readonly source: BoosterSource;
  /** `null` when open, else « Niv. 3 ». */
  readonly lock: string | null;
}

/**
 * One sachet per published collection, the starter one first. Before the level that opens the
 * choice, only the starter sachet opens; the others show their level.
 */
export function collectionChoices(
  collections: readonly { readonly id: string; readonly name: string }[],
  level: number,
  now: EpochMs,
): CollectionChoice[] {
  const rules = unlockRulesAt(UNLOCK_SCHEDULE, now);
  const lock = levelBadge(rules.levels.choose_collection);
  const starterFirst = [
    ...collections.filter((c) => c.id === rules.starterCollection),
    ...collections.filter((c) => c.id !== rules.starterCollection),
  ];
  return starterFirst.map((c) => ({
    id: c.id,
    name: c.name,
    short: shortName(c.name),
    source: { kind: "collection", collectionId: c.id } as const,
    lock: canOpenCollection(rules, c.id, level) ? null : lock,
  }));
}

const ARTICLES = new Set(["le", "la", "les", "l'", "un", "une", "des"]);

/** « Caractères et travers » → « Caractères », « Les Fondateurs » → « Fondateurs »: the first word that is not an article, for chips. */
export function shortName(name: string): string {
  const words = name.split(/\s+/);
  return words.find((w) => !ARTICLES.has(w.toLowerCase())) ?? name;
}

/** The choice kept when the one asked for is closed or gone: the starter sachet. */
export function pickCollection(
  choices: readonly CollectionChoice[],
  wanted: string | null,
): CollectionChoice {
  const found = choices.find((c) => c.id === wanted && c.lock === null);
  // The starter sachet is always first and always open.
  return found ?? (choices[0] as CollectionChoice);
}

// --- Word slipping away --------------------------------------------------------------------

/** « Lucubrateur est en train de t'échapper. », split so that the word can be set in italics. */
export const SLIPPING_AWAY = { after: " est en train de t'échapper.", action: "Réviser" } as const;

// --- Floating buttons -----------------------------------------------------------------------

export type FabId = "clan" | "chat" | "jousts" | "daily" | "coffrets" | "mail" | "settings";

export interface Fab {
  readonly id: FabId;
  readonly label: string;
  /** Red count of what waits for the player; 0 shows nothing (never a nudge to come back). */
  readonly badge: number;
  /** « Niv. 10 » when closed by the level. */
  readonly lock: string | null;
  /** Gold and pulsing: a coffret waits. */
  readonly glow: boolean;
}

export interface FabInput {
  readonly level: number;
  readonly coffrets: number;
  readonly mail: number;
}

export function playFabs(input: FabInput, now: EpochMs): { left: Fab[]; right: Fab[] } {
  const levels = levelsOfFeatures(now);
  const lockOf = (featureLevel: number) =>
    input.level >= featureLevel ? null : levelBadge(featureLevel);
  const fab = (id: FabId, label: string, extra: Partial<Fab> = {}): Fab => ({
    id,
    label,
    badge: 0,
    lock: null,
    glow: false,
    ...extra,
  });
  return {
    left: [
      fab("clan", "Clan", { lock: lockOf(levels.join_clan) }),
      fab("chat", "Discussion", { lock: lockOf(levels.join_clan) }),
      fab("jousts", "Joutes", { lock: lockOf(levels.jousts) }),
    ],
    right: [
      fab("daily", "Défi du jour"),
      fab("coffrets", "Coffrets", { badge: input.coffrets, glow: input.coffrets > 0 }),
      fab("mail", "Courrier", { badge: input.mail }),
      fab("settings", "Réglages"),
    ],
  };
}

// --- Collection of the sachet, beside the counter -------------------------------------------

export interface ShelfRarity {
  readonly rarity: Rarity;
  readonly owned: number;
  readonly total: number;
}

export interface CollectionShelf {
  readonly owned: number;
  readonly total: number;
  /** Share of the words found, 0 to 1. */
  readonly ratio: number;
  /** « 132 / 520 mots ». */
  readonly count: string;
  /** Every rarity of the collection, the most common first; rarities it lacks are left out. */
  readonly rarities: readonly ShelfRarity[];
}

/** How much of a collection the player has found, rarity by rarity. */
export function collectionShelf(
  cards: readonly { readonly id: string; readonly rarity: Rarity }[],
  owned: ReadonlyMap<string, number>,
): CollectionShelf {
  const rarities = RARITIES.map((rarity) => {
    const ofRarity = cards.filter((card) => card.rarity === rarity);
    return {
      rarity,
      owned: ofRarity.filter((card) => (owned.get(card.id) ?? 0) > 0).length,
      total: ofRarity.length,
    };
  }).filter((row) => row.total > 0);
  const found = rarities.reduce((sum, row) => sum + row.owned, 0);
  return {
    owned: found,
    total: cards.length,
    ratio: cards.length === 0 ? 0 : found / cards.length,
    count: `${formatCount(found)} / ${formatCount(cards.length)} mots`,
    rarities,
  };
}
