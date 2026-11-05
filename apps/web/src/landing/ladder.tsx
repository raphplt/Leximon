import { frequencyLine } from "@leximon/view-model";
import type { CSSProperties } from "react";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { Lettering } from "@/ui/toy";
import styles from "./landing-page.module.css";
import type { ShowcaseCard } from "./showcase-cards";

/** The six rarities on a gilt shelf, each with how often its word is printed. */
export function Ladder({ ladder }: { readonly ladder: readonly ShowcaseCard[] }) {
  if (ladder.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="ladder-title">
      <div className={styles.sectionHead}>
        <h2 id="ladder-title" className={styles.sectionTitle}>
          <Lettering>Six raretés, selon la fréquence du mot dans les livres.</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          De Courant, pour les mots qu'on croise encore, jusqu'à Légendaire, pour ceux qui ont
          presque disparu.
        </p>
      </div>
      <ol className={styles.ladder}>
        {ladder.map(({ card, collectionName }, at) => (
          <li key={card.id} className={styles.rung} style={{ "--at": at } as CSSProperties}>
            <Card card={card} collectionName={collectionName} width={144} />
            <span className={styles.rungTag}>
              <span className={styles.rungRarity}>
                <RarityName rarity={card.rarity} />
              </span>
              <span className={styles.rungFrequency}>{frequencyLine(card.perBillion)}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className={styles.plank} aria-hidden="true" />
    </section>
  );
}
