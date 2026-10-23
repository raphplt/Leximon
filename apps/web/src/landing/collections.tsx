import { formatCount } from "@leximon/view-model";
import { Card } from "@/components/card";
import styles from "./landing-page.module.css";
import type { Shelf } from "./showcase-cards";

/**
 * At display size the narrow space between thousands looks like no space at all: the title
 * takes a full no-break space.
 */
function displayCount(value: number): string {
  return formatCount(value).replaceAll("\u202f", "\u00a0");
}

/** The launch collections, each shown by three real cards. */
export function Collections({ shelves }: { readonly shelves: readonly Shelf[] }) {
  if (shelves.length === 0) return null;
  const total = shelves.reduce((sum, shelf) => sum + shelf.count, 0);
  return (
    <section className={styles.collections} aria-labelledby="collections-title">
      <h2 id="collections-title" className={styles.collectionsTitle}>
        {displayCount(total)} mots pour commencer.
      </h2>
      <ul className={styles.shelves}>
        {shelves.map((shelf) => (
          <li key={shelf.id} className={styles.shelf}>
            <div className={styles.fanned} aria-hidden="true">
              {shelf.cards.map((card, index) => (
                <div key={card.id} className={styles[`fan${index}`]}>
                  <Card card={card} collectionName={shelf.name} width={150} />
                </div>
              ))}
            </div>
            <p className={styles.shelfName}>{shelf.name}</p>
            <p className={styles.shelfCount}>{formatCount(shelf.count)} cartes</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
