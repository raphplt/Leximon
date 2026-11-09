"use client";

import { cardSize } from "@leximon/tokens";
import { type CSSProperties, useState } from "react";
import { CardBack } from "@/booster/card-back";
import { play } from "@/booster/feedback";
import { Card } from "@/components/card";
import { TitleRule, Tooling } from "@/ui/ornaments";
import { Kicker, Lettering, Toy } from "@/ui/toy";
import styles from "./landing-page.module.css";
import { useNarrow } from "./narrow";
import type { ShowcaseCard } from "./showcase-cards";

/** Interactive table of 4 forgotten insults: flip them one by one or all at once. */
export function Guess({ cards }: { readonly cards: readonly ShowcaseCard[] }) {
  const narrow = useNarrow();
  const [turned, setTurned] = useState<ReadonlySet<string>>(new Set());
  if (cards.length === 0) return null;
  const width = narrow ? 144 : 204;
  const height = Math.round((width * cardSize.height) / cardSize.width);
  const allTurned = turned.size === cards.length;

  const turn = (id: string) => {
    play("cardSlide");
    setTurned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    play("cardSlide");
    if (allTurned) {
      setTurned(new Set());
    } else {
      setTurned(new Set(cards.map((item) => item.card.id)));
    }
  };

  return (
    <section
      id="defi-cartes"
      className={`${styles.cabinet} ${styles.section}`}
      data-tone="velours"
      aria-labelledby="guess-title"
    >
      <Tooling />
      <div className={styles.sectionHead}>
        <Kicker>Défi en direct · Insultes et figures d'autrefois</Kicker>
        <h2 id="guess-title" className={styles.sectionTitle}>
          <Lettering>Sauras-tu démasquer ces quatre mots ?</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          On traitait les gens de tout ça, jadis. Touche une carte pour retourner son dos et
          découvrir sa définition du Littré.
        </p>
        <div className={styles.guessBar}>
          <span className={styles.guessScore}>
            {turned.size} sur {cards.length} {turned.size > 1 ? "mots révélés" : "mot révélé"}
          </span>
          <Toy matter="paper" onClick={toggleAll} className={styles.guessToggle}>
            <Lettering>{allTurned ? "Replier les cartes" : "Tout révéler"}</Lettering>
          </Toy>
        </div>
        <TitleRule className={styles.sectionRule} />
      </div>

      <ul className={styles.guess}>
        {cards.map(({ card, collectionName }) => {
          const isTurned = turned.has(card.id);
          return (
            <li key={card.id} className={styles.guessSlot}>
              <div className={styles.cardMat}>
                <button
                  type="button"
                  className={styles.flip}
                  style={{ "--w": `${width}px`, "--h": `${height}px` } as CSSProperties}
                  data-turned={isTurned || undefined}
                  aria-pressed={isTurned}
                  aria-label={
                    isTurned
                      ? `${card.word} : ${card.definition}`
                      : `${card.word}, retourner la carte`
                  }
                  onClick={() => turn(card.id)}
                >
                  <span className={styles.flipFront}>
                    <CardBack rarity={card.rarity} width={width} />
                    <span className={styles.flipWord}>
                      <Lettering>{card.word}</Lettering>
                      <span className={styles.flipHint} aria-hidden="true">
                        Retourner ›
                      </span>
                    </span>
                  </span>
                  <span className={styles.flipBack}>
                    <Card card={card} collectionName={collectionName} width={width} />
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
