"use client";

import { type CatalogCard, RARITY_LABELS } from "@leximon/contract";
import { type Catalog, cardOrPlaceholder, collectionName } from "@/cards/catalog";
import { Card } from "@/components/card";
import styles from "./trades.module.css";

/** The card behind an id from the API; a placeholder if this catalogue does not know it. */
export function catalogCard(catalog: Catalog, cardId: string): CatalogCard {
  return cardOrPlaceholder(catalog, cardId, catalog.cardsById.get(cardId)?.rarity ?? "common");
}

export function cardLabel(card: CatalogCard): string {
  return `${card.word}, ${RARITY_LABELS[card.rarity]}`;
}

/** A row of small cards; each opens its card sheet, too small to read otherwise. */
export function CardRow({
  catalog,
  cardIds,
  width,
  onZoom,
}: {
  readonly catalog: Catalog;
  readonly cardIds: readonly string[];
  readonly width: number;
  readonly onZoom: (card: CatalogCard) => void;
}) {
  return (
    <ul className={styles.cardRow}>
      {cardIds.map((cardId) => {
        const card = catalogCard(catalog, cardId);
        return (
          <li key={cardId}>
            <button
              type="button"
              className={styles.thumb}
              onClick={() => onZoom(card)}
              aria-label={`Voir la carte ${cardLabel(card)}`}
            >
              <Card
                card={card}
                collectionName={collectionName(catalog, card.collectionId)}
                width={width}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
