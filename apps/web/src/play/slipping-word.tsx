"use client";

import { capitalize, SLIPPING_AWAY } from "@leximon/view-model";
import { type Catalog, collectionName } from "@/cards/catalog";
import { Card } from "@/components/card";
import { ButtonLink } from "@/ui/button";
import styles from "./play.module.css";

/** The word most at risk of being forgotten, read by the screen with the rest of the counter. */
export function SlippingWord({
  catalog,
  cardId,
}: {
  readonly catalog: Catalog;
  readonly cardId: string;
}) {
  const card = catalog.cardsById.get(cardId);
  if (card === undefined) return null;
  return (
    <div className={styles.slipping}>
      <span className={styles.slippingCard}>
        <Card card={card} collectionName={collectionName(catalog, card.collectionId)} width={54} />
      </span>
      <p className={styles.slippingText}>
        <em>{capitalize(card.word)}</em>
        {SLIPPING_AWAY.after}
      </p>
      <ButtonLink href="/defis" variant="secondary" small>
        {SLIPPING_AWAY.action}
      </ButtonLink>
    </div>
  );
}
