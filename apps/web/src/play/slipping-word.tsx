"use client";

import { capitalize, SLIPPING_AWAY } from "@leximon/view-model";
import { useEffect, useState } from "react";
import { type Catalog, collectionName } from "@/cards/catalog";
import { Card } from "@/components/card";
import { fetchChallenges } from "@/lib/api";
import { ButtonLink } from "@/ui/button";
import styles from "./play.module.css";

/** The word most at risk of being forgotten; nothing when no word is due. */
export function SlippingWord({ catalog }: { readonly catalog: Catalog }) {
  const [cardId, setCardId] = useState<string | null>(null);
  useEffect(() => {
    fetchChallenges(1)
      .then((challenges) => setCardId(challenges.questions[0]?.cardId ?? null))
      .catch(() => undefined);
  }, []);
  const card = cardId === null ? undefined : catalog.cardsById.get(cardId);
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
