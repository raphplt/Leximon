"use client";

import type { ReactNode } from "react";
import { IlluminatedBorder } from "@/beta/illuminated-border";
import profile from "@/profile/profile.module.css";
import { Kicker, Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./ornements-plate.module.css";

/**
 * A plate of ornaments for the paper of the game: the same panel in four dresses, then section
 * titles and tailpieces, for the owner to pick where each one goes.
 */

const CORNERS = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;

const TILES = [
  { value: "248", label: "mots sur 2 065" },
  { value: "3", label: "légendaires" },
  { value: "12", label: "mots à la Dorure" },
  { value: "9", label: "échanges conclus" },
] as const;

type Dress = "bare" | "corners" | "rule" | "fleurons";

const DRESSES: readonly { readonly id: Dress; readonly label: string; readonly note: string }[] = [
  { id: "bare", label: "A. Nu", note: "Le panneau tel qu'il est aujourd'hui." },
  { id: "corners", label: "B. Coins dorés", note: "Quatre équerres dorées, sans filet." },
  { id: "rule", label: "C. Filet doré", note: "Le double filet des fleurons, sans feuillage." },
  { id: "fleurons", label: "D. Fleurons", note: "Le cadre des cartes de la page mécène." },
];

/** A gilt square in each corner, curled at both ends. */
function GiltCorners() {
  const stem = "M5 30 V14 C5 8.5 8.5 5 14 5 H30";
  return (
    <span className={styles.overlay} aria-hidden="true">
      {CORNERS.map((corner) => (
        <span key={corner} className={`${styles.corner} ${styles[corner]}`}>
          <svg viewBox="0 0 36 36" width="100%" height="100%" aria-hidden="true">
            <path className={styles.stemInk} d={stem} />
            <path className={styles.stemGold} d={stem} />
            <circle className={styles.bezant} cx="5" cy="32" r="2.2" />
            <circle className={styles.bezant} cx="32" cy="5" r="2.2" />
            <circle className={styles.dotRed} cx="12" cy="12" r="2.4" />
          </svg>
        </span>
      ))}
    </span>
  );
}

/** The gilt double rule of the fleurons, with a lozenge on each corner. */
function GiltRule() {
  return (
    <span className={styles.rule} aria-hidden="true">
      {CORNERS.map((corner) => (
        <span key={corner} className={`${styles.stud} ${styles[corner]}`}>
          <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true">
            <path className={styles.bezant} d="M8 1 L15 8 L8 15 L1 8 Z" />
            <circle className={styles.dotRed} cx="8" cy="8" r="2.2" />
          </svg>
        </span>
      ))}
    </span>
  );
}

/** An ivy leaf, the printers' hedera, set before a title. */
function Hedera({ flip = false }: { readonly flip?: boolean }) {
  return (
    <svg
      className={styles.hedera}
      viewBox="0 0 28 24"
      width="28"
      height="24"
      aria-hidden="true"
      style={flip ? { scale: "-1 1" } : undefined}
    >
      <path className={styles.stemInk} d="M3 12 C6 12 7 15 10 14" />
      <path className={styles.stemGold} d="M3 12 C6 12 7 15 10 14" />
      <path
        className={styles.leafRed}
        d="M9 12 C12 5 18 3 21 6 C23 8 22 10 20 11 C22 12 23 14 21 17 C18 20 12 18 9 12 Z M11 12 H20"
      />
    </svg>
  );
}

/** A gilt rule tapering to both ends, a lozenge in its middle. */
function TitleRule() {
  return (
    <svg className={styles.titleRule} viewBox="0 0 160 16" aria-hidden="true">
      <path className={styles.taper} d="M4 8 L64 6 L64 10 Z" />
      <path className={styles.taper} d="M156 8 L96 6 L96 10 Z" />
      <circle className={styles.dotRed} cx="69" cy="8" r="2.2" />
      <circle className={styles.dotRed} cx="91" cy="8" r="2.2" />
      <path className={styles.bezant} d="M80 1 L87 8 L80 15 L73 8 Z" />
    </svg>
  );
}

/** A tailpiece: two gilt curls from a lozenge, a red drop under it, to close a section. */
function Tailpiece() {
  const arm = (
    <>
      <path
        className={styles.stemInk}
        d="M67 12 H80 C90 12 97 15 97 21 C97 26 91 27 89 23 C87 20 90 18 92 19"
      />
      <path
        className={styles.stemGold}
        d="M67 12 H80 C90 12 97 15 97 21 C97 26 91 27 89 23 C87 20 90 18 92 19"
      />
      <path className={styles.leafRed} d="M71 13 C74 19 81 22 87 20 C84 15 78 13 71 13 Z" />
      <circle className={styles.bezant} cx="104" cy="12" r="2.2" />
    </>
  );
  return (
    <svg className={styles.tailpiece} viewBox="0 0 120 36" aria-hidden="true">
      {arm}
      <g transform="matrix(-1 0 0 1 120 0)">{arm}</g>
      <path className={styles.leafBlue} d="M60 19 C64 23 64 28 60 32 C56 28 56 23 60 19 Z" />
      <path className={styles.bezant} d="M60 5 L67 12 L60 19 L53 12 Z" />
    </svg>
  );
}

function StatsPanel({ dress }: { readonly dress: Dress }) {
  return (
    <section className={`${ui.panel} ${profile.panel} ${styles.panel}`} data-dress={dress}>
      {dress === "corners" && <GiltCorners />}
      {dress === "rule" && <GiltRule />}
      {dress === "fleurons" && <IlluminatedBorder />}
      <h2 className={`${ui.display} ${profile.panelTitle}`}>En chiffres</h2>
      <dl className={profile.tiles}>
        {TILES.map((tile) => (
          <div key={tile.label} className={profile.tile}>
            <dt className={profile.tileLabel}>{tile.label}</dt>
            <dd className={`${ui.display} ${profile.tileValue}`}>{tile.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Labelled({
  label,
  note,
  children,
}: {
  readonly label: string;
  readonly note: string;
  readonly children: ReactNode;
}) {
  return (
    <figure className={styles.sample}>
      {children}
      <figcaption className={styles.caption}>
        <strong>{label}</strong> {note}
      </figcaption>
    </figure>
  );
}

const TITLES: readonly {
  readonly label: string;
  readonly note: string;
  readonly title: ReactNode;
}[] = [
  {
    label: "A. Nu",
    note: "Le titre seul, comme aujourd'hui.",
    title: <h2 className={`${ui.display} ${styles.sectionTitle}`}>Cartes épinglées</h2>,
  },
  {
    label: "B. Feuille de lierre",
    note: "Une feuille rouge devant le titre.",
    title: (
      <h2 className={`${ui.display} ${styles.sectionTitle} ${styles.withLeaf}`}>
        <Hedera />
        Cartes épinglées
      </h2>
    ),
  },
  {
    label: "C. Filet sous le titre",
    note: "Un filet doré qui s'effile, un losange au milieu.",
    title: (
      <div className={styles.ruled}>
        <h2 className={`${ui.display} ${styles.sectionTitle}`}>Cartes épinglées</h2>
        <TitleRule />
      </div>
    ),
  },
  {
    label: "D. Titre centré entre deux feuilles",
    note: "Pour un titre seul au milieu d'une page.",
    title: (
      <h2 className={`${ui.display} ${styles.sectionTitle} ${styles.centered}`}>
        <Hedera flip />
        Cartes épinglées
        <Hedera />
      </h2>
    ),
  },
];

export function OrnementsPlate() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Kicker>Planches</Kicker>
        <Lettering className={styles.title}>Ornements</Lettering>
      </header>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Un même panneau, quatre habits</h2>
        <div className={styles.grid}>
          {DRESSES.map((dress) => (
            <Labelled key={dress.id} label={dress.label} note={dress.note}>
              <StatsPanel dress={dress.id} />
            </Labelled>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Titres de section</h2>
        <div className={styles.grid}>
          {TITLES.map((title) => (
            <Labelled key={title.label} label={title.label} note={title.note}>
              <div className={`${ui.panel} ${styles.titlePanel}`}>{title.title}</div>
            </Labelled>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Cul-de-lampe</h2>
        <Labelled label="Entre deux nouveautés" note="Il ferme une section ou en sépare deux.">
          <div className={`${ui.panel} ${styles.news}`}>
            <h3 className={`${ui.display} ${styles.newsTitle}`}>L'énigme du jour</h3>
            <p className={styles.newsText}>
              La page Défis propose chaque jour un nouveau mot à deviner, le même pour tout le
              monde, en 7 essais.
            </p>
            <Tailpiece />
            <h3 className={`${ui.display} ${styles.newsTitle}`}>La révision</h3>
            <p className={styles.newsText}>
              La révision reprend les mots que tu as manqués, au bon moment pour les retenir.
            </p>
          </div>
        </Labelled>
      </section>
    </main>
  );
}
