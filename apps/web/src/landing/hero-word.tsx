"use client";

import type { CatalogCard } from "@leximon/contract";
import { cssFill, rarityStyles } from "@leximon/tokens";
import { frequencyLine } from "@leximon/view-model";
import { type CSSProperties, useState } from "react";
import { catalogFileUrl } from "@/cards/catalog";
import { creditLine, cssUrl, engravingOf, hasPlate } from "@/cards/engraving";
import { RarityName } from "@/components/rarity-icon";
import styles from "./landing-page.module.css";

/**
 * One word of the catalogue printed large, like a dictionary slip in the colours of its rarity,
 * and another one on demand. The first word comes with the page. Every slip is laid in the same
 * cell, only the current one shown and inked: the cell takes the tallest, so changing word never
 * moves the page. Without words, the page stands without it.
 */
export function HeroWord({ words }: { readonly words: readonly CatalogCard[] }) {
  const [index, setIndex] = useState(0);
  if (words.length === 0) return null;
  const another = () => setIndex((current) => anotherIndex(current, words.length));
  return (
    <div className={styles.slipStack}>
      {words.map((card, i) => (
        <Slip key={card.id} card={card} current={i === index} onAnother={another} />
      ))}
    </div>
  );
}

function Slip({
  card,
  current,
  onAnother,
}: {
  readonly card: CatalogCard;
  readonly current: boolean;
  readonly onAnother: () => void;
}) {
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
    <article
      className={current ? styles.slip : `${styles.slip} ${styles.away}`}
      style={variables}
      aria-hidden={current ? undefined : true}
      inert={!current}
    >
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
        <button className={styles.again} type="button" onClick={onAnother}>
          Encore un mot
        </button>
      </div>
      <SlipEngraving card={card} night={gradient} inked={current} />
    </article>
  );
}

/** Any word but the one on the slip. */
function anotherIndex(current: number, length: number): number {
  if (length < 2) return current;
  return (current + 1 + Math.floor(Math.random() * (length - 1))) % length;
}

/**
 * The engraving inked like on the card: same masks, printed bigger, with the credit beneath.
 * A slip not shown keeps the engraving's room but loads no image.
 */
function SlipEngraving({
  card,
  night,
  inked,
}: {
  readonly card: CatalogCard;
  readonly night: boolean;
  readonly inked: boolean;
}) {
  const engraving = engravingOf(card);
  if (engraving === null) return null;
  const variables = {
    aspectRatio: `${engraving.width} / ${engraving.height}`,
    "--ratio": `${engraving.width / engraving.height}`,
    ...(inked && {
      "--ink-src": cssUrl(catalogFileUrl(engraving.ink)),
      "--fill-src": cssUrl(catalogFileUrl(engraving.fill)),
    }),
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
