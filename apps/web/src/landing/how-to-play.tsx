"use client";

import type { CatalogCard } from "@leximon/contract";
import type { ToyMatterName } from "@leximon/tokens";
import { useEffect, useState } from "react";
import { Sachet } from "@/booster/sachet";
import { Card } from "@/components/card";
import { Fleurons } from "@/ui/ornaments";
import { Kicker, Leaf, Lettering, ToyBody } from "@/ui/toy";
import styles from "./landing-page.module.css";
import type { Showcase, ShowcaseCard } from "./showcase-cards";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** How the game is played: three leaves, each with a piece of the game that moves. */
export function HowToPlay({
  pack,
  trade,
  quiz,
}: {
  readonly pack: Showcase["pack"];
  readonly trade: readonly ShowcaseCard[];
  readonly quiz: readonly CatalogCard[];
}) {
  return (
    <section id="comment-jouer" className={styles.section} aria-labelledby="how-title">
      <div className={styles.sectionHead}>
        <Kicker>Trois gestes</Kicker>
        <h2 id="how-title" className={styles.sectionTitle}>
          <Lettering>Comment on joue</Lettering>
        </h2>
      </div>
      <ol className={styles.how}>
        <li>
          <Leaf className={styles.howLeaf}>
            <Fleurons />
            <div className={styles.howArt}>
              <span className={styles.howStep} aria-hidden="true">
                <Lettering>1</Lettering>
              </span>
              <div className={styles.howSachet}>
                {pack !== null && (
                  <Sachet
                    collection={pack}
                    state="sealed"
                    onTearStart={() => undefined}
                    onOpen={() => undefined}
                  />
                )}
              </div>
            </div>
            <Lettering className={styles.howTitle}>Des sachets chaque jour</Lettering>
            <p className={styles.howText}>
              Tes sachets se remplissent tout seuls, gratuitement. Certains mots sont courants,
              d'autres n'apparaissent presque jamais.
            </p>
          </Leaf>
        </li>
        <li>
          <Leaf className={styles.howLeaf}>
            <Fleurons />
            <div className={styles.howArt}>
              <span className={styles.howStep} aria-hidden="true">
                <Lettering>2</Lettering>
              </span>
              <QuizFigure words={quiz} />
            </div>
            <Lettering className={styles.howTitle}>Des mots qui montent</Lettering>
            <p className={styles.howText}>
              Quelques questions par jour sur tes mots. Un mot que tu retiens fait monter sa carte,
              de l'Esquisse jusqu'à la Dorure.
            </p>
          </Leaf>
        </li>
        <li>
          <Leaf className={styles.howLeaf}>
            <Fleurons />
            <div className={styles.howArt}>
              <span className={styles.howStep} aria-hidden="true">
                <Lettering>3</Lettering>
              </span>
              <TradeFigure trade={trade} />
            </div>
            <Lettering className={styles.howTitle}>Des doubles à échanger</Lettering>
            <p className={styles.howText}>
              Tu échanges tes doubles avec d'autres joueurs, une carte contre une carte, pour finir
              tes collections.
            </p>
          </Leaf>
        </li>
      </ol>
    </section>
  );
}

/** A question of the review on its tiles: the right word turns green, again and again. */
function QuizFigure({ words }: { readonly words: readonly CatalogCard[] }) {
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setAnswered(true);
      return;
    }
    const timer = window.setInterval(() => setAnswered((value) => !value), 1800);
    return () => window.clearInterval(timer);
  }, []);
  const asked = words.find((card) => card.id === "lucubrateur") ?? words[0];
  if (asked === undefined) return null;
  const others = words.filter((card) => card.id !== asked.id).slice(0, 2);
  const choices = [others[0], asked, others[1]].filter(
    (card): card is CatalogCard => card !== undefined,
  );
  return (
    <div className={styles.quiz}>
      <p className={styles.quizPrompt}>{shortDefinition(asked.definition)}</p>
      {choices.map((card) => {
        const right = card.id === asked.id;
        const matter: ToyMatterName = answered && right ? "green" : "paper";
        return (
          <ToyBody key={card.id} matter={matter} className={styles.quizChoice}>
            <Lettering>{card.word}</Lettering>
          </ToyBody>
        );
      })}
    </div>
  );
}

/** The first sentence of a definition, for a figure that has little room. */
function shortDefinition(definition: string): string {
  const cut = definition.search(/[.;]/);
  return cut === -1 ? definition : `${definition.slice(0, cut)}.`;
}

/** Two cards crossing over, each to the other player. */
function TradeFigure({ trade }: { readonly trade: readonly ShowcaseCard[] }) {
  const [left, right] = trade;
  if (left === undefined || right === undefined) return null;
  return (
    <div className={styles.trade}>
      <span className={styles.tradeLeft}>
        <Card card={left.card} collectionName={left.collectionName} width={104} />
      </span>
      <span className={styles.tradeRight}>
        <Card card={right.card} collectionName={right.collectionName} width={104} />
      </span>
    </div>
  );
}
