import { RARITY_LABELS } from "@leximon/contract";
import { type Rarity, rarityRank } from "@leximon/core";

export interface DrawnCard {
  readonly cardId: string;
  readonly rarity: Rarity;
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
export function recap(cards: readonly DrawnCard[], ownedBefore: ReadonlySet<string>): Recap {
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

/** "prochain dans 12 min", "prochain dans 1 h 05", or `null` when the stock is full. */
export function nextRefillLabel(nextRefillAt: string | null, now: number): string | null {
  if (nextRefillAt === null) return null;
  const minutes = Math.max(1, Math.ceil((Date.parse(nextRefillAt) - now) / 60_000));
  if (minutes < 60) return `prochain dans ${minutes} min`;
  const rest = String(minutes % 60).padStart(2, "0");
  return `prochain dans ${Math.floor(minutes / 60)} h ${rest}`;
}

/** "+1 pli bonus", "+3 plis bonus": the reserve shown beside the stock, `null` when empty. */
export function bonusLabel(bonus: number): string | null {
  if (bonus <= 0) return null;
  return `+${bonus} pli${bonus > 1 ? "s" : ""} bonus`;
}
