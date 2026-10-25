"use client";

import { cssFill, rarityStyles } from "@leximon/tokens";
import { capitalize, DEFAULT_PACK_NOUN } from "@leximon/view-model";
import { type CSSProperties, useState } from "react";
import { CardBack } from "@/booster/card-back";
import type { PackCollection } from "@/booster/pack-looks";
import { Sachet } from "@/booster/sachet";
import { Card } from "@/components/card";
import styles from "./landing-page.module.css";
import type { ShowcaseCard } from "./showcase-cards";

const { many } = DEFAULT_PACK_NOUN;
const PAPER = rarityStyles.common;

/** The game in three pictures, printed like a plate of an old encyclopedia. */
export function HowToPlay({
  pack,
  trade,
}: {
  readonly pack: PackCollection | null;
  readonly trade: readonly ShowcaseCard[];
}) {
  const variables = {
    "--paper": PAPER.paper,
    "--ink": PAPER.ink,
    "--muted": PAPER.muted,
    // The challenges mark a right answer with this green, a wrong one with this red.
    "--right": cssFill(rarityStyles.uncommon.frame),
    "--wrong": cssFill(rarityStyles.rare.frame),
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
              <PackFigure collection={pack} />
            </div>
            <p className={styles.figureLabel}>{capitalize(many)}</p>
            <p className={styles.figureText}>
              Gratuits, tous les jours. Il y a des mots qu'on croise souvent, et d'autres qu'on ne
              voit presque jamais.
            </p>
          </li>
          <li className={styles.figure}>
            <div className={styles.figureArt}>
              <ChallengeFigure />
            </div>
            <p className={styles.figureLabel}>Défis</p>
            <p className={styles.figureText}>
              Une question revient juste avant que tu oublies le mot. Chaque bonne réponse le grave
              un peu plus : la carte passe à l'encre, puis à la dorure.
            </p>
          </li>
          <li className={styles.figure}>
            <div className={styles.figureArt}>
              <TradeFigure cards={trade} />
            </div>
            <p className={styles.figureLabel}>Échanges</p>
            <p className={styles.figureText}>
              Tes doubles contre ceux des autres. Carte contre carte.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}

const noop = () => undefined;

/**
 * A sachet of the first collection, as in the game, with three card backs rising out of it: their
 * edges give away a common, a rare and a legendary. Only to look at: `inert` keeps it from tearing.
 */
function PackFigure({ collection }: { readonly collection: PackCollection | null }) {
  return (
    <div className={styles.packScene}>
      <Backs />
      {collection !== null && (
        <div className={styles.pack} inert>
          <Sachet state="sealed" collection={collection} onTearStart={noop} onOpen={noop} />
        </div>
      )}
    </div>
  );
}

function Backs() {
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

const CHOICES = [
  { word: "fouacier", verdict: "Raté. Lui, c'est les galettes." },
  { word: "lucubrateur", verdict: "Bien vu." },
  { word: "canéphore", verdict: "Raté. Elle, c'est les corbeilles." },
] as const;
const RIGHT = "lucubrateur";

/** A question as the challenges ask it, to answer for real: one try, as in the game. */
function ChallengeFigure() {
  const [picked, setPicked] = useState<string | null>(null);
  const verdict = CHOICES.find((choice) => choice.word === picked)?.verdict ?? "Devine.";
  return (
    <div className={styles.quiz}>
      <p className={styles.quizQuestion}>Celui qui travaille la nuit, à la lueur de la lampe.</p>
      {CHOICES.map(({ word }) => (
        <button
          key={word}
          type="button"
          className={choiceClass(word, picked)}
          disabled={picked !== null}
          onClick={() => setPicked(word)}
        >
          {word}
        </button>
      ))}
      <p className={styles.quizVerdict} role="status">
        {verdict}
      </p>
    </div>
  );
}

function choiceClass(word: string, picked: string | null): string {
  if (picked === null) return styles.quizChoice ?? "";
  if (word === RIGHT) return `${styles.quizChoice} ${styles.quizRight}`;
  if (word === picked) return `${styles.quizChoice} ${styles.quizWrong}`;
  return styles.quizChoice ?? "";
}

/** Two real cards crossing hands. */
function TradeFigure({ cards }: { readonly cards: readonly ShowcaseCard[] }) {
  const [left, right] = cards;
  if (left === undefined || right === undefined) return null;
  return (
    <div className={styles.trade}>
      <div className={styles.tradeLeft}>
        <Card card={left.card} collectionName={left.collectionName} width={104} />
      </div>
      <span className={styles.tradeArrows} aria-hidden="true">
        ⇄
      </span>
      <div className={styles.tradeRight}>
        <Card card={right.card} collectionName={right.collectionName} width={104} />
      </div>
    </div>
  );
}
