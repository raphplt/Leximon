"use client";

import type { ReactNode } from "react";
import { Desk } from "@/library/play-pieces";
import profile from "@/profile/profile.module.css";
import { BindingRule, Fleurons, GiltCorners, Hedera, Tailpiece, TitleRule } from "@/ui/ornaments";
import { Kicker, Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./ornements-plate.module.css";

/**
 * The ornaments of the paper: the same panel in four dresses, then section titles and tailpieces,
 * each with the place it was given.
 */

const TILES = [
  { value: "248", label: "mots sur 2 065" },
  { value: "3", label: "légendaires" },
  { value: "12", label: "mots à la Dorure" },
  { value: "9", label: "échanges conclus" },
] as const;

type Dress = "bare" | "corners" | "rule" | "fleurons";

const DRESSES: readonly { readonly id: Dress; readonly label: string; readonly note: string }[] = [
  { id: "bare", label: "Nu", note: "La grille de l'album, la table de Jouer, les listes." },
  {
    id: "corners",
    label: "Coins dorés",
    note: "Les petites tuiles : défi du jour, énigme, colonnes de Jouer.",
  },
  {
    id: "rule",
    label: "Filet doré",
    note: "Les panneaux qu'on lit : révision, profil, nouveautés, mécènes.",
  },
  {
    id: "fleurons",
    label: "Fleurons",
    note: "Les moments de récompense : coffret, porte des joutes, accueil, mécène.",
  },
];

function StatsPanel({ dress }: { readonly dress: Dress }) {
  return (
    <section className={`${ui.panel} ${profile.panel} ${styles.panel}`} data-dress={dress}>
      {dress === "corners" && <GiltCorners />}
      {dress === "rule" && <BindingRule />}
      {dress === "fleurons" && <Fleurons />}
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
    label: "Filet sous le titre",
    note: "Les titres de section.",
    title: (
      <div className={styles.ruled}>
        <h2 className={`${ui.display} ${styles.sectionTitle}`}>Cartes épinglées</h2>
        <TitleRule />
      </div>
    ),
  },
  {
    label: "Feuille de lierre",
    note: "En réserve.",
    title: (
      <h2 className={`${ui.display} ${styles.sectionTitle} ${styles.withLeaf}`}>
        <Hedera />
        Cartes épinglées
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
        <h2 className={styles.blockTitle}>Un habit par panneau</h2>
        <div className={styles.grid}>
          {DRESSES.map((dress) => (
            <Labelled key={dress.id} label={dress.label} note={dress.note}>
              <StatsPanel dress={dress.id} />
            </Labelled>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Le cuir de la table</h2>
        <Labelled
          label="Dorure aux petits fers"
          note="La table de Jouer, l'album, l'arène des joutes."
        >
          <Desk className={styles.desk} />
        </Labelled>
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
        <Labelled
          label="Entre deux nouveautés"
          note="Il ferme une section ou en sépare deux : nouveautés, mécènes, énigme trouvée."
        >
          <div className={`${ui.panel} ${styles.news}`}>
            <h3 className={`${ui.display} ${styles.newsTitle}`}>L'énigme du jour</h3>
            <p className={styles.newsText}>
              La page Défis propose chaque jour un nouveau mot à deviner, le même pour tout le
              monde, en 7 essais.
            </p>
            <Tailpiece className={styles.tailpiece} />
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
