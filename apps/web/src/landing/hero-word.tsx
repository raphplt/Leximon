"use client";

import type { CatalogCard } from "@leximon/contract";
import { cssFill, rarityStyles } from "@leximon/tokens";
import { frequencyLine } from "@leximon/view-model";
import { type CSSProperties, useEffect, useState } from "react";
import { catalogFileUrl } from "@/cards/catalog";
import { creditLine, cssUrl, engravingOf, hasPlate } from "@/cards/engraving";
import { RarityName } from "@/components/rarity-icon";
import styles from "./landing-page.module.css";

/**
 * One word of the catalogue printed large, like a dictionary slip in the colours of its rarity,
 * and another one on demand. The page is the same for everyone, so the first word is drawn in
 * the browser: the slip keeps its place until then. Without words, the page stands without it.
 */
export function HeroWord({ words }: { readonly words: readonly CatalogCard[] }) {
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * words.length));
  }, [words.length]);

  const card = index === null ? undefined : words[index];
  if (card === undefined) return <div className={styles.slipPlaceholder} aria-hidden="true" />;

  const style = rarityStyles[card.rarity];
  const gradient = typeof style.word !== "string";
  const variables = {
    "--paper": style.paper,
    "--ink": style.ink,
    "--muted": style.muted,
    "--word": cssFill(style.word),
    "--frame": cssFill(style.frame),
  } as CSSProperties;

  return (
    <article className={styles.slip} style={variables} aria-live="polite">
      <p className={styles.slipMeta}>
        <RarityName rarity={card.rarity} />
        <span>{card.partOfSpeech}</span>
      </p>
      <p className={gradient ? styles.slipWordGradient : styles.slipWord}>{card.word}</p>
      <div className={styles.slipText}>
        <p className={styles.slipDefinition}>{card.definition}</p>
        {card.quote !== null && (
          <p className={styles.slipQuote}>
            « {card.quote.text} » <span>{card.quote.author}</span>
          </p>
        )}
        <p className={styles.slipFrequency}>{frequencyLine(card.perBillion)}</p>
        <button
          className={styles.again}
          type="button"
          onClick={() => setIndex((current) => ((current ?? 0) + 1) % words.length)}
        >
          Encore un mot
        </button>
      </div>
      <SlipEngraving card={card} night={gradient} />
    </article>
  );
}

/** The engraving inked like on the card: same masks, printed bigger, with the credit beneath. */
function SlipEngraving({ card, night }: { readonly card: CatalogCard; readonly night: boolean }) {
  const engraving = engravingOf(card);
  if (engraving === null) return null;
  const variables = {
    aspectRatio: `${engraving.width} / ${engraving.height}`,
    "--ratio": `${engraving.width / engraving.height}`,
    "--ink-src": cssUrl(catalogFileUrl(engraving.ink)),
    "--fill-src": cssUrl(catalogFileUrl(engraving.fill)),
  } as CSSProperties;
  return (
    <figure className={styles.slipFigure}>
      <div className={styles.slipPrint} style={variables} aria-hidden="true">
        {hasPlate(card.rarity) && (
          <div className={night ? styles.slipPlateNight : styles.slipPlate} />
        )}
        <div className={styles.slipInk} />
      </div>
      <figcaption className={styles.slipCredit}>{creditLine(engraving)}</figcaption>
    </figure>
  );
}
