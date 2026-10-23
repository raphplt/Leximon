"use client";

import type { CatalogCard } from "@leximon/contract";
import { formatCount } from "@leximon/view-model";
import { useEffect, useState } from "react";
import { type Catalog, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import styles from "./landing-page.module.css";
import { COLLECTION_SHOWCASE, pickShowcase } from "./showcase-cards";

interface Shelf {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly cards: readonly CatalogCard[];
}

function shelves(catalog: Catalog): Shelf[] {
  return COLLECTION_SHOWCASE.flatMap(({ collectionId, cardIds }) => {
    const collection = catalog.collections.find((c) => c.id === collectionId);
    const cards = pickShowcase(catalog.cardsById, cardIds);
    if (collection === undefined || cards.length === 0) return [];
    return [{ id: collection.id, name: collection.name, count: collection.cards.length, cards }];
  });
}

/**
 * At display size the narrow space between thousands looks like no space at all: the title
 * takes a full no-break space.
 */
function displayCount(value: number): string {
  return formatCount(value).replaceAll("\u202f", "\u00a0");
}

/** The launch collections, each shown by three real cards. */
export function Collections() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((loaded) => {
        if (live) setCatalog(loaded);
      })
      .catch(() => {
        // Without the catalogue the section has nothing to show, so it stays out.
      });
    return () => {
      live = false;
    };
  }, []);

  if (catalog === null) return null;
  const found = shelves(catalog);
  if (found.length === 0) return null;
  const total = found.reduce((sum, shelf) => sum + shelf.count, 0);
  return (
    <section className={styles.collections} aria-labelledby="collections-title">
      <h2 id="collections-title" className={styles.collectionsTitle}>
        {displayCount(total)} mots pour commencer.
      </h2>
      <ul className={styles.shelves}>
        {found.map((shelf) => (
          <li key={shelf.id} className={styles.shelf}>
            <div className={styles.fanned} aria-hidden="true">
              {shelf.cards.map((card, index) => (
                <div key={card.id} className={styles[`fan${index}`]}>
                  <Card card={card} collectionName={shelf.name} width={150} />
                </div>
              ))}
            </div>
            <p className={styles.shelfName}>{shelf.name}</p>
            <p className={styles.shelfCount}>{formatCount(shelf.count)} cartes</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
