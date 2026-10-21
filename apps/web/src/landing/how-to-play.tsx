"use client";

import { cssFill, rarityStyles } from "@leximon/tokens";
import { type CSSProperties, useEffect, useState } from "react";
import { CardBack } from "@/booster/card-back";
import { type Catalog, collectionName, loadCatalog } from "@/cards/catalog";
import { Card } from "@/components/card";
import { capitalize, DEFAULT_PACK_NOUN } from "@/lib/pack-shape";
import styles from "./landing-page.module.css";
import { pickShowcase, TRADE_CARD_IDS } from "./showcase-cards";

const { many } = DEFAULT_PACK_NOUN;
const PAPER = rarityStyles.common;

/** The game in three figures, printed like a plate of an old encyclopedia. */
export function HowToPlay() {
  const variables = {
    "--paper": PAPER.paper,
    "--ink": PAPER.ink,
    "--muted": PAPER.muted,
    // The challenges mark a right answer with this green too.
    "--right": cssFill(rarityStyles.uncommon.frame),
  } as CSSProperties;
  return (
    <section className={styles.plate} style={variables} aria-labelledby="how-to-play">
      <div className={styles.plateInner}>
        <h2 id="how-to-play" className={styles.plateTitle}>
          Mode d'emploi
        </h2>
        <ol className={styles.figures}>
          <li className={styles.figure}>
            <div className={styles.figureArt}>
              <PackFigure />
            </div>
            <p className={styles.figureLabel}>Fig. 1. {capitalize(many)}</p>
            <p className={styles.figureText}>
              Gratuits, tous les jours. Il y a des mots qu'on croise souvent, et d'autres qu'on ne
              voit presque jamais.
            </p>
          </li>
          <li className={styles.figure}>
            <div className={styles.figureArt}>
              <ChallengeFigure />
            </div>
            <p className={styles.figureLabel}>Fig. 2. Défis</p>
            <p className={styles.figureText}>
              Une question revient juste avant que tu oublies le mot. Tu réponds, la carte passe à
              l'Encre, puis à la Dorure.
            </p>
          </li>
          <li className={styles.figure}>
            <div className={styles.figureArt}>
              <TradeFigure />
            </div>
            <p className={styles.figureLabel}>Fig. 3. Échanges</p>
            <p className={styles.figureText}>
              Tes doubles contre ceux des autres. Carte contre carte.
            </p>
          </li>
        </ol>
        <p className={styles.sources}>
          Les définitions viennent du Littré, les gravures de vieux livres.
        </p>
      </div>
    </section>
  );
}

/** Three card backs fanned out, their edges giving away a common, a rare and a legendary. */
function PackFigure() {
  return (
    <div className={styles.backs}>
      <div className={styles.backLeft}>
        <CardBack rarity="common" width={92} edge={1} />
      </div>
      <div className={styles.backMiddle}>
        <CardBack rarity="rare" width={92} edge={1} />
      </div>
      <div className={styles.backRight}>
        <CardBack rarity="legendary" width={92} edge={1} />
      </div>
    </div>
  );
}

/** A question as the challenges ask it, the right answer already ticked. */
function ChallengeFigure() {
  return (
    <div className={styles.quiz} aria-hidden="true">
      <p className={styles.quizQuestion}>Celui qui travaille la nuit, à la lueur de la lampe.</p>
      <span className={styles.quizChoice}>fouacier</span>
      <span className={`${styles.quizChoice} ${styles.quizRight}`}>lucubrateur</span>
      <span className={styles.quizChoice}>canéphore</span>
    </div>
  );
}

/** Two real cards crossing hands. */
function TradeFigure() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((loaded) => {
        if (live) setCatalog(loaded);
      })
      .catch(() => {
        // The caption says it; the cards only show it.
      });
    return () => {
      live = false;
    };
  }, []);

  const cards = catalog === null ? [] : pickShowcase(catalog.cardsById, TRADE_CARD_IDS);
  const [left, right] = cards;
  if (catalog === null || left === undefined || right === undefined) return null;
  return (
    <div className={styles.trade}>
      <div className={styles.tradeLeft}>
        <Card card={left} collectionName={collectionName(catalog, left.collectionId)} width={104} />
      </div>
      <span className={styles.tradeArrows} aria-hidden="true">
        ⇄
      </span>
      <div className={styles.tradeRight}>
        <Card
          card={right}
          collectionName={collectionName(catalog, right.collectionId)}
          width={104}
        />
      </div>
    </div>
  );
}
