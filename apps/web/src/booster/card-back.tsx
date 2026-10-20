import type { Rarity } from "@leximon/core";
import { cardSize, cssFill, rarityStyles } from "@leximon/tokens";
import type { CSSProperties } from "react";
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
}

/** The back of a card, the same for every word. Only its edge can betray the rarity. */
export function CardBack({ rarity, width = cardSize.width, edge = 0, className }: CardBackProps) {
  const variables = {
    "--u": `${width / cardSize.width}px`,
    "--edge": cssFill(rarityStyles[rarity].frame),
    "--plain": `${1 - edge}`,
  } as CSSProperties;
  return (
    <div
      className={className === undefined ? styles.back : `${styles.back} ${className}`}
      style={variables}
      aria-hidden="true"
    >
      <div className={styles.inner}>
        <span className={styles.seal}>L</span>
        <span className={styles.brand}>Leximon</span>
      </div>
    </div>
  );
}
