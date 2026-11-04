"use client";

import { libraryTheme, type ToyMatterName } from "@leximon/tokens";
import { type CSSProperties, useEffect, useState } from "react";
import { CountBadge, MainAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { Icon } from "@/ui/icon";
import { ParticleStage } from "@/ui/stage";
import { Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./defis-plate.module.css";

/**
 * A plate of the Défis screen as its spec proposes it, on made-up figures: the owner judges the
 * layout before the rules are settled. Nothing here reads the game.
 */

type Moment = "due" | "calm" | "back";

const MOMENTS: readonly { readonly id: Moment; readonly label: string }[] = [
  { id: "due", label: "Des mots à revoir" },
  { id: "calm", label: "Rien à revoir" },
  { id: "back", label: "Retour après 4 jours" },
];

interface ReviewState {
  readonly review: number;
  readonly fresh: number;
  readonly rising: number;
  readonly lines: readonly string[];
  readonly action: string;
  readonly estimate: string;
}

const REVIEW: Readonly<Record<Moment, ReviewState>> = {
  due: {
    review: 12,
    fresh: 5,
    rising: 2,
    lines: [
      "12 mots sont à revoir, dont 2 peuvent passer à l'Encre.",
      "5 nouveaux mots attendent leur première question.",
    ],
    action: "Commencer",
    estimate: "10 questions, environ 3 minutes",
  },
  calm: {
    review: 0,
    fresh: 0,
    rising: 0,
    lines: [
      "Tes mots tiennent bon. Le prochain revient dans 3 h.",
      "Tu peux t'entraîner en attendant.",
    ],
    action: "S'entraîner",
    estimate: "10 questions sur tes mots les plus fragiles, environ 3 minutes",
  },
  back: {
    review: 140,
    fresh: 10,
    rising: 6,
    lines: [
      "140 mots sont à revoir, dont 6 peuvent passer à l'Encre. Les plus urgents passent d'abord.",
      "10 nouveaux mots attendent leur première question aujourd'hui.",
    ],
    action: "Commencer",
    estimate: "10 questions, environ 3 minutes",
  },
};

/** Shares of the words of a scope by tier: blank page, sketch, ink, gilding. */
type Tiers = readonly [number, number, number, number];

interface Scope {
  readonly name: string;
  readonly matter: ToyMatterName;
  readonly words: number;
  readonly due: number;
  readonly tiers: Tiers;
  /** What the cover shows: the collection's first letter, or an icon for the shortcuts. */
  readonly mark: string;
  readonly lockedAt?: number;
}

const SHORTCUTS: readonly Scope[] = [
  { name: "Prêts à monter", matter: "gold", words: 2, due: 2, tiers: [0, 2, 0, 0], mark: "▲" },
  { name: "Mes mots ratés", matter: "red", words: 4, due: 0, tiers: [0, 4, 0, 0], mark: "✕" },
  {
    name: "Mes mots récents",
    matter: "paper",
    words: 30,
    due: 3,
    tiers: [18, 12, 0, 0],
    mark: "✦",
  },
];

const COLLECTIONS: readonly Scope[] = [
  { name: "Les Fondateurs", matter: "blue", words: 56, due: 6, tiers: [20, 26, 8, 2], mark: "F" },
  {
    name: "Caractères et travers",
    matter: "red",
    words: 36,
    due: 4,
    tiers: [14, 19, 3, 0],
    mark: "C",
  },
  {
    name: "Métiers et objets disparus",
    matter: "green",
    words: 43,
    due: 2,
    tiers: [25, 16, 2, 0],
    mark: "M",
  },
];

const THEMES: readonly Scope[] = [
  { name: "Nature", matter: "green", words: 20, due: 3, tiers: [6, 10, 3, 1], mark: "N" },
  { name: "Arts", matter: "red", words: 26, due: 1, tiers: [10, 14, 2, 0], mark: "A" },
  { name: "Religion", matter: "blue", words: 15, due: 0, tiers: [3, 6, 5, 1], mark: "R" },
  { name: "Sentiments", matter: "dark", words: 15, due: 2, tiers: [7, 8, 0, 0], mark: "S" },
  { name: "Vie quotidienne", matter: "paper", words: 47, due: 4, tiers: [20, 20, 6, 1], mark: "V" },
  { name: "Métiers", matter: "green", words: 51, due: 0, tiers: [25, 16, 9, 1], mark: "M" },
  { name: "Corps", matter: "red", words: 6, due: 1, tiers: [2, 4, 0, 0], mark: "C" },
  { name: "Cuisine", matter: "gold", words: 7, due: 0, tiers: [2, 3, 2, 0], mark: "C" },
  { name: "Sciences", matter: "blue", words: 13, due: 2, tiers: [6, 7, 0, 0], mark: "S" },
  { name: "Droit", matter: "dark", words: 12, due: 0, tiers: [4, 7, 1, 0], mark: "D" },
  { name: "Guerre", matter: "red", words: 13, due: 1, tiers: [5, 8, 0, 0], mark: "G" },
  {
    name: "Loufoque",
    matter: "paper",
    words: 12,
    due: 0,
    tiers: [12, 0, 0, 0],
    mark: "L",
    lockedAt: 3,
  },
];

/** Each leaf rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

export function DefisPlate() {
  const [moment, setMoment] = useState<Moment>("due");
  // The leaves of the room only take their paper under the library look of the whole page.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.look;
    root.dataset.look = "bibliotheque";
    return () => {
      if (before === undefined) delete root.dataset.look;
      else root.dataset.look = before;
    };
  }, []);

  return (
    <main data-look="bibliotheque" className={styles.page} style={libraryTheme() as CSSProperties}>
      <ParticleStage dust>
        <nav className={styles.controls} aria-label="État de la planche">
          <span className={styles.controlsLabel}>Planche Défis</span>
          {MOMENTS.map((entry) => (
            <Toy
              key={entry.id}
              matter={entry.id === moment ? "gold" : "paper"}
              className={styles.control}
              aria-pressed={entry.id === moment}
              onClick={() => setMoment(entry.id)}
            >
              {entry.label}
            </Toy>
          ))}
        </nav>
        <div className={styles.screen}>
          <Lettering className={styles.pageTitle}>Défis</Lettering>
          <Review state={REVIEW[moment]} />
          <div className={styles.lower}>
            <Practice />
            <aside className={styles.side} aria-label="Aujourd'hui">
              <DailyLeaf />
              <RiddleLeaf />
              <MemoryLeaf />
            </aside>
          </div>
        </div>
      </ParticleStage>
    </main>
  );
}

/** The hero, across the screen: what waits, said in figures and in words, and the gold button. */
function Review({ state }: { readonly state: ReviewState }) {
  return (
    <section
      className={`${ui.leaf} ${styles.review} ${desk.rising}`}
      style={rise(0)}
      aria-labelledby="review-title"
    >
      <header className={styles.reviewHead}>
        <span className={desk.leafKicker}>Ta révision</span>
        <h2 id="review-title" className={styles.reviewTitle}>
          Réviser tes mots
        </h2>
      </header>
      <div className={styles.wells}>
        <Well figure={state.review} label="à revoir" />
        <Well figure={state.fresh} label="nouveaux" />
        <Well figure={state.rising} label="peuvent monter" gilt />
      </div>
      <p className={styles.line}>
        {state.lines.map((line) => (
          <span key={line}>{line} </span>
        ))}
      </p>
      <div className={styles.go}>
        <MainAction label={state.action} count="10" />
        <span className={styles.estimate}>{state.estimate}</span>
      </div>
      <Toy matter="paper" shape="round" className={styles.settings} aria-label="Régler la séance">
        <ToyIcon name="settings" size={26} />
      </Toy>
    </section>
  );
}

function Well({
  figure,
  label,
  gilt = false,
}: {
  readonly figure: number;
  readonly label: string;
  readonly gilt?: boolean;
}) {
  return (
    <div
      className={styles.well}
      data-gilt={gilt || undefined}
      data-empty={figure === 0 || undefined}
    >
      <span className={styles.wellFigure}>{figure}</span>
      <span className={styles.wellLabel}>{label}</span>
    </div>
  );
}

/** What to practise on: book covers seen from the front, each one a door. */
function Practice() {
  return (
    <section
      className={`${ui.leaf} ${styles.practice} ${desk.rising}`}
      style={rise(1)}
      aria-labelledby="practice-title"
    >
      <header className={styles.practiceHead}>
        <span className={desk.leafKicker}>Hors révision, sans limite</span>
        <h2 id="practice-title" className={styles.sectionTitle}>
          S'entraîner sur…
        </h2>
      </header>
      <ul className={styles.shortcuts}>
        {SHORTCUTS.map((scope) => (
          <li key={scope.name}>
            <Cover scope={scope} size="short" />
          </li>
        ))}
      </ul>
      <h3 className={styles.shelfTitle}>Les collections</h3>
      <ul className={styles.collections}>
        {COLLECTIONS.map((scope) => (
          <li key={scope.name}>
            <Cover scope={scope} size="large" />
          </li>
        ))}
      </ul>
      <h3 className={styles.shelfTitle}>Les thèmes</h3>
      <ul className={styles.themes}>
        {THEMES.map((scope) => (
          <li key={scope.name}>
            <Cover scope={scope} size="small" />
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Une bonne réponse d'entraînement rapporte 5 XP, 100 XP par jour au plus. Elle ne change pas
        la mémoire du mot.
      </p>
    </section>
  );
}

/** A book seen from the front: its leather, its title, how much of it is learnt, what is due. */
function Cover({
  scope,
  size,
}: {
  readonly scope: Scope;
  readonly size: "large" | "small" | "short";
}) {
  const locked = scope.lockedAt !== undefined;
  const matter = locked ? "locked" : scope.matter;
  return (
    <button
      type="button"
      className={styles.cover}
      data-size={size}
      data-locked={locked || undefined}
      data-light={matter === "paper" || matter === "gold" || undefined}
      style={
        {
          "--cover-top": `var(--lx-toy-${matter}-top)`,
          "--cover-bottom": `var(--lx-toy-${matter}-bottom)`,
          "--cover-edge": `var(--lx-toy-${matter}-edge)`,
        } as CSSProperties
      }
      aria-label={
        locked
          ? `${scope.name}, s'ouvre au niveau ${scope.lockedAt}`
          : `${scope.name}, ${scope.words} mots, dont ${scope.due} à revoir. Lancer 10 questions.`
      }
    >
      <span className={styles.coverMark} aria-hidden="true">
        {scope.mark}
      </span>
      <span className={styles.coverText}>
        <Lettering className={styles.coverName}>{scope.name}</Lettering>
        <span className={styles.coverWords}>
          {locked ? `Niveau ${scope.lockedAt}` : `${scope.words} mots`}
        </span>
      </span>
      {!locked && <TierBar tiers={scope.tiers} className={styles.coverTiers} />}
      {locked ? (
        <span className={styles.coverLock} aria-hidden="true">
          <ToyIcon name="lock" size={22} />
        </span>
      ) : (
        <>
          {scope.due > 0 && <CountBadge count={String(scope.due)} className={styles.coverBadge} />}
          <span className={styles.coverGo} aria-hidden="true">
            10 questions ›
          </span>
        </>
      )}
    </button>
  );
}

function TierBar({
  tiers,
  className,
}: {
  readonly tiers: Tiers;
  readonly className?: string | undefined;
}) {
  const [blank, sketch, ink, gilt] = tiers;
  return (
    <span className={`${styles.tiers} ${className ?? ""}`} aria-hidden="true">
      <span className={styles.tierBlank} style={{ flexGrow: blank }} />
      <span className={styles.tierSketch} style={{ flexGrow: sketch }} />
      <span className={styles.tierInk} style={{ flexGrow: ink }} />
      <span className={styles.tierGilt} style={{ flexGrow: gilt }} />
    </span>
  );
}

function DailyLeaf() {
  return (
    <a href="#defi" className={`${ui.leaf} ${desk.leaf} ${desk.rising}`} style={rise(2)}>
      <span className={desk.leafHead}>
        <ToyBody matter="red" shape="tile" className={desk.badge}>
          <ToyIcon name="challenge" size={26} />
        </ToyBody>
        <span className={desk.leafTitles}>
          <span className={desk.leafKicker}>Défi du jour</span>
          <span className={desk.leafTitle}>3 bonnes réponses sur 5</span>
        </span>
      </span>
      <span className={desk.pips} aria-hidden="true">
        {["right", "wrong", "right", "todo", "todo"].map((bar, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one pip per question, in order
          <span key={at} className={desk.pip} data-bar={bar} />
        ))}
      </span>
      <span className={desk.leafText}>
        Encore 2 questions. Le sachet bonus est à la 3e bonne réponse.
      </span>
      <span className={desk.go}>Continuer le défi</span>
    </a>
  );
}

function RiddleLeaf() {
  return (
    <a href="#enigme" className={`${ui.leaf} ${desk.leaf} ${desk.rising}`} style={rise(3)}>
      <span className={desk.leafHead}>
        <ToyBody matter="gold" shape="tile" className={desk.badge}>
          <span className={desk.badgeGlyph}>
            <Icon name="plume" size={22} />
          </span>
        </ToyBody>
        <span className={desk.leafTitles}>
          <span className={desk.leafKicker}>Énigme du jour · n° 5</span>
          <span className={desk.leafTitle}>Nom de 8 lettres</span>
        </span>
      </span>
      <span className={desk.type} style={{ "--letters": 8 } as CSSProperties} aria-hidden="true">
        {["G", null, null, null, null, null, null, null].map((letter, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one block per letter, in order
          <span key={at} className={letter === null ? desk.blockHollow : desk.block}>
            {letter}
          </span>
        ))}
      </span>
      <span className={desk.go}>Jouer</span>
    </a>
  );
}

function MemoryLeaf() {
  return (
    <div className={`${ui.leaf} ${desk.leaf} ${desk.rising}`} style={rise(4)}>
      <span className={desk.leafKicker}>Ta mémoire</span>
      <TierBar tiers={[31, 53, 9, 3]} />
      <div className={styles.tierFigures}>
        <span>
          <b>31</b> Page blanche
        </span>
        <span>
          <b>53</b> Esquisse
        </span>
        <span>
          <b>9</b> Encre
        </span>
        <span>
          <b>3</b> Dorure
        </span>
      </div>
      <span className={desk.leafText}>
        Le prochain mot revient dans 3 h. Tu as joué 12 jours, dont les 4 derniers d'affilée.
      </span>
    </div>
  );
}
