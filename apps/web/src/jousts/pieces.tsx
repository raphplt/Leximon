"use client";

import type { CatalogCard } from "@leximon/contract";
import { cssFill, rarityStyles } from "@leximon/tokens";
import { FURET } from "@leximon/view-model";
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { RarityIcon } from "@/components/rarity-icon";
import { ToyIcon } from "@/ui/toy";
import styles from "./jousts.module.css";

/** Each leaf rises in turn when the screen appears, as on Jouer. */
export const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

/** A small card of the deck: the rarity band, its gem, the cost if asked, and the word. */
export function MiniCard({
  card,
  cost,
  className,
  style,
}: {
  readonly card: CatalogCard;
  readonly cost?: number | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}) {
  return (
    <span
      className={`${styles.mini} ${className ?? ""}`}
      style={
        {
          "--band": cssFill(rarityStyles[card.rarity].band),
          "--band-ink": rarityStyles[card.rarity].bandInk,
          ...style,
        } as CSSProperties
      }
    >
      <span className={styles.miniBand}>
        <RarityIcon rarity={card.rarity} size="12px" />
        {cost !== undefined && <span className={styles.miniCost}>{cost}</span>}
      </span>
      <span className={styles.miniWord}>{card.word}</span>
    </span>
  );
}

/** Maître Furet in a medallion, and what he says in a bubble beside him. */
export function Furet({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.furet}>
      <span className={styles.furetFace} aria-hidden="true">
        <ToyIcon name="books" size={44} />
      </span>
      <div className={styles.furetBubble}>
        <span className={styles.furetName}>{FURET}</span>
        {children}
      </div>
    </div>
  );
}

/** One side of a joust: a player, or Maître Furet in training. */
export interface Duelist {
  readonly name: string;
  readonly avatar: string | null;
  readonly frame: string | null;
  /** Maître Furet: his medallion stands for the avatar. */
  readonly furet?: boolean;
}

export function DuelistFace({
  duelist,
  size,
}: {
  readonly duelist: Duelist;
  readonly size: number;
}) {
  if (duelist.furet === true) {
    return (
      <span
        className={styles.medallion}
        data-tone="gold"
        style={{ "--size": `${size}px` } as CSSProperties}
        aria-hidden="true"
      >
        <ToyIcon name="books" size={Math.round(size * 0.62)} />
      </span>
    );
  }
  return <Avatar avatar={duelist.avatar} frame={duelist.frame} size={size} />;
}
