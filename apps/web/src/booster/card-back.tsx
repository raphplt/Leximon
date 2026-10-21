import type { Rarity } from "@leximon/core";
import { backTone, cardSize, cssFill, rarityStyles } from "@leximon/tokens";
import { type CSSProperties, useId } from "react";
import styles from "./card-back.module.css";

interface CardBackProps {
  readonly rarity: Rarity;
  readonly width?: number;
  /**
   * How much of the rarity color shows on the edge, from 0 (plain kraft) to 1. Kept at 0 until
   * the player peeks at the stack or the card announces itself.
   */
  readonly edge?: number;
  readonly className?: string;
  /** The `back` of the pack's collection; night when absent. */
  readonly tone?: string | undefined;
}

/**
 * The back of a card, the same for every word: a printer's mark on domino paper (chosen
 * 2026-10-21). Only its edge can betray the rarity.
 */
export function CardBack({
  rarity,
  width = cardSize.width,
  edge = 0,
  className,
  tone,
}: CardBackProps) {
  const motto = useId();
  const cloth = backTone(tone);
  const variables = {
    "--u": `${width / cardSize.width}px`,
    "--edge": cssFill(rarityStyles[rarity].frame),
    "--plain": `${1 - edge}`,
    "--cloth-light": cloth.light,
    "--cloth-dark": cloth.dark,
  } as CSSProperties;
  const classes = className === undefined ? styles.back : `${styles.back} ${className}`;
  return (
    <div className={classes} style={variables} aria-hidden="true">
      <div className={styles.inner}>
        <svg aria-hidden="true" className={styles.mark} viewBox="0 0 160 160">
          <defs>
            <path id={motto} d="M80 80m-58 0a58 58 0 1 1 116 0a58 58 0 1 1 -116 0" />
          </defs>
          <circle cx="80" cy="80" r="74" className={styles.disc} />
          <circle cx="80" cy="80" r="71" className={styles.thin} />
          <circle cx="80" cy="80" r="46" className={styles.thin} />
          <text className={styles.motto}>
            <textPath href={`#${motto}`} textLength="360" lengthAdjust="spacing">
              MOTS RARES · MOTS ANCIENS · MOTS RARES · MOTS ANCIENS ·
            </textPath>
          </text>
          <text x="80" y="80" className={styles.letter}>
            L
          </text>
        </svg>
        <span className={styles.name}>Leximon</span>
      </div>
    </div>
  );
}
