"use client";

import { libraryTheme, type ToyMatterName } from "@leximon/tokens";
import { type CSSProperties, useEffect, useState } from "react";
import { CardBack } from "@/booster/card-back";
import { CountBadge, Desk, MainAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { Icon } from "@/ui/icon";
import { ParticleStage } from "@/ui/stage";
import { Kicker, Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";
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

type BookKind = "collection" | "theme" | "rising" | "missed" | "recent";

interface Book {
  readonly name: string;
  readonly kind: BookKind;
  readonly matter: ToyMatterName;
  readonly words: number;
  readonly due: number;
  /** The share of its words past the Esquisse, shown as the gilt band at the foot of the spine. */
  readonly gilt: number;
  readonly lockedAt?: number;
}

const SHELVES: readonly (readonly Book[])[] = [
  [
    { name: "Prêts à monter", kind: "rising", matter: "gold", words: 2, due: 2, gilt: 0 },
    { name: "Les Fondateurs", kind: "collection", matter: "blue", words: 56, due: 6, gilt: 0.3 },
    {
      name: "Caractères et travers",
      kind: "collection",
      matter: "red",
      words: 36,
      due: 4,
      gilt: 0.1,
    },
    {
      name: "Métiers et objets disparus",
      kind: "collection",
      matter: "green",
      words: 43,
      due: 2,
      gilt: 0.05,
    },
    { name: "Mes mots ratés", kind: "missed", matter: "dark", words: 4, due: 0, gilt: 0 },
    { name: "Mes mots récents", kind: "recent", matter: "paper", words: 30, due: 3, gilt: 0 },
  ],
  [
    { name: "Nature", kind: "theme", matter: "green", words: 20, due: 3, gilt: 0.25 },
    { name: "Arts", kind: "theme", matter: "red", words: 26, due: 1, gilt: 0.1 },
    { name: "Religion", kind: "theme", matter: "blue", words: 15, due: 0, gilt: 0.4 },
    { name: "Sentiments", kind: "theme", matter: "dark", words: 15, due: 2, gilt: 0 },
    { name: "Vie quotidienne", kind: "theme", matter: "paper", words: 47, due: 4, gilt: 0.15 },
    { name: "Métiers", kind: "theme", matter: "green", words: 51, due: 0, gilt: 0.2 },
    { name: "Corps", kind: "theme", matter: "red", words: 6, due: 1, gilt: 0 },
  ],
  [
    { name: "Cuisine", kind: "theme", matter: "gold", words: 7, due: 0, gilt: 0.3 },
    { name: "Sciences", kind: "theme", matter: "blue", words: 13, due: 2, gilt: 0 },
    { name: "Droit", kind: "theme", matter: "dark", words: 12, due: 0, gilt: 0.1 },
    { name: "Guerre", kind: "theme", matter: "red", words: 13, due: 1, gilt: 0 },
    { name: "Insultes", kind: "theme", matter: "green", words: 4, due: 0, gilt: 0 },
    { name: "Loufoque", kind: "theme", matter: "paper", words: 12, due: 0, gilt: 0, lockedAt: 3 },
  ],
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
          <TodayColumn />
          <Review state={REVIEW[moment]} />
          <ShelfColumn />
        </div>
      </ParticleStage>
    </main>
  );
}

/** The hero: the words waiting, as a deck on the desk, and the gold button that starts. */
function Review({ state }: { readonly state: ReviewState }) {
  const calm = state.review === 0 && state.fresh === 0;
  return (
    <section className={styles.stage} aria-labelledby="review-title">
      <div className={styles.play}>
        <Desk className={styles.desk} />
        <Toy matter="paper" shape="round" className={styles.settings} aria-label="Régler la séance">
          <ToyIcon name="settings" size={26} />
        </Toy>
        <header className={styles.reviewHead}>
          <Kicker>Ta révision</Kicker>
          <Lettering className={styles.reviewTitle}>
            <span id="review-title">Réviser tes mots</span>
          </Lettering>
        </header>
        <div className={styles.deck} data-calm={calm || undefined} aria-hidden="true">
          {[-2, -1, 0, 1, 2].map((at) => (
            <span key={at} className={styles.deckCard} style={{ "--at": at } as CSSProperties}>
              <CardBack rarity="common" width={128} tone={at === 0 ? "burgundy" : "night"} />
            </span>
          ))}
          {!calm && (
            <CountBadge count={String(state.review + state.fresh)} className={styles.deckCount} />
          )}
        </div>
        <div className={`${ui.leaf} ${styles.counters}`}>
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
        </div>
      </div>
      <div className={styles.cta}>
        <MainAction label={state.action} count="10" />
        <p className={styles.estimate}>{state.estimate}</p>
      </div>
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

/** Left of the desk: what the day holds apart from the review, and the player's memory. */
function TodayColumn() {
  return (
    <aside className={`${desk.column} ${styles.today}`} aria-label="Aujourd'hui">
      <header className={desk.head}>
        <Kicker>Aujourd'hui</Kicker>
        <Lettering className={desk.headTitle}>Mercredi 4 novembre</Lettering>
      </header>
      <a href="#defi" className={`${ui.leaf} ${desk.leaf} ${desk.rising}`} style={rise(0)}>
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
      <a href="#enigme" className={`${ui.leaf} ${desk.leaf} ${desk.rising}`} style={rise(1)}>
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
      <div className={`${ui.leaf} ${desk.leaf} ${desk.rising}`} style={rise(2)}>
        <span className={desk.leafKicker}>Ta mémoire</span>
        <div className={styles.tiers} aria-hidden="true">
          <span className={styles.tierSketch} style={{ flexGrow: 84 }} />
          <span className={styles.tierInk} style={{ flexGrow: 9 }} />
          <span className={styles.tierGilt} style={{ flexGrow: 3 }} />
        </div>
        <div className={styles.tierFigures}>
          <span>
            <b>84</b> Esquisse
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
    </aside>
  );
}

/** Right of the desk: what to practise on, as books on a shelf. */
function ShelfColumn() {
  const [open, setOpen] = useState<Book | null>(SHELVES[0]?.[1] ?? null);
  return (
    <aside className={`${desk.column} ${styles.shelfColumn}`} aria-label="S'entraîner sur…">
      <header className={desk.head}>
        <Kicker>S'entraîner sur…</Kicker>
        <Lettering className={desk.headTitle}>Tes livres</Lettering>
      </header>
      <div className={`${styles.bookcase} ${desk.rising}`} style={rise(1)}>
        {SHELVES.map((books) => (
          <div key={books[0]?.name} className={styles.shelf}>
            {books.map((book) => (
              <BookSpine
                key={book.name}
                book={book}
                open={open?.name === book.name}
                onPick={() => setOpen(open?.name === book.name ? null : book)}
              />
            ))}
          </div>
        ))}
      </div>
      {open !== null && <BookLeaf book={open} />}
    </aside>
  );
}

function BookSpine({
  book,
  open,
  onPick,
}: {
  readonly book: Book;
  readonly open: boolean;
  readonly onPick: () => void;
}) {
  const locked = book.lockedAt !== undefined;
  return (
    <button
      type="button"
      className={styles.book}
      data-kind={book.kind}
      data-open={open || undefined}
      data-locked={locked || undefined}
      style={
        {
          "--spine-top": `var(--lx-toy-${locked ? "locked" : book.matter}-top)`,
          "--spine-bottom": `var(--lx-toy-${locked ? "locked" : book.matter}-bottom)`,
          "--spine-edge": `var(--lx-toy-${locked ? "locked" : book.matter}-edge)`,
          "--gilt": book.gilt,
        } as CSSProperties
      }
      aria-label={`${book.name}, ${book.words} mots, dont ${book.due} à revoir`}
      onClick={onPick}
    >
      <span className={styles.spineName}>{book.name}</span>
      <span className={styles.spineGilt} aria-hidden="true" />
      {book.kind === "missed" && <span className={styles.ribbon} aria-hidden="true" />}
      {book.kind === "recent" && <span className={styles.bookmark} aria-hidden="true" />}
      {locked ? (
        <span className={styles.spineLock}>Niv. {book.lockedAt}</span>
      ) : (
        book.due > 0 && <CountBadge count={String(book.due)} className={styles.spineBadge} />
      )}
    </button>
  );
}

/** The book taken from the shelf: what it holds, and the button that starts on it. */
function BookLeaf({ book }: { readonly book: Book }) {
  const locked = book.lockedAt !== undefined;
  return (
    <div className={`${ui.leaf} ${desk.leaf} ${styles.bookLeaf}`}>
      <span className={desk.leafKicker}>{kindLabel(book.kind)}</span>
      <span className={desk.leafTitle}>{book.name}</span>
      <span className={desk.leafText}>
        {locked
          ? `Les thèmes s'ouvrent au niveau ${book.lockedAt}.`
          : `${book.words} mots, dont ${book.due} à revoir.`}
      </span>
      {!locked && (
        <div className={styles.tiers} aria-hidden="true">
          <span className={styles.tierSketch} style={{ flexGrow: 1 - book.gilt }} />
          <span className={styles.tierInk} style={{ flexGrow: book.gilt }} />
        </div>
      )}
      {!locked && <span className={desk.go}>Lancer 10 questions</span>}
    </div>
  );
}

function kindLabel(kind: BookKind): string {
  switch (kind) {
    case "collection":
      return "Collection";
    case "theme":
      return "Thème";
    case "rising":
      return "Les mots qui peuvent monter";
    case "missed":
      return "Ratés ces 30 derniers jours";
    case "recent":
      return "Tes 30 derniers mots";
  }
}
