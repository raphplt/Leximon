import { formatCount, frequencyLine } from "@leximon/view-model";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import styles from "./landing-page.module.css";
import type { Shelf, ShowcaseCard } from "./showcase-cards";

/**
 * At display size the narrow space between thousands looks like no space at all: the count
 * takes a full no-break space.
 */
function displayCount(value: number): string {
  return formatCount(value).replaceAll(" ", " ");
}

/**
 * The catalogue told by its rarities: one real card of each, from a word still printed to one
 * no book prints any more, each with how often it is printed. Then the launch collections.
 */
export function Collections({
  ladder,
  shelves,
}: {
  readonly ladder: readonly ShowcaseCard[];
  readonly shelves: readonly Shelf[];
}) {
  if (ladder.length === 0) return null;
  const total = shelves.reduce((sum, shelf) => sum + shelf.count, 0);
  return (
    <section className={styles.collections} aria-labelledby="collections-title">
      <div className={styles.collectionsHead}>
        <h2 id="collections-title" className={styles.collectionsTitle}>
          Six raretés, selon la fréquence du mot dans les livres.
        </h2>
        <p className={styles.collectionsLead}>
          De Courant, pour les mots qu'on croise encore, jusqu'à Légendaire, pour ceux qui ont
          presque disparu.
        </p>
      </div>
      <ol className={styles.ladder}>
        {ladder.map(({ card, collectionName }) => (
          <li key={card.id} className={styles.rung}>
            <div className={styles.rungCard}>
              <Card card={card} collectionName={collectionName} width={168} />
            </div>
            <p className={styles.rungRarity}>
              <RarityName rarity={card.rarity} />
            </p>
            <p className={styles.rungFrequency}>{frequencyLine(card.perBillion)}</p>
          </li>
        ))}
      </ol>
      {shelves.length > 0 && (
        <p className={styles.shelves}>
          <strong>{displayCount(total)} mots</strong> pour commencer :{" "}
          {shelves.map((shelf, index) => (
            <span key={shelf.id}>
              {index > 0 && (index === shelves.length - 1 ? " et " : ", ")}
              <span className={styles.shelfName}>{shelf.name}</span>
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}
