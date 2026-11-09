import { formatCount } from "@leximon/view-model";
import Link from "next/link";
import { CollectionSeal } from "@/components/collection-seal";
import { GiltCorners, TitleRule } from "@/ui/ornaments";
import { Kicker, Leaf, Lettering } from "@/ui/toy";
import styles from "./landing-page.module.css";
import type { Shelf } from "./showcase-cards";

const BOOK_BACKS: Readonly<Record<string, string>> = {
  fondateurs: "night",
  caracteres: "burgundy",
  metiers: "green",
};

/** The lettering has no narrow space: at display size, thousands take a full no-break space. */
function displayCount(value: number): string {
  return formatCount(value).replaceAll("\u202f", "\u00a0");
}

/** The three launch collections on uniform parchment leaves, and the daily riddle link below. */
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
        <TitleRule className={styles.sectionRule} />
      </div>
      <ul className={styles.books}>
        {shelves.map((shelf) => (
          <li key={shelf.id}>
            <Leaf className={styles.book}>
              <GiltCorners />
              <CollectionSeal
                collection={{ id: shelf.id, name: shelf.name, back: BOOK_BACKS[shelf.id] }}
                size={72}
              />
              <span className={styles.bookText}>
                <strong className={styles.bookName}>{shelf.name}</strong>
                <span className={styles.bookWords}>{formatCount(shelf.count)} mots</span>
              </span>
            </Leaf>
          </li>
        ))}
      </ul>
      <div className={styles.riddleBanner}>
        <Link href="/enigme" className={styles.riddleLink}>
          <Kicker>Énigme du jour</Kicker>
          <span className={styles.riddleCopy}>
            Un mot rare à deviner chaque jour, indice après indice, ouvert à tous sans compte.
          </span>
          <span className={styles.riddleCta}>Jouer à l'énigme ›</span>
        </Link>
      </div>
    </section>
  );
}
