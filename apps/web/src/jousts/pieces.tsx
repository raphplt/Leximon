"use client";

import type { CatalogCard } from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import type { Rarity } from "@leximon/core";
import { cssFill, rarityStyles } from "@leximon/tokens";
import { answerTimeText, FURET, trappedText } from "@leximon/view-model";
import type { CSSProperties, ReactNode } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { catalogCard } from "@/trades/card-thumb";
import { Icon } from "@/ui/icon";
import { FuretMedallion } from "./furet-medallion";
import styles from "./jousts.module.css";

/** Each leaf rises in turn when the screen appears, as on Jouer. */
export const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

/** What a card costs in a deck: a gem cut in the colour of its rarity. */
export function CostGem({ rarity, cost }: { readonly rarity: Rarity; readonly cost: number }) {
  return (
    <span
      className={styles.gem}
      style={
        {
          "--gem": cssFill(rarityStyles[rarity].band),
          "--gem-ink": rarityStyles[rarity].bandInk,
        } as CSSProperties
      }
    >
      <span>{cost}</span>
    </span>
  );
}

/**
 * A card of the deck, the real face at a small size: its cost on a gold coin when asked, and the
 * opponents it trapped on a red seal.
 */
export function MiniCard({
  card,
  width,
  cost,
  trapped = 0,
  className,
  style,
}: {
  readonly card: CatalogCard;
  readonly width: number;
  readonly cost?: number | undefined;
  /** Opponents the card trapped, said on a ribbon across its foot. */
  readonly trapped?: number;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}) {
  const catalog = useCatalog();
  return (
    <span
      className={`${styles.mini} ${className ?? ""}`}
      style={
        {
          "--w": `${width}px`,
          ...style,
        } as CSSProperties
      }
    >
      <Card
        card={card}
        collectionName={catalog === null ? "" : collectionName(catalog, card.collectionId)}
        width={width}
      />
      {cost !== undefined && (
        <span className={styles.miniCost} aria-hidden="true">
          <CostGem rarity={card.rarity} cost={cost} />
        </span>
      )}
      {trapped > 0 && <span className={styles.trapRibbon}>{trappedText(trapped)}</span>}
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
      <span className={styles.furetFace}>
        <FuretMedallion size={84} />
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
    return <FuretMedallion size={size} ribbon={false} />;
  }
  return <Avatar avatar={duelist.avatar} frame={duelist.frame} size={size} />;
}
