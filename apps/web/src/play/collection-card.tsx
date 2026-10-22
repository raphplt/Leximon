"use client";

import { collectionShelf } from "@leximon/view-model";
import type { Catalog } from "@/cards/catalog";
import { RarityName } from "@/components/rarity-icon";
import { ButtonLink } from "@/ui/button";
import { XpBar } from "@/ui/level-bits";
import styles from "./play.module.css";

/** How much of the sachet's collection the player has found: what the next sachet can fill. */
export function CollectionCard({
  catalog,
  collectionId,
  owned,
}: {
  readonly catalog: Catalog;
  readonly collectionId: string;
  readonly owned: ReadonlyMap<string, number>;
}) {
  const collection = catalog.collections.find((c) => c.id === collectionId);
  if (collection === undefined) return null;
  const shelf = collectionShelf(collection.cards, owned);
  return (
    <section className={`${styles.card} ${styles.collection}`} aria-label="Ta collection">
      <h2 className={styles.cardKicker}>Ta collection</h2>
      <div>
        <p className={styles.collectionName}>{collection.name}</p>
        <p className={styles.collectionCount}>{shelf.count}</p>
      </div>
      <XpBar ratio={shelf.ratio} thin />
      <ul className={styles.rarities}>
        {shelf.rarities.map((row) => (
          <li key={row.rarity} className={styles.rarity}>
            <RarityName rarity={row.rarity} />
            <span className={styles.rarityCount}>
              {row.owned} / {row.total}
            </span>
          </li>
        ))}
      </ul>
      <ButtonLink href="/album" variant="secondary" small className={styles.collectionLink}>
        Voir l'album
      </ButtonLink>
    </section>
  );
}
