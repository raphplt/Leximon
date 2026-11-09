"use client";

import { cardSize } from "@leximon/tokens";
import { type CSSProperties, useState } from "react";
import { CardBack } from "@/booster/card-back";
import { play } from "@/booster/feedback";
import { Card } from "@/components/card";
import { Kicker, Lettering } from "@/ui/toy";
import styles from "./landing-page.module.css";
import { useNarrow } from "./narrow";
import type { ShowcaseCard } from "./showcase-cards";

/** Words to guess: the back of the card with the word on it, its face once turned. */
export function Guess({ cards }: { readonly cards: readonly ShowcaseCard[] }) {
  const narrow = useNarrow();
  const [turned, setTurned] = useState<ReadonlySet<string>>(new Set());
  if (cards.length === 0) return null;
  const width = narrow ? 140 : 196;
  const height = Math.round((width * cardSize.height) / cardSize.width);
  const turn = (id: string) => {
    play("cardSlide");
    setTurned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <section id="deviner" className={styles.section} aria-labelledby="guess-title">
      <div className={styles.sectionHead}>
        <Kicker>Mots oubliés</Kicker>
        <h2 id="guess-title" className={styles.sectionTitle}>
          <Lettering>Tu sais ce que c'est ?</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          On traitait les gens de tout ça, autrefois. Touche une carte pour découvrir son sens.
        </p>
      </div>
      <ul className={styles.guess}>
        {cards.map(({ card, collectionName }) => {
          const shown = turned.has(card.id);
          return (
            <li key={card.id}>
              <button
                type="button"
                className={styles.flip}
                data-turned={shown || undefined}
                style={{ width, height } as CSSProperties}
                aria-pressed={shown}
                aria-label={shown ? `${card.word}, retourner la carte` : `${card.word} ?`}
                onClick={() => turn(card.id)}
              >
                <span className={styles.flipFront}>
                  <CardBack rarity={card.rarity} width={width} />
                  <span className={styles.flipWord}>
                    <Lettering>{card.word} ?</Lettering>
                    <span className={styles.flipHint}>Retourner ›</span>
                  </span>
                </span>
                <span className={styles.flipBack}>
                  <Card card={card} collectionName={collectionName} width={width} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
