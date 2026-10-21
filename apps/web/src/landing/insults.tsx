"use client";

import type { CatalogCard } from "@leximon/contract";
import { useEffect, useState } from "react";
import { loadCatalog } from "@/cards/catalog";
import styles from "./landing-page.module.css";
import { firstSense, INSULT_COLLECTION_ID, INSULT_IDS, pickShowcase } from "./showcase-cards";

interface Insults {
  readonly cards: readonly CatalogCard[];
  /** Cards of the collection left out of the list. */
  readonly others: number;
  readonly collectionName: string;
}

/** A few insults of old, straight from the catalogue: the funniest reason to play. */
export function InsultList() {
  const [insults, setInsults] = useState<Insults | null>(null);

  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((catalog) => {
        const collection = catalog.collections.find((c) => c.id === INSULT_COLLECTION_ID);
        const cards = pickShowcase(catalog.cardsById, INSULT_IDS);
        if (!live || collection === undefined || cards.length === 0) return;
        setInsults({
          cards,
          others: collection.cards.length - cards.length,
          collectionName: collection.name,
        });
      })
      .catch(() => {
        // Without the catalogue the section has nothing to show, so it stays out.
      });
    return () => {
      live = false;
    };
  }, []);

  if (insults === null) return null;
  return (
    <section className={styles.insults} aria-labelledby="insults-title">
      <h2 id="insults-title" className={styles.insultsTitle}>
        Le français savait insulter.
      </h2>
      <p className={styles.insultsLead}>À ressortir au prochain repas de famille.</p>
      <dl className={styles.insultList}>
        {insults.cards.map((card) => (
          <div key={card.id} className={styles.insult}>
            <dt className={styles.insultWord}>{card.word}</dt>
            <dd className={styles.insultDefinition}>{firstSense(card.definition)}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.insultsMore}>
        Et {insults.others} autres dans la collection {insults.collectionName}.
      </p>
    </section>
  );
}
