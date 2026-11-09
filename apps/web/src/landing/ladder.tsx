import { frequencyLine } from "@leximon/view-model";
import type { CSSProperties } from "react";
import { Card } from "@/components/card";
import { RarityIcon, RarityName } from "@/components/rarity-icon";
import { TitleRule, Tooling } from "@/ui/ornaments";
import { Kicker, Lettering } from "@/ui/toy";
import styles from "./landing-page.module.css";
import type { ShowcaseCard } from "./showcase-cards";

/** The six rarities displayed on stepped pedestals inside an emerald collector's cabinet. */
export function Ladder({ ladder }: { readonly ladder: readonly ShowcaseCard[] }) {
  if (ladder.length === 0) return null;
  return (
    <section
      id="raretes"
      className={`${styles.cabinet} ${styles.section}`}
      data-tone="emeraude"
      aria-labelledby="ladder-title"
    >
      <Tooling />
      <div className={styles.sectionHead}>
        <Kicker>Échelle de rareté · Google Books Ngram</Kicker>
        <h2 id="ladder-title" className={styles.sectionTitle}>
          <Lettering>Six raretés calées sur la vraie rareté du mot</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          Plus un mot s'est fait rare dans les livres imprimés, plus sa carte est précieuse : du
          papier crème des Communes jusqu'à l'or et au prisme des Légendaires.
        </p>
        <TitleRule className={styles.sectionRule} />
      </div>

      <ol className={styles.ladder}>
        {ladder.map(({ card, collectionName }, at) => (
          <li key={card.id} className={styles.rung} style={{ "--at": at } as CSSProperties}>
            <div className={styles.rungCard}>
              <Card card={card} collectionName={collectionName} width={156} />
            </div>
            <span className={styles.rungTag}>
              <span className={styles.rungRarity}>
                <RarityIcon rarity={card.rarity} size="14px" />
                <RarityName rarity={card.rarity} />
              </span>
              <span className={styles.rungFrequency}>{frequencyLine(card.perBillion)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
