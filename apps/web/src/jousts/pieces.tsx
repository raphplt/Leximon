"use client";

import type { CatalogCard } from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import { answerTimeText, FURET, formatCount, trappedText } from "@leximon/view-model";
import type { CSSProperties, ReactNode } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { catalogCard } from "@/trades/card-thumb";
import { Icon } from "@/ui/icon";
import { ToyIcon } from "@/ui/toy";
import styles from "./jousts.module.css";

/** Each leaf rises in turn when the screen appears, as on Jouer. */
export const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

/**
 * A card of the deck, the real face at a small size: its cost on a gold coin when asked, and the
 * opponents it trapped on a red seal.
 */
export function MiniCard({
  card,
  width,
  cost,
  trapped = 0,
  sealLeft = false,
  className,
  style,
}: {
  readonly card: CatalogCard;
  readonly width: number;
  readonly cost?: number | undefined;
  /** Opponents the card trapped, shown as a seal under it. */
  readonly trapped?: number;
  /** In a fan, where the next card covers the right edge, the seal moves to the left. */
  readonly sealLeft?: boolean;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}) {
  const catalog = useCatalog();
  return (
    <span
      className={`${styles.mini} ${className ?? ""}`}
      data-seal-left={sealLeft || undefined}
      style={{ "--w": `${width}px`, ...style } as CSSProperties}
    >
      <Card
        card={card}
        collectionName={catalog === null ? "" : collectionName(catalog, card.collectionId)}
        width={width}
      />
      {cost !== undefined && (
        <span className={styles.miniCost} aria-hidden="true">
          {cost}
        </span>
      )}
      {trapped > 0 && (
        <span className={styles.trapSeal} role="img" aria-label={trappedText(trapped)}>
          {formatCount(trapped)}
        </span>
      )}
    </span>
  );
}

/** The words of a run as real cards, each with its mark, right or wrong, and its time. */
export function AnswerCards({
  answers,
  width,
}: {
  readonly answers: readonly {
    readonly cardId: string;
    readonly correct: boolean;
    readonly ms: number;
  }[];
  readonly width: number;
}) {
  const catalog = useCatalog();
  if (catalog === null) return null;
  return (
    <ol className={styles.answers}>
      {answers.map((answer, index) => (
        <li
          key={answer.cardId}
          className={styles.answerCard}
          data-right={answer.correct || undefined}
          style={{ "--i": index } as CSSProperties}
        >
          <MiniCard
            card={catalogCard(catalog, answer.cardId)}
            width={width}
            className={answer.correct ? undefined : styles.missed}
          />
          <span className={styles.answerIcon}>
            <Icon name={answer.correct ? "check" : "close"} size={16} />
          </span>
          <span className={styles.answerTime}>{answerTimeText(answer)}</span>
        </li>
      ))}
    </ol>
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
