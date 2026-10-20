"use client";

import { type CatalogCard, RARITY_LABELS } from "@leximon/contract";
import { useEffect, useRef } from "react";
import { type Catalog, cardOrPlaceholder, collectionName } from "@/cards/catalog";
import { Card } from "@/components/card";
import { CardCaption } from "@/components/card-caption";
import styles from "./trades.module.css";

/** The card behind an id from the API; a placeholder if this catalogue does not know it. */
export function catalogCard(catalog: Catalog, cardId: string): CatalogCard {
  return cardOrPlaceholder(catalog, cardId, catalog.cardsById.get(cardId)?.rarity ?? "common");
}

export function cardLabel(card: CatalogCard): string {
  return `${card.word}, ${RARITY_LABELS[card.rarity]}`;
}

/** A row of small cards; each opens the full card, too small to read otherwise. */
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

/** The full card in a modal dialog, closed with Escape, the button or a tap on the backdrop. */
export function CardZoom({
  catalog,
  card,
  onClose,
}: {
  readonly catalog: Catalog;
  readonly card: CatalogCard | null;
  readonly onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (card !== null) dialog.current?.showModal();
  }, [card]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape already closes a modal dialog; the click only adds backdrop dismissal.
    <dialog
      ref={dialog}
      className={styles.dialog}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      {card !== null && (
        <div className={styles.zoom}>
          <Card card={card} collectionName={collectionName(catalog, card.collectionId)} />
          <CardCaption card={card} />
          <button
            type="button"
            className={styles.secondary}
            onClick={() => dialog.current?.close()}
          >
            Fermer
          </button>
        </div>
      )}
    </dialog>
  );
}
