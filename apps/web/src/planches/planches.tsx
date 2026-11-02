"use client";

import { RARITIES, type Rarity } from "@leximon/core";
import {
  effects,
  libraryTheme,
  rarityLights,
  revealEffects,
  type ToyIconName,
  type ToyMatterName,
  toyIcons,
} from "@leximon/tokens";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";
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
            charging={charging}
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

/** Each rarity's light, on a card-sized target. */
function Effects() {
  const stage = useStage();
  const target = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Rarity | null>(null);
  const reveal = (rarity: Rarity) => {
    const box = target.current?.getBoundingClientRect();
    if (box === undefined || target.current === null) return;
    setShown(rarity);
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const effect = revealEffects[rarity];
    const run = () =>
      stage.reveal(
        x,
        y,
        effect,
        rarityLights[rarity][0] ?? "white",
        target.current ?? document.body,
      );
    if (effect.drawInMs > 0) {
      stage.drawIn(x, y, rarityLights[rarity], effect.drawInMs);
      window.setTimeout(run, effect.drawInMs);
    } else {
      run();
    }
  };
  return (
    <div className={styles.effects}>
      <div ref={target} className={styles.target} data-rarity={shown ?? undefined}>
        <Lettering>{shown === null ? "Une carte" : RARITY_NAMES[shown]}</Lettering>
      </div>
      <div className={styles.row}>
        {RARITIES.map((rarity) => (
          <Toy
            key={rarity}
            matter="paper"
            className={styles.effectButton}
            onClick={() => reveal(rarity)}
          >
            <Lettering>{RARITY_NAMES[rarity]}</Lettering>
          </Toy>
        ))}
      </div>
    </div>
  );
}
