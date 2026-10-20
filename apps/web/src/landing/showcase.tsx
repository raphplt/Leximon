"use client";

import type { CatalogCard } from "@leximon/contract";
import { useEffect, useState } from "react";
import { type Catalog, collectionName, loadCatalog } from "@/cards/catalog";
import { engravingOf } from "@/cards/engraving";
import { Card } from "@/components/card";
import { HoloCard } from "@/components/holo-card";
import styles from "./landing-page.module.css";
import { pickShowcase, SHOWCASE_CARD_IDS } from "./showcase-cards";

const SIDE_WIDTH = 168;
const CENTER_WIDTH = 196;

/**
 * Three real cards of the published catalogue, fanned out, the middle one catching the light.
 * Decoration only: if the catalogue cannot be read, the page stands without them.
 */
export function Showcase() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((loaded) => {
        if (live) setCatalog(loaded);
      })
      .catch(() => {
        // The text of the page says it all; the cards only illustrate it.
      });
    return () => {
      live = false;
    };
  }, []);

  const cards = catalog === null ? [] : pickShowcase(catalog.cardsById, SHOWCASE_CARD_IDS);
  if (catalog === null || cards.length === 0) {
    return <div className={styles.fanPlaceholder} aria-hidden="true" />;
  }
  const middle = Math.floor(cards.length / 2);

  return (
    <figure className={styles.showcase}>
      <div className={styles.fan}>
        {cards.map((card, index) => (
          <div key={card.id} className={styles.fanSlot} data-slot={index - middle}>
            {index === middle ? (
              <HoloCard
                card={card}
                collectionName={collectionName(catalog, card.collectionId)}
                width={CENTER_WIDTH}
              />
            ) : (
              <Card
                card={card}
                collectionName={collectionName(catalog, card.collectionId)}
                width={SIDE_WIDTH}
              />
            )}
          </div>
        ))}
      </div>
      <Credits cards={cards} />
    </figure>
  );
}

/** CC BY asks for the credit wherever the engraving is shown. */
function Credits({ cards }: { readonly cards: readonly CatalogCard[] }) {
  const credits = cards.flatMap((card) => {
    const engraving = engravingOf(card);
    return engraving === null ? [] : [`${card.word} : ${engraving.credit}`];
  });
  if (credits.length === 0) return null;
  return <figcaption className={styles.credits}>Gravures · {credits.join(" · ")}</figcaption>;
}
