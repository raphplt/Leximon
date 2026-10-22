"use client";

import { cssFill, rarityStyles } from "@leximon/tokens";
import { bestFinds, collectionShelf } from "@leximon/view-model";
import type { CSSProperties } from "react";
import type { Catalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { ButtonLink } from "@/ui/button";
import { XpBar } from "@/ui/level-bits";
import styles from "./play.module.css";

/**
 * How much of the sachet's collection the player has found: what the next sachet can fill, and
 * the rarest words already on the shelf when the card has room for them.
 */
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
  const best = bestFinds(collection.cards, owned, 3);
  return (
    <section className={`${styles.card} ${styles.collection}`} aria-label="Ta collection">
      <h2 className={styles.cardKicker}>Ta collection</h2>
      <div>
        <p className={styles.collectionName}>{collection.name}</p>
        <p className={styles.collectionCount}>{shelf.count}</p>
      </div>
      <XpBar ratio={shelf.ratio} thin />
      {best.length > 0 && (
        <div className={styles.finds} aria-hidden="true">
          {best.map((card) => (
            <div key={card.id} className={styles.find}>
              <Card card={card} collectionName={collection.name} width={104} />
            </div>
          ))}
        </div>
      )}
      <ul className={styles.rarities}>
        {shelf.rarities.map((row) => (
          <li key={row.rarity} className={styles.rarity}>
            <span className={styles.rarityLine}>
              <RarityName rarity={row.rarity} />
              <span className={styles.rarityCount}>
                {row.owned} / {row.total}
              </span>
            </span>
            <span
              className={styles.rarityBar}
              style={
                {
                  "--fill": cssFill(rarityStyles[row.rarity].frame),
                  "--found": `${(row.owned / row.total) * 100}%`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          </li>
        ))}
      </ul>
      <ButtonLink href="/album" variant="secondary" small className={styles.collectionLink}>
        Voir l'album
      </ButtonLink>
    </section>
  );
}
