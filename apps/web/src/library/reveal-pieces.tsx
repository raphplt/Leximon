import { revealSheen } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { Lettering } from "@/ui/toy";
import styles from "./reveal-pieces.module.css";

/**
 * Rays turning slowly behind a card of the highest rarities. They open with a spring when
 * `shown` turns true and stay until it turns false.
 */
export function Rays({
  size,
  color,
  shown,
}: {
  readonly size: number;
  readonly color: string;
  readonly shown: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={styles.rays}
      data-shown={shown || undefined}
      style={{ "--size": `${size}px`, "--light": color } as CSSProperties}
    >
      <div className={styles.raysTurn} />
    </div>
  );
}

/** A light behind a card, in its rarity's color, while it is announced and once it shows. */
export function Aura({
  size,
  color,
  strength,
}: {
  readonly size: number;
  readonly color: string;
  /** 0 for none, 1 for full. */
  readonly strength: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={styles.aura}
      style={{ "--size": `${size}px`, "--light": color, "--strength": strength } as CSSProperties}
    />
  );
}

/**
 * The rarity's name stamped over the card: it falls from large, settles, holds, then rises
 * away. A new `stamp` plays it again.
 */
export function RarityBanner({
  text,
  color,
  stamp,
}: {
  readonly text: string;
  readonly color: string;
  readonly stamp: number;
}) {
  if (stamp === 0) return null;
  return (
    <div
      key={stamp}
      aria-hidden="true"
      className={styles.banner}
      style={{ "--lx-lettering-fill": color } as CSSProperties}
    >
      <Lettering>{text}</Lettering>
    </div>
  );
}

/**
 * A band of light sweeping across a card's face as it settles. A new `sweep` plays it again;
 * the face must clip it.
 */
export function Sheen({ sweep }: { readonly sweep: number }) {
  if (sweep === 0) return null;
  return (
    <div
      key={sweep}
      aria-hidden="true"
      className={styles.sheen}
      style={{ "--sheen": revealSheen } as CSSProperties}
    />
  );
}
