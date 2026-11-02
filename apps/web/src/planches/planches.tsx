"use client";

import { RARITIES, type Rarity } from "@leximon/core";
import {
  effects,
  libraryTheme,
  rarityLights,
  revealBanner,
  revealEffects,
  type ToyIconName,
  type ToyMatterName,
  toyIcons,
} from "@leximon/tokens";
import { type RarityStaging, stagingFor } from "@leximon/view-model";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { CardBack } from "@/booster/card-back";
import type { PackCollection } from "@/booster/pack-looks";
import { Avatar } from "@/components/avatar";
import {
  CollectionTitle,
  Desk,
  InfoBubble,
  LevelGauge,
  MailButton,
  MainAction,
  PaperAction,
  PortraitButton,
  SideTile,
  StockButton,
  TabBar,
} from "@/library/play-pieces";
import { Aura, RarityBanner, Rays, Sheen } from "@/library/reveal-pieces";
import { LibrarySachet } from "@/library/sachet";
import { ParticleStage, useStage } from "@/ui/stage";
import { Kicker, Leaf, Lettering, Toy, ToyIcon } from "@/ui/toy";
import styles from "./planches.module.css";

const COLLECTIONS: readonly (PackCollection & { readonly tagline: string })[] = [
  {
    id: "fondateurs",
    name: "Les Fondateurs",
    back: "night",
    tagline: "De l'abajoue à la logodiarrhée.",
  },
  {
    id: "caracteres",
    name: "Caractères et travers",
    back: "burgundy",
    tagline: "Des mots pour railler les défauts de chacun.",
  },
  {
    id: "metiers",
    name: "Métiers et objets disparus",
    back: "green",
    tagline: "Les gestes et les outils d'avant.",
  },
];

const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  precious: "Précieuse",
  epic: "Épique",
  legendary: "Légendaire",
};

const MATTERS: readonly ToyMatterName[] = ["gold", "red", "green", "blue", "paper", "locked"];
const ICON_NAMES = Object.keys(toyIcons) as ToyIconName[];

/**
 * The pieces of « La Bibliothèque », whatever the look of this browser: the Jouer screen put
 * together, then each piece on its own, and the effects to set off by hand.
 */
export function Planches() {
  return (
    <main data-look="bibliotheque" className={styles.page} style={libraryTheme() as CSSProperties}>
      <ParticleStage dust>
        <header className={styles.header}>
          <Kicker>Planches</Kicker>
          <Lettering className={styles.title}>La Bibliothèque</Lettering>
          <p className={styles.intro}>
            Les pièces de la nouvelle allure, avant qu'elles entrent dans le jeu. Touche tout : les
            objets s'enfoncent, le sachet s'ouvre, les boutons d'effets montrent chaque rareté.
          </p>
        </header>
        <div className={styles.columns}>
          <PlayScreen />
          <div className={styles.plates}>
            <Plate title="Les objets">
              <Objects />
            </Plate>
            <Plate title="Le lettrage et la feuille">
              <Letters />
            </Plate>
            <Plate title="Les effets">
              <Effects />
            </Plate>
            <Plate title="Les icônes">
              <div className={styles.icons}>
                {ICON_NAMES.map((name) => (
                  <ToyIcon key={name} name={name} size={44} />
                ))}
              </div>
            </Plate>
          </div>
        </div>
      </ParticleStage>
    </main>
  );
}

function Plate({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={styles.plate}>
      <h2 className={styles.plateTitle}>
        <Lettering>{title}</Lettering>
      </h2>
      {children}
    </section>
  );
}

/** The Jouer screen put together, at the size of a phone. */
function PlayScreen() {
  const stage = useStage();
  const screen = useRef<HTMLDivElement>(null);
  const sachet = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [charging, setCharging] = useState(false);
  const [bubble, setBubble] = useState<{ readonly text: string } | null>(null);
  const collection = COLLECTIONS[index] ?? COLLECTIONS[0];
  if (collection === undefined) return null;

  const say = (text: string) => setBubble({ text });
  const turn = (step: number) =>
    setIndex((current) => (current + step + COLLECTIONS.length) % COLLECTIONS.length);

  const open = () => {
    const box = sachet.current?.getBoundingClientRect();
    if (box === undefined || charging) return;
    setCharging(true);
    const seam = { x: box.left + box.width / 2, y: box.top + 30 };
    let sparks = 0;
    const timer = window.setInterval(() => {
      sparks++;
      stage.burst(seam.x, seam.y, {
        ...effects.charge.burst,
        count: 1 + Math.floor(sparks / 4),
      });
    }, effects.charge.everyMs);
    window.setTimeout(() => {
      window.clearInterval(timer);
      const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      for (const settings of effects.burst) stage.burst(center.x, center.y, settings);
      stage.ring(center.x, center.y, rarityLights.epic[0] ?? "white", 6);
      stage.flash(1, 500);
      if (screen.current) stage.shake(screen.current, 10, 450);
      setCharging(false);
    }, 1100);
  };

  return (
    <div ref={screen} className={styles.phone}>
      <Desk className={styles.desk} />
      <header className={styles.top}>
        <PortraitButton label="Mon profil" onClick={() => say("Ton profil s'ouvrirait ici.")}>
          <Avatar avatar={null} frame={null} size={40} />
        </PortraitButton>
        <LevelGauge level={7} progress={0.62} label="62 / 100" />
        <StockButton
          label="6 sachets sur 6"
          figure="6/6"
          onClick={() => say("Ton stock est plein.")}
        />
        <MailButton label="Courrier, 2 messages" count={2} />
      </header>
      <div className={styles.play}>
        <CollectionTitle
          kicker="Sachet"
          name={collection.name}
          tagline={collection.tagline}
          index={index}
          count={COLLECTIONS.length}
          previousLabel="Collection précédente"
          nextLabel="Collection suivante"
          onPrevious={() => turn(-1)}
          onNext={() => turn(1)}
        />
        <div className={styles.left}>
          <SideTile
            icon="clan"
            matter="blue"
            label="Clan"
            lockedAt="Niv. 10"
            onClick={() => say("Le clan s'ouvre au niveau 10.")}
          />
          <SideTile
            icon="discussion"
            matter="green"
            label="Discussion"
            lockedAt="Niv. 10"
            onClick={() => say("La discussion s'ouvre au niveau 10.")}
          />
          <SideTile
            icon="jousts"
            matter="red"
            label="Joutes"
            lockedAt="Niv. 15"
            onClick={() => say("Les joutes s'ouvrent au niveau 15.")}
          />
        </div>
        <div className={styles.right}>
          <SideTile
            icon="challenge"
            matter="red"
            label="Défi du jour"
            badge="!"
            onClick={() => say("Le défi du jour t'attend : cinq mots à retrouver.")}
          />
          <SideTile
            icon="friends"
            matter="green"
            label="Amis"
            onClick={() => say("Tu as 3 amis.")}
          />
          <SideTile
            icon="chest"
            matter="blue"
            label="Récompenses"
            badge="1"
            onClick={(event) => {
              const tile = event.currentTarget.getBoundingClientRect();
              stage.burst(tile.left + tile.width / 2, tile.top + tile.height / 2, effects.reward);
            }}
          />
          <SideTile icon="settings" matter="gold" label="Réglages" />
        </div>
        <div ref={sachet} className={styles.sachet}>
          <LibrarySachet
            collection={collection}
            label="Ouvrir le sachet"
            countLabel="5 cartes"
            state={charging ? "charging" : "sealed"}
            onOpen={open}
          />
        </div>
      </div>
      <div className={styles.cta}>
        <MainAction label="Ouvrir le sachet" count="6" inviting={!charging} onClick={open} />
      </div>
      <TabBar
        playLabel="Jouer"
        tabs={[
          { icon: "album", label: "Album" },
          { icon: "challenges", label: "Défis", badge: "1" },
          { icon: "trades", label: "Échanges", lockedAt: "Niv. 8" },
          { icon: "community", label: "Communauté" },
        ]}
        onTab={(tab) => {
          if (tab === 2) say("Les échanges s'ouvrent au niveau 8.");
        }}
      />
      <InfoBubble message={bubble} />
    </div>
  );
}

function Objects() {
  return (
    <div className={styles.objects}>
      <div className={styles.row}>
        {MATTERS.map((matter) => (
          <Toy key={matter} matter={matter} shape="tile" className={styles.sampleTile}>
            <ToyIcon name="sachet" size={34} locked={matter === "locked"} />
          </Toy>
        ))}
      </div>
      <div className={styles.row}>
        {MATTERS.map((matter) => (
          <Toy key={matter} matter={matter} className={styles.sampleBox}>
            <Lettering>{matter === "locked" ? "Fermé" : "Toucher"}</Lettering>
          </Toy>
        ))}
      </div>
      <div className={styles.row}>
        <MainAction label="Ouvrir un autre sachet" count="5" />
      </div>
      <div className={styles.row}>
        <PaperAction label="Voir mes cartes" />
      </div>
    </div>
  );
}

function Letters() {
  return (
    <div className={styles.letters}>
      <Lettering className={styles.big}>Légendaire</Lettering>
      <Lettering className={styles.medium}>Caractères et travers</Lettering>
      <Lettering className={styles.small}>Niv. 10 · 62 / 100</Lettering>
      <Leaf className={styles.leaf}>
        <p className={styles.leafTitle}>abajoue</p>
        <p>
          Poche que certains animaux, comme le hamster, ont dans la joue pour garder leur
          nourriture. Par plaisanterie, joue pendante d'une personne.
        </p>
      </Leaf>
    </div>
  );
}

const CARD_WIDTH = 150;
const TREMBLES: Readonly<Record<RarityStaging["announce"], number>> = {
  none: 0,
  edge: 0,
  tremble: 1.5,
  crack: 2.5,
  eclipse: 3.5,
};

type Moment = "rest" | "announce" | "waiting" | "turning" | "shown";

function stagingOf(rarity: Rarity): RarityStaging {
  return stagingFor(rarity, { reducedMotion: false, hurried: false });
}

function shiver(element: HTMLElement | null, strength: number, ms: number): void {
  if (element === null || strength === 0) return;
  const steps = Math.max(2, Math.round(ms / 45));
  const frames: Keyframe[] = Array.from({ length: steps }, (_, index) => {
    const reach = (index % 2 === 0 ? 1 : -1) * strength * (0.6 + index / steps);
    return { translate: `${reach}px 0`, rotate: `${reach * 0.6}deg` };
  });
  element.animate([...frames, { translate: "0 0", rotate: "0deg" }], { duration: ms });
}

/**
 * One card turned as in the game: its announcement on the back, the player's touch from
 * Précieuse up, then the light of its rarity as the face shows.
 */
function Effects() {
  const stage = useStage();
  const target = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [rarity, setRarity] = useState<Rarity>("common");
  const [moment, setMoment] = useState<Moment>("rest");
  const [turned, setTurned] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [stamp, setStamp] = useState(0);
  const [sweep, setSweep] = useState(0);
  const staging = stagingOf(rarity);
  const effect = revealEffects[rarity];
  const light = rarityLights[rarity][0] ?? "white";
  const banner = revealBanner[rarity];

  const later = (ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const center = () => {
    const box = target.current?.getBoundingClientRect();
    return box === undefined ? null : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };

  const turnOver = (chosen: Rarity) => {
    const { flipMs, spotlight } = stagingOf(chosen);
    setMoment("turning");
    setTurned(true);
    card.current?.animate([{ scale: "1" }, { scale: "1.18" }, { scale: "1" }], {
      duration: flipMs,
      easing: "ease-out",
    });
    later(flipMs / 2, () => {
      const point = center();
      if (point !== null) {
        stage.reveal(
          point.x,
          point.y,
          revealEffects[chosen],
          rarityLights[chosen][0] ?? "white",
          target.current ?? document.body,
        );
      }
      setSweep((value) => value + 1);
      if (revealBanner[chosen] !== undefined) setStamp((value) => value + 1);
      setLifted(spotlight);
      setMoment("shown");
    });
  };

  const draw = (chosen: Rarity) => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setRarity(chosen);
    setTurned(false);
    setLifted(false);
    const chosenStaging = stagingOf(chosen);
    // The face must be hidden again before it turns.
    later(30, () => {
      if (chosenStaging.flip === "instant") {
        turnOver(chosen);
        return;
      }
      setMoment("announce");
      shiver(card.current, TREMBLES[chosenStaging.announce], chosenStaging.announceMs);
      later(chosenStaging.announceMs, () => {
        if (chosenStaging.flip === "auto") turnOver(chosen);
        else setMoment("waiting");
      });
    });
  };

  const touch = () => {
    if (moment !== "waiting") return;
    setMoment("turning");
    if (effect.drawInMs > 0) {
      const point = center();
      if (point !== null) stage.drawIn(point.x, point.y, rarityLights[rarity], effect.drawInMs);
      shiver(card.current, TREMBLES[staging.announce] * 1.6, effect.drawInMs);
    }
    later(effect.drawInMs, () => turnOver(rarity));
  };

  const announced = moment === "announce" || moment === "waiting" || moment === "turning";
  const auraStrength =
    moment === "rest" || (staging.announce === "none" && moment !== "shown")
      ? 0
      : announced
        ? 0.9
        : rarity === "common"
          ? 0.25
          : 0.6;

  return (
    <div className={styles.effects}>
      <p className={styles.effectsNote}>
        Dans le jeu, ces effets jouent à l'ouverture d'un sachet, quand chaque carte se retourne.
        Plus la carte est rare, plus son annonce dure, et à partir de Précieuse c'est toi qui la
        retournes.
      </p>
      <div className={styles.revealZone}>
        <Aura size={CARD_WIDTH * 2.6} color={light} strength={auraStrength} />
        <Rays size={CARD_WIDTH * 3} color={light} shown={moment === "shown" && effect.rays} />
        <button
          ref={target}
          type="button"
          className={styles.demoButton}
          onClick={touch}
          disabled={moment !== "waiting"}
          aria-label="Retourner la carte"
          data-lifted={lifted || undefined}
        >
          <div
            ref={card}
            className={styles.demoCard}
            data-turned={turned || undefined}
            style={{ transitionDuration: `${staging.flipMs}ms` }}
          >
            <div className={styles.demoBack}>
              <CardBack rarity={rarity} width={CARD_WIDTH} />
            </div>
            <Leaf className={styles.demoFace}>
              <span className={styles.demoRarity}>{RARITY_NAMES[rarity]}</span>
              <span className={styles.demoWord}>abajoue</span>
              <Sheen sweep={sweep} />
            </Leaf>
          </div>
        </button>
        {banner !== undefined && (
          <RarityBanner text={RARITY_NAMES[rarity]} color={banner} stamp={stamp} />
        )}
      </div>
      <p className={styles.effectsHint}>
        {moment === "waiting" ? "Touche la carte pour la retourner." : "\u00a0"}
      </p>
      <div className={styles.row}>
        {RARITIES.map((choice) => (
          <Toy
            key={choice}
            matter="paper"
            className={styles.effectButton}
            onClick={() => draw(choice)}
          >
            <Lettering>{RARITY_NAMES[choice]}</Lettering>
          </Toy>
        ))}
      </div>
    </div>
  );
}
