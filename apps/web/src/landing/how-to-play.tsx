"use client";

import type { CatalogCard } from "@leximon/contract";
import type { ToyMatterName } from "@leximon/tokens";
import { useEffect, useState } from "react";
import { Sachet } from "@/booster/sachet";
import { Card } from "@/components/card";
import { TitleRule, Tooling } from "@/ui/ornaments";
import { Kicker, Leaf, Lettering, ToyBody, ToyIcon } from "@/ui/toy";
import styles from "./landing-page.module.css";
import type { Showcase, ShowcaseCard } from "./showcase-cards";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** How the game is played: three royal showcase cards with live scenes inside a midnight cabinet. */
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
    <section
      id="comment-jouer"
      className={`${styles.cabinet} ${styles.section}`}
      data-tone="nuit"
      aria-labelledby="how-title"
    >
      <Tooling />
      <div className={styles.sectionHead}>
        <Kicker>Le jeu en trois actes</Kicker>
        <h2 id="how-title" className={styles.sectionTitle}>
          <Lettering>Tire, maîtrise et échange tes trésors</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          Tout le jeu est gratuit. Aucun sachet ne s'achète et aucune carte ne se vend.
        </p>
        <TitleRule className={styles.sectionRule} />
      </div>

      <ol className={styles.how}>
        <li>
          <Leaf className={styles.howLeaf}>
            <div className={styles.howArt} data-tone="emeraude">
              <span className={styles.howStep} aria-hidden="true">
                <Lettering>I</Lettering>
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
            <Lettering className={styles.howTitle}>Ouvre tes sachets gratuits</Lettering>
            <p className={styles.howText}>
              Six sachets t'attendent à l'arrivée, puis un nouveau arrive chaque heure. Chaque
              sachet contient cinq cartes gravées.
            </p>
          </Leaf>
        </li>

        <li>
          <Leaf className={styles.howLeaf}>
            <div className={styles.howArt} data-tone="nuit">
              <span className={styles.howStep} aria-hidden="true">
                <Lettering>II</Lettering>
              </span>
              <QuizFigure words={quiz} />
            </div>
            <Lettering className={styles.howTitle}>Dore tes cartes par les défis</Lettering>
            <p className={styles.howText}>
              Retrouve le sens ou l'orthographe de tes mots pour les faire monter de l'Esquisse à
              l'Encre, jusqu'à la Dorure, et gagne des sachets bonus.
            </p>
            <div className={styles.masterySteps}>
              <span className={styles.masteryBadge}>
                <ToyIcon name="sketch" size={15} /> Esquisse
              </span>
              <span aria-hidden="true">›</span>
              <span className={styles.masteryBadge}>
                <ToyIcon name="ink" size={15} /> Encre
              </span>
              <span aria-hidden="true">›</span>
              <span className={styles.masteryBadge}>
                <ToyIcon name="gilded" size={15} /> Dorure
              </span>
            </div>
          </Leaf>
        </li>

        <li>
          <Leaf className={styles.howLeaf}>
            <div className={styles.howArt} data-tone="velours">
              <span className={styles.howStep} aria-hidden="true">
                <Lettering>III</Lettering>
              </span>
              <TradeFigure trade={trade} />
            </div>
            <Lettering className={styles.howTitle}>Échange & pars en Joute</Lettering>
            <p className={styles.howText}>
              Troque tes doubles carte contre carte avec les autres joueurs, rejoins un clan et
              mesure ton vocabulaire dans les Joutes.
            </p>
          </Leaf>
        </li>
      </ol>
    </section>
  );
}

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

function shortDefinition(definition: string): string {
  const cut = definition.search(/[.;]/);
  return cut === -1 ? definition : `${definition.slice(0, cut)}.`;
}

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
