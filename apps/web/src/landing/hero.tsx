"use client";

import type { CatalogCard } from "@leximon/contract";
import { effects, openingTimes, rarityLights } from "@leximon/tokens";
import { frequencyLine, LANDING_PITCH, LANDING_TITLE, stagingFor } from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
import { play } from "@/booster/feedback";
import type { PackCollection } from "@/booster/pack-looks";
import { RevealCard } from "@/booster/reveal-card";
import { Sachet } from "@/booster/sachet";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { PaperAction } from "@/library/play-pieces";
import { Fleurons, GiltCorners, Tooling } from "@/ui/ornaments";
import { useStage } from "@/ui/stage";
import { Kicker, Leaf, Lettering, ToyIcon } from "@/ui/toy";
import { DiscordLink } from "./discord";
import type { Door } from "./door";
import styles from "./landing-page.module.css";
import { useNarrow } from "./narrow";
import { DoorAction } from "./player-access";
import type { Showcase } from "./showcase-cards";

const SIDE_PACKS: readonly [PackCollection, PackCollection] = [
  { id: "caracteres", name: "Caractères et travers", back: "burgundy" },
  { id: "metiers", name: "Métiers et objets disparus", back: "green" },
];

const HERO_STATS = [
  { figure: "1 561", label: "mots rares du Littré" },
  { figure: "6", label: "paliers de rareté" },
  { figure: "3", label: "collections illustrées" },
  { figure: "0 €", label: "de hasard payant" },
] as const;

/** Where the seam of the sachet runs, from its top: the sparks of the charge leak from there. */
const SEAM_AT = 0.13;
const CHARGE_SPARKS_MAX = 6;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type HeroPhase =
  | { readonly name: "sealed" }
  | { readonly name: "opening"; readonly card: CatalogCard }
  | { readonly name: "revealing"; readonly card: CatalogCard }
  | { readonly name: "revealed"; readonly card: CatalogCard };

type Moment = "waiting" | "arriving" | "charging" | "burst";

export function Hero({
  door,
  words,
  collectionNames,
  pack,
}: {
  readonly door: Door;
  readonly words: readonly CatalogCard[];
  readonly collectionNames: Readonly<Record<string, string>>;
  readonly pack: Showcase["pack"];
}) {
  const stage = useStage();
  const narrow = useNarrow();
  const [phase, setPhase] = useState<HeroPhase>({ name: "sealed" });
  const [moment, setMoment] = useState<Moment>("waiting");
  const [round, setRound] = useState(0);
  const sachetRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  const later = (ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  };

  const open = () => {
    if (phase.name !== "sealed" || words.length === 0) return;
    const card = words[Math.floor(Math.random() * words.length)];
    if (card === undefined) return;
    play("tearFinish");
    setPhase({ name: "opening", card });
    if (prefersReducedMotion()) {
      setPhase({ name: "revealing", card });
      return;
    }
    setMoment("arriving");
    let beats = 0;
    let sparks = 0;
    later(openingTimes.arriveMs, () => {
      setMoment("charging");
      sparks = window.setInterval(() => {
        const box = sachetRef.current?.getBoundingClientRect();
        if (box === undefined) return;
        beats++;
        stage.burst(box.left + box.width / 2, box.top + box.height * SEAM_AT, {
          ...effects.charge.burst,
          count: Math.min(CHARGE_SPARKS_MAX, 1 + Math.floor(beats / 4)),
        });
      }, effects.charge.everyMs);
    });
    later(openingTimes.arriveMs + openingTimes.chargeMs, () => {
      window.clearInterval(sparks);
      setMoment("burst");
      const box = sachetRef.current?.getBoundingClientRect();
      if (box !== undefined) {
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        for (const settings of effects.burst) stage.burst(x, y, settings);
        stage.ring(x, y, rarityLights.epic[0] ?? "white", 6);
        stage.flash(1, 500);
      }
      if (deskRef.current !== null) stage.shake(deskRef.current, 10, 450);
    });
    later(openingTimes.arriveMs + openingTimes.chargeMs + openingTimes.burstMs, () => {
      play("cardSlide");
      setMoment("waiting");
      setPhase({ name: "revealing", card });
    });
  };

  const again = () => {
    setPhase({ name: "sealed" });
    setRound((value) => value + 1);
  };

  const cardWidth = narrow ? 168 : 228;
  return (
    <section className={styles.heroWrap} aria-labelledby="landing-title">
      <div className={`${styles.cabinet} ${styles.hero}`} data-tone="acajou">
        <Tooling />
        <Fleurons />
        <div className={styles.pitch}>
          <span className={styles.heroBadge}>
            <ToyIcon name="gilded" size={18} />
            <span>Jeu de cartes à collectionner · 100 % gratuit</span>
          </span>
          <h1 id="landing-title" className={styles.title}>
            <Lettering>{LANDING_TITLE}</Lettering>
          </h1>
          <p className={styles.leadText}>{LANDING_PITCH}</p>
          <ul className={styles.heroPillars} aria-label="Piliers du jeu">
            <li className={styles.heroPillar}>
              <span className={styles.pillarIcon}>
                <ToyIcon name="sachet" size={20} />
              </span>
              <span>Sachets gratuits</span>
            </li>
            <li className={styles.heroPillar}>
              <span className={styles.pillarIcon}>
                <ToyIcon name="challenges" size={20} />
              </span>
              <span>Défis & Dorure</span>
            </li>
            <li className={styles.heroPillar}>
              <span className={styles.pillarIcon}>
                <ToyIcon name="trades" size={20} />
              </span>
              <span>Échanges & Joutes</span>
            </li>
          </ul>
          <DoorAction door={door} />
          <DiscordLink className={styles.discord} />
        </div>

        <div ref={deskRef} className={styles.counter}>
          <div className={styles.counterWell} aria-hidden="true">
            <Tooling />
          </div>
          {phase.name === "sealed" || phase.name === "opening" ? (
            <>
              <div className={styles.counterHead} data-gone={phase.name === "opening" || undefined}>
                <Kicker>Table d'ouverture en direct</Kicker>
                <Lettering className={styles.counterName}>
                  {pack?.name ?? "Les Fondateurs"}
                </Lettering>
              </div>
              <div ref={sachetRef} className={styles.sachet} data-moment={moment}>
                {!narrow && (
                  <div
                    className={styles.heroPeeks}
                    data-gone={phase.name === "opening" || undefined}
                    aria-hidden="true"
                  >
                    <div className={styles.heroPeekLeft}>
                      <Sachet
                        collection={SIDE_PACKS[0]}
                        state="sealed"
                        still
                        onTearStart={() => undefined}
                        onOpen={() => undefined}
                      />
                    </div>
                    <div className={styles.heroPeekRight}>
                      <Sachet
                        collection={SIDE_PACKS[1]}
                        state="sealed"
                        still
                        onTearStart={() => undefined}
                        onOpen={() => undefined}
                      />
                    </div>
                  </div>
                )}
                {pack !== null && (
                  <div className={styles.heroFront}>
                    <Sachet
                      key={round}
                      collection={pack}
                      state={moment === "burst" ? "opening" : "sealed"}
                      onTearStart={() => undefined}
                      onOpen={open}
                    />
                  </div>
                )}
              </div>
              <p className={styles.deskHint} data-gone={phase.name === "opening" || undefined}>
                <Kicker>Déchire ou touche le sachet pour tirer une carte ›</Kicker>
              </p>
            </>
          ) : phase.name === "revealing" ? (
            <div className={styles.reveal}>
              <RevealCard
                card={phase.card}
                collectionName={collectionNames[phase.card.collectionId] ?? ""}
                backTone={pack?.back}
                staging={stagingFor(phase.card.rarity, {
                  reducedMotion: prefersReducedMotion(),
                  hurried: false,
                })}
                width={cardWidth}
                isNew
                copies={1}
                firstLabel={null}
                stage={stage}
                onNext={() => setPhase({ name: "revealed", card: phase.card })}
              />
            </div>
          ) : (
            <div className={styles.revealed}>
              <Card
                card={phase.card}
                collectionName={collectionNames[phase.card.collectionId] ?? ""}
                width={narrow ? 148 : 196}
              />
              <div className={styles.revealedText}>
                <span className={styles.revealedRarity}>
                  <RarityName rarity={phase.card.rarity} />
                </span>
                <span>{frequencyLine(phase.card.perBillion)}</span>
                <PaperAction label="Ouvrir un autre sachet" onClick={again} />
              </div>
            </div>
          )}
        </div>
      </div>

      <dl className={styles.statRibbon} aria-label="En quelques chiffres">
        {HERO_STATS.map((stat) => (
          <Leaf key={stat.label} className={styles.statPlaque}>
            <GiltCorners />
            <dd className={styles.statFigure}>
              <Lettering>{stat.figure}</Lettering>
            </dd>
            <dt className={styles.statLabel}>{stat.label}</dt>
          </Leaf>
        ))}
      </dl>
    </section>
  );
}
