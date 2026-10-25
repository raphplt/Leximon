import { RARITY_LABELS } from "@leximon/contract";
import { type Rarity, rarityRank } from "@leximon/core";
import type { PackNoun } from "./format";
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

export interface Recap {
  /** The best rarity of the pack and how many cards of it, from Rare up; `null` below. */
  readonly best: { readonly rarity: Rarity; readonly label: string } | null;
  /** "3 mots nouveaux", "1 mot nouveau", "aucun mot nouveau". */
  readonly fresh: string;
}

/** The line under "Ton pli", e.g. "1 Épique · 3 mots nouveaux", the rarity shown with its gem. */
export function recap(cards: readonly DrawnCard[], ownedBefore: OwnedLookup): Recap {
  const top = cards.reduce<DrawnCard | undefined>(
    (best, card) =>
      best === undefined || rarityRank(card.rarity) > rarityRank(best.rarity) ? card : best,
    undefined,
  );
  let best: Recap["best"] = null;
  if (top !== undefined && rarityRank(top.rarity) >= rarityRank("rare")) {
    const count = cards.filter((card) => card.rarity === top.rarity).length;
    best = { rarity: top.rarity, label: `${count} ${RARITY_LABELS[top.rarity]}` };
  }
  const freshCount = new Set(cards.map((card) => card.cardId).filter((id) => !ownedBefore.has(id)))
    .size;
  const fresh =
    freshCount === 0
      ? "aucun mot nouveau"
      : freshCount === 1
        ? "1 mot nouveau"
        : `${freshCount} mots nouveaux`;
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

/** Banner over a first card of its rarity. Précieux is a masculine noun, the others feminine. */
export function firstOfRarityLabel(rarity: Rarity): string {
  const label = RARITY_LABELS[rarity];
  return rarity === "precious" ? `Ton premier ${label} !` : `Ta première ${label} !`;
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
