"use client";

import { Sachet } from "@/booster/sachet";
import { Card } from "@/components/card";
import type { Showcase } from "@/landing/showcase-cards";
import { Desk } from "@/library/play-pieces";
import { Kicker, Lettering } from "@/ui/toy";
import styles from "./store-plate.module.css";

export type StoreFormat = "play" | "header" | "poster";

const nothing = () => {};

/**
 * The art of the store pages, composed with the game's own pieces and captured by a headless
 * browser at the size each store asks: the sachet on the desk between two rare cards, and for
 * Google Play the seal, the name and the promise beside it. Apple writes the app's name over its
 * header, so that one carries no text.
 */
export function StorePlate({
  format,
  showcase,
}: {
  readonly format: StoreFormat;
  readonly showcase: Showcase;
}) {
  const [left, right] = [
    showcase.ladder.find(({ card }) => card.rarity === "epic"),
    showcase.ladder.find(({ card }) => card.rarity === "legendary"),
  ];
  return (
    <main className={`${styles.plate} ${styles[format]}`}>
      {format === "play" && (
        <div className={styles.brand}>
          <div className={styles.name}>
            {/* biome-ignore lint/performance/noImgElement: a capture, no layout shift to avoid */}
            <img src="/logo-mark.svg" alt="" className={styles.seal} />
            <Lettering className={styles.title}>Leximon</Lettering>
          </div>
          <Kicker>Les mots oubliés, en cartes</Kicker>
        </div>
      )}
      <div className={styles.scene}>
        <Desk className={styles.desk} />
        {left !== undefined && (
          <div className={`${styles.card} ${styles.left}`}>
            <Card card={left.card} collectionName={left.collectionName} width={196} />
          </div>
        )}
        {showcase.pack !== null && (
          <div className={styles.sachet}>
            <Sachet
              state="sealed"
              collection={showcase.pack}
              onTearStart={nothing}
              onOpen={nothing}
              still
            />
          </div>
        )}
        {right !== undefined && (
          <div className={`${styles.card} ${styles.right}`}>
            <Card card={right.card} collectionName={right.collectionName} width={196} />
          </div>
        )}
      </div>
    </main>
  );
}
