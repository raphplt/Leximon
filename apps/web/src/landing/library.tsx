import type { ToyMatterName } from "@leximon/tokens";
import { formatCount } from "@leximon/view-model";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CollectionSeal } from "@/components/collection-seal";
import desk from "@/play/desk-columns.module.css";
import { GiltCorners } from "@/ui/ornaments";
import { Kicker, Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./landing-page.module.css";
import type { Shelf } from "./showcase-cards";

const BOOK_MATTERS: readonly ToyMatterName[] = ["blue", "red", "green"];
const BOOK_BACKS: Readonly<Record<string, string>> = {
  fondateurs: "night",
  caracteres: "burgundy",
  metiers: "green",
};

/** The lettering has no narrow space: at display size, thousands take a full no-break space. */
function displayCount(value: number): string {
  return formatCount(value).replaceAll("\u202f", "\u00a0");
}

/** The collections as books, and the riddle of the day beside them. */
export function Library({ shelves }: { readonly shelves: readonly Shelf[] }) {
  if (shelves.length === 0) return null;
  const total = shelves.reduce((sum, shelf) => sum + shelf.count, 0);
  return (
    <section id="collections" className={styles.section} aria-labelledby="library-title">
      <div className={styles.sectionHead}>
        <Kicker>Le catalogue de lancement</Kicker>
        <h2 id="library-title" className={styles.sectionTitle}>
          <Lettering>{`${displayCount(total)} mots, en trois collections`}</Lettering>
        </h2>
      </div>
      <div className={styles.library}>
        <ul className={styles.books}>
          {shelves.map((shelf, at) => {
            const matter = BOOK_MATTERS[at % BOOK_MATTERS.length] ?? "blue";
            return (
              <li key={shelf.id}>
                <span
                  className={styles.book}
                  style={
                    {
                      "--cover-top": `var(--lx-toy-${matter}-top)`,
                      "--cover-bottom": `var(--lx-toy-${matter}-bottom)`,
                      "--cover-edge": `var(--lx-toy-${matter}-edge)`,
                    } as CSSProperties
                  }
                >
                  <CollectionSeal
                    collection={{ id: shelf.id, name: shelf.name, back: BOOK_BACKS[shelf.id] }}
                    size={76}
                  />
                  <span className={styles.bookText}>
                    <Lettering className={styles.bookName}>{shelf.name}</Lettering>
                    <span className={styles.bookWords}>{formatCount(shelf.count)} mots</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/enigme" className={`${ui.leaf} ${desk.leaf} ${styles.riddle}`}>
          <GiltCorners />
          <span className={desk.leafKicker}>Énigme du jour</span>
          <span className={styles.riddleTitle}>Un mot à trouver, indice après indice</span>
          <span
            className={desk.type}
            style={{ "--letters": 8 } as CSSProperties}
            aria-hidden="true"
          >
            {["S", null, null, null, null, null, null, null].map((letter, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one block per letter, in order
              <span key={at} className={letter === null ? desk.blockHollow : desk.block}>
                {letter}
              </span>
            ))}
          </span>
          <span className={styles.riddleText}>Une par jour, pour tout le monde, sans compte.</span>
          <span className={desk.go}>Jouer à l'énigme</span>
        </Link>
      </div>
    </section>
  );
}
