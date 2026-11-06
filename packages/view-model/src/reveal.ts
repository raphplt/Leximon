import { RARITY_LABELS } from "@leximon/contract";
import { type Rarity, rarityRank } from "@leximon/core";
import type { Gain } from "./challenges";
import { formatCount, type PackNoun } from "./format";
import { countPacks, DEFAULT_PACK_NOUN } from "./pack";

export interface DrawnCard {
  readonly cardId: string;
  readonly rarity: Rarity;
}

/** Cards the player owned before opening the pack: a `Set` of ids or a `Map` of quantities. */
export interface OwnedLookup {
  has(cardId: string): boolean;
}

/** Cards are revealed from the most common to the rarest, so the best one comes last. */
export function revealOrder<T extends DrawnCard>(cards: readonly T[]): T[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rarityRank(a.card.rarity) - rarityRank(b.card.rarity) || a.index - b.index)
    .map(({ card }) => card);
}

export interface RecapEntry<T> {
  readonly card: T;
  /** Its place in the reveal, which the new and hurried cards are counted by. */
  readonly index: number;
}

/** The recap leads with the best card, the opposite of the reveal's suspense. */
export function recapOrder<T extends DrawnCard>(cards: readonly T[]): RecapEntry<T>[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity) || a.index - b.index);
}

export interface Recap {
  /** The best rarity of the pack and how many cards of it, from Rare up; `null` below. */
  readonly best: { readonly rarity: Rarity; readonly label: string } | null;
  /** "3 nouveaux mots", "1 nouveau mot", "aucun nouveau mot". */
  readonly fresh: string;
}

/** The line under "Ton sachet", e.g. "2 Épiques · 3 nouveaux mots", the rarity shown with its gem. */
export function recap(cards: readonly DrawnCard[], ownedBefore: OwnedLookup): Recap {
  const top = cards.reduce<DrawnCard | undefined>(
    (best, card) =>
      best === undefined || rarityRank(card.rarity) > rarityRank(best.rarity) ? card : best,
    undefined,
  );
  let best: Recap["best"] = null;
  if (top !== undefined && rarityRank(top.rarity) >= rarityRank("rare")) {
    const count = cards.filter((card) => card.rarity === top.rarity).length;
    const label = count > 1 ? RARITY_PLURAL[top.rarity] : RARITY_LABELS[top.rarity];
    best = { rarity: top.rarity, label: `${count} ${label}` };
  }
  const freshCount = new Set(cards.map((card) => card.cardId).filter((id) => !ownedBefore.has(id)))
    .size;
  const fresh =
    freshCount === 0
      ? "aucun nouveau mot"
      : freshCount === 1
        ? "1 nouveau mot"
        : `${freshCount} nouveaux mots`;
  return { best, fresh };
}

/** Copies owned once the card at `index` is added: the pack can hold the same card twice. */
export function copiesAt(
  cards: readonly DrawnCard[],
  index: number,
  quantitiesBefore: ReadonlyMap<string, number>,
): number {
  const card = cards[index];
  if (card === undefined) return 0;
  const inPack = cards.slice(0, index + 1).filter((c) => c.cardId === card.cardId).length;
  return (quantitiesBefore.get(card.cardId) ?? 0) + inPack;
}

/**
 * The player's very first card of this rarity, from Rare up: worth a banner. Courant and Peu
 * courant are left out, since every first pack holds them.
 */
export function isFirstOfRarity(
  cards: readonly DrawnCard[],
  index: number,
  raritiesBefore: ReadonlySet<Rarity>,
): boolean {
  const card = cards[index];
  if (card === undefined || rarityRank(card.rarity) < rarityRank("rare")) return false;
  if (raritiesBefore.has(card.rarity)) return false;
  return !cards.slice(0, index).some((c) => c.rarity === card.rarity);
}

/** Banner over a first card of its rarity: « Ta première carte Précieuse ! ». */
export function firstOfRarityLabel(rarity: Rarity): string {
  return `Ta première carte ${RARITY_SINGULAR_FEMININE[rarity]} !`;
}

const RARITY_SINGULAR_FEMININE: Readonly<Record<Rarity, string>> = {
  common: "Courante",
  uncommon: "Peu courante",
  rare: "Rare",
  precious: "Précieuse",
  epic: "Épique",
  legendary: "Légendaire",
};

const RARITY_PLURAL: Readonly<Record<Rarity, string>> = {
  common: "Courantes",
  uncommon: "Peu courantes",
  rare: "Rares",
  precious: "Précieuses",
  epic: "Épiques",
  legendary: "Légendaires",
};

/** A rarity of the collection now complete, for the recap's banner: what is complete, what it earned. */
export function rarityCompletedGain(completion: { rarity: Rarity; xp: number }): Gain {
  return {
    title: `Toutes les ${RARITY_PLURAL[completion.rarity]}`,
    note: `Réunies, +${formatCount(completion.xp)} XP`,
  };
}

/** A rarity of the collection now complete: « Toutes les cartes Légendaires réunies ! +1 000 XP ». */
export function rarityCompletedLabel(completion: { rarity: Rarity; xp: number }): string {
  return `Toutes les cartes ${RARITY_PLURAL[completion.rarity]} réunies ! +${formatCount(completion.xp)} XP`;
}

/** The collection's figure on a sachet's recap: « 40 / 519 », the cards it gave, the bar's two parts. */
export interface CollectionTally {
  readonly figure: string;
  /** « +5 », or `null` when the sachet gave nothing new. */
  readonly gained: string | null;
  /** Share owned before the sachet, then after it, between 0 and 1. */
  readonly before: number;
  readonly after: number;
}

export function collectionTally(progress: CollectionProgress): CollectionTally {
  const share = (count: number) => (progress.total === 0 ? 0 : count / progress.total);
  return {
    figure: `${formatCount(progress.owned)} / ${formatCount(progress.total)}`,
    gained: progress.gained > 0 ? `+${formatCount(progress.gained)}` : null,
    before: share(progress.owned - progress.gained),
    after: share(progress.owned),
  };
}

export interface CollectionProgress {
  /** Distinct cards of the collection owned. */
  readonly owned: number;
  readonly total: number;
  /** Distinct cards of the collection gained from this pack. */
  readonly gained: number;
}

/** Progress in a collection after the cards up to `upTo` (included) have been added. */
export function collectionProgress(
  collectionCardIds: ReadonlySet<string>,
  ownedBefore: ReadonlyMap<string, number>,
  cards: readonly DrawnCard[],
  upTo: number = cards.length - 1,
): CollectionProgress {
  let ownedCount = 0;
  for (const id of ownedBefore.keys()) if (collectionCardIds.has(id)) ownedCount += 1;
  const gained = new Set(
    cards
      .slice(0, upTo + 1)
      .map((card) => card.cardId)
      .filter((id) => collectionCardIds.has(id) && !ownedBefore.has(id)),
  ).size;
  return { owned: ownedCount + gained, total: collectionCardIds.size, gained };
}

/** "prochain dans 12 min", "prochain dans 1 h 05", or `null` when the stock is full. */
export function nextRefillLabel(nextRefillAt: string | null, now: number): string | null {
  if (nextRefillAt === null) return null;
  const minutes = Math.max(1, Math.ceil((Date.parse(nextRefillAt) - now) / 60_000));
  if (minutes < 60) return `prochain dans ${minutes} min`;
  const rest = String(minutes % 60).padStart(2, "0");
  return `prochain dans ${Math.floor(minutes / 60)} h ${rest}`;
}

/** "+1 pli bonus", "+3 sachets bonus": the reserve shown beside the stock, `null` when empty. */
export function bonusLabel(bonus: number, noun: PackNoun = DEFAULT_PACK_NOUN): string | null {
  if (bonus <= 0) return null;
  return `+${countPacks(bonus, noun)} bonus`;
}
