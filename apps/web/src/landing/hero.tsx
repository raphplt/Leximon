"use client";

import type { CatalogCard } from "@leximon/contract";
import { effects, openingTimes, rarityLights } from "@leximon/tokens";
import { frequencyLine, LANDING_PITCH, LANDING_TITLE, stagingFor } from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
import { play } from "@/booster/feedback";
import { RevealCard } from "@/booster/reveal-card";
import { Sachet } from "@/booster/sachet";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { Desk, PaperAction } from "@/library/play-pieces";
import { useStage } from "@/ui/stage";
import { Kicker, Leaf, Lettering } from "@/ui/toy";
import { DiscordLink } from "./discord";
import type { Door } from "./door";
import styles from "./landing-page.module.css";
import { useNarrow } from "./narrow";
import { DoorAction } from "./player-access";
import type { Showcase } from "./showcase-cards";

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

/**
 * The first screen: the promise, the door, and a real sachet on the desk that the visitor tears
 * on the spot. The card comes from the page's own few words: nothing is asked of the server and
 * nothing is kept.
 */
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
    <section className={styles.hero} aria-labelledby="landing-title">
      <div className={styles.pitch}>
        <h1 id="landing-title" className={styles.title}>
          <Lettering>{LANDING_TITLE}</Lettering>
        </h1>
        <Leaf className={styles.lead}>
          <p>{LANDING_PITCH}</p>
        </Leaf>
        <DoorAction door={door} />
        <DiscordLink className={styles.discord} />
      </div>

      <div ref={deskRef} className={styles.counter}>
        <Desk className={styles.counterDesk} />
        {phase.name === "sealed" || phase.name === "opening" ? (
          <>
            <div ref={sachetRef} className={styles.sachet} data-moment={moment}>
              {pack !== null && (
                <Sachet
                  key={round}
                  collection={pack}
                  state={moment === "burst" ? "opening" : "sealed"}
                  onTearStart={() => undefined}
                  onOpen={open}
                />
              )}
            </div>
            <p className={styles.deskHint} data-gone={phase.name === "opening" || undefined}>
              <Kicker>Un sachet t'attend. Déchire-le.</Kicker>
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
              width={narrow ? 138 : 188}
            />
            <div className={styles.revealedText}>
              <span className={styles.revealedRarity}>
                <RarityName rarity={phase.card.rarity} />
              </span>
              <span>{frequencyLine(phase.card.perBillion)}</span>
              <PaperAction label="Un autre sachet" onClick={again} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
