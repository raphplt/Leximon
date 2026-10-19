import { RARITY_LABELS } from "@leximon/contract";
import { RARITIES, rarityRank } from "@leximon/core";
import { cardSize, cssFill, rarityStyles } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { type CatalogCard, collectionName, formatOdds } from "@/cards/catalog";
import styles from "./card.module.css";

interface CardProps {
  readonly card: CatalogCard;
  /** Width in px; the card keeps its proportions. */
  readonly width?: number;
}

/** A card face, drawn from the rarity tokens (D-022). Pure display: no state, no data access. */
export function Card({ card, width = cardSize.width }: CardProps) {
  const style = rarityStyles[card.rarity];
  const variables = {
    "--u": `${width / cardSize.width}px`,
    "--frame": cssFill(style.frame),
    "--band": cssFill(style.band),
    "--band-ink": style.bandInk,
    "--word": cssFill(style.word),
    "--paper": style.paper,
    "--ink": style.ink,
    "--muted": style.muted,
    "--chip": style.chip,
    "--chip-ink": style.chipInk,
    "--spot": style.spot,
    "--hatch": style.hatch,
  } as CSSProperties;
  const label = RARITY_LABELS[card.rarity];
  const rank = rarityRank(card.rarity);

  return (
    <article className={styles.card} style={variables} aria-label={`${card.word}, ${label}`}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <span className={styles.band}>
            {label}
            <span className={styles.pips} aria-hidden="true">
              {RARITIES.map((rarity, index) => (
                <span key={rarity} className={index <= rank ? styles.pipOn : styles.pip} />
              ))}
            </span>
          </span>
        </header>
        <div className={styles.engraving} aria-hidden="true">
          <span className={styles.initial}>{card.word.slice(0, 1)}</span>
        </div>
        <h3 className={typeof style.word === "string" ? styles.word : styles.wordGradient}>
          {card.word}
        </h3>
        <p className={styles.chips}>
          <span className={styles.chip}>{card.partOfSpeech}</span>
          {card.era !== null && <span className={styles.chip}>{card.era}</span>}
        </p>
        <p className={styles.definition}>{card.definition}</p>
        {card.quote !== null && (
          <p className={styles.quote}>
            « {card.quote.text} » <span className={styles.author}>{card.quote.author}</span>
          </p>
        )}
        <footer className={styles.footer}>
          <span>{collectionName(card.collectionId)}</span>
          <span
            className={styles.odds}
            title="Fréquence du mot dans les livres d'aujourd'hui (Google Books Ngram)"
          >
            {formatOdds(card.perBillion)}
          </span>
        </footer>
      </div>
    </article>
  );
}
