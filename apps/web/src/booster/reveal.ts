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

/** One line under "Ton pli", e.g. "1 Épique · 3 mots nouveaux". */
export function recapLine(cards: readonly DrawnCard[], ownedBefore: ReadonlySet<string>): string {
  const parts: string[] = [];
  const best = cards.reduce<DrawnCard | undefined>(
    (top, card) =>
      top === undefined || rarityRank(card.rarity) > rarityRank(top.rarity) ? card : top,
    undefined,
  );
  if (best !== undefined && rarityRank(best.rarity) >= rarityRank("rare")) {
    const count = cards.filter((card) => card.rarity === best.rarity).length;
    parts.push(`${count} ${RARITY_LABELS[best.rarity]}`);
  }
  const fresh = new Set(cards.map((card) => card.cardId).filter((id) => !ownedBefore.has(id))).size;
  if (fresh === 0) parts.push("aucun mot nouveau");
  else parts.push(fresh === 1 ? "1 mot nouveau" : `${fresh} mots nouveaux`);
  return parts.join(" · ");
}

/** "prochain dans 12 min", "prochain dans 1 h 05", or `null` when the stock is full. */
export function nextRefillLabel(nextRefillAt: string | null, now: number): string | null {
  if (nextRefillAt === null) return null;
  const minutes = Math.max(1, Math.ceil((Date.parse(nextRefillAt) - now) / 60_000));
  if (minutes < 60) return `prochain dans ${minutes} min`;
  const rest = String(minutes % 60).padStart(2, "0");
  return `prochain dans ${Math.floor(minutes / 60)} h ${rest}`;
}
