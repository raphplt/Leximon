import type { CatalogCard } from "@leximon/contract";
import { RARITY_LABELS } from "@leximon/contract";
import { cardSize, cssFill, rarityStyles } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { catalogFileUrl } from "@/cards/catalog";
import { formatOdds, wordFontSize } from "@/cards/display";
import {
  creditLine,
  cssUrl,
  type Engraving,
  engravingBox,
  engravingOf,
  hasPlate,
} from "@/cards/engraving";
import styles from "./card.module.css";
import { RarityIcon } from "./rarity-icon";

interface CardProps {
  readonly card: CatalogCard;
  readonly collectionName: string;
  /** Width in px; the card keeps its proportions. */
  readonly width?: number;
}

/** A card face, drawn from the rarity tokens (D-022). Pure display: no state, no data access. */
export function Card({ card, collectionName, width = cardSize.width }: CardProps) {
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
    "--word-size": wordFontSize(card.word),
  } as CSSProperties;
  const label = RARITY_LABELS[card.rarity];
  const engraving = engravingOf(card);

  return (
    <article className={styles.card} style={variables} aria-label={`${card.word}, ${label}`}>
      <div className={styles.inner}>
        <header className={styles.top}>
          {/* The gem alone on the face; the interface names the rarity beside it elsewhere. */}
          <span className={styles.band} role="img" aria-label={label} title={label}>
            <RarityIcon rarity={card.rarity} />
          </span>
        </header>
        {engraving === null ? (
          <div className={styles.engraving} aria-hidden="true">
            <span className={styles.initial}>{card.word.slice(0, 1)}</span>
          </div>
        ) : (
          <EngravingPrint
            engraving={engraving}
            plate={hasPlate(card.rarity)}
            night={typeof style.word !== "string"}
          />
        )}
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
          <span>{collectionName}</span>
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

function units(value: number): string {
  return `calc(${value.toFixed(2)} * var(--u))`;
}

/**
 * The engraving printed like a two-pass woodcut: the ink in the word's colour, over a flat plate
 * of the rarity colour slightly out of register. Both files are alpha masks, so one image serves
 * every rarity. Decorative for screen readers; the credit shows where the card is zoomed.
 */
function EngravingPrint({
  engraving,
  plate,
  night,
}: {
  readonly engraving: Engraving;
  readonly plate: boolean;
  /** Gold or iridescent ink on a night card: the plate, of the same fill, stays fainter. */
  readonly night: boolean;
}) {
  const box = engravingBox(engraving);
  const variables = {
    width: units(box.width),
    height: units(box.height),
    "--ink-src": cssUrl(catalogFileUrl(engraving.ink)),
    "--fill-src": cssUrl(catalogFileUrl(engraving.fill)),
  } as CSSProperties;
  return (
    <div className={styles.print} title={creditLine(engraving)} aria-hidden="true">
      <div className={box.tall ? styles.printTall : styles.printWide} style={variables}>
        {plate && <div className={night ? styles.plateNight : styles.plate} />}
        <div className={styles.ink} />
      </div>
    </div>
  );
}
