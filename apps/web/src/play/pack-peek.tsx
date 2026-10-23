"use client";

import type { CollectionChoice } from "@leximon/view-model";
import type { PackCollection } from "@/booster/pack-looks";
import { Sachet } from "@/booster/sachet";
import { Icon } from "@/ui/icon";
import styles from "./play.module.css";

const noop = () => undefined;

/**
 * Another collection's sachet, tucked behind the one on the counter, on its left or right: taken,
 * it comes to the front. A closed one stays grey with its level.
 */
export function PackPeek({
  side,
  choice,
  pack,
  entry,
  onPick,
  onLocked,
}: {
  readonly side: "left" | "right";
  /**
   * How it arrived on a change of sachet: `front` when it was the sachet on the counter and steps
   * back, `outside` when it comes round from the far side.
   */
  readonly entry: "front" | "outside" | null;
  readonly choice: CollectionChoice;
  readonly pack: PackCollection;
  readonly onPick: (choice: CollectionChoice, from: "left" | "right") => void;
  readonly onLocked: () => void;
}) {
  const locked = choice.lock !== null;
  return (
    <div
      className={[
        styles.peek,
        side === "left" ? styles.peekLeft : styles.peekRight,
        locked ? styles.peekLocked : "",
        entry === "front"
          ? styles.peekFromFront
          : entry === "outside"
            ? styles.peekFromOutside
            : "",
      ].join(" ")}
    >
      <div className={styles.peekPack} inert>
        <Sachet state="sealed" collection={pack} onTearStart={noop} onOpen={noop} still />
      </div>
      <button
        type="button"
        className={styles.peekHit}
        title={choice.name}
        aria-label={
          locked
            ? `Sachet ${choice.name}, ${choice.lock?.replace("Niv.", "niveau")}`
            : `Prendre le sachet ${choice.name}`
        }
        onClick={() => (locked ? onLocked() : onPick(choice, side))}
      />
      {locked && (
        <span className={styles.peekLock}>
          <Icon name="lock" size={12} />
          {choice.lock}
        </span>
      )}
    </div>
  );
}

/**
 * Beside the sachets behind, on the counter's edge: an arrow that stays, with the name of the
 * collection it brings. The sachets themselves can be taken too.
 */
export function PeekArrow({
  side,
  choice,
  onPick,
  onLocked,
}: {
  readonly side: "left" | "right";
  readonly choice: CollectionChoice;
  readonly onPick: (choice: CollectionChoice, from: "left" | "right") => void;
  readonly onLocked: () => void;
}) {
  const locked = choice.lock !== null;
  return (
    <button
      type="button"
      className={`${styles.peekArrow} ${side === "left" ? styles.peekArrowLeft : styles.peekArrowRight}`}
      aria-label={
        locked
          ? `Sachet ${choice.name}, ${choice.lock?.replace("Niv.", "niveau")}`
          : `Prendre le sachet ${choice.name}`
      }
      title={choice.tagline ?? choice.name}
      onClick={() => (locked ? onLocked() : onPick(choice, side))}
    >
      {side === "left" && <Icon name="back" size={16} />}
      <span className={styles.peekArrowName}>{choice.short}</span>
      {locked && <Icon name="lock" size={12} />}
      {side === "right" && <Icon name="chev" size={16} />}
    </button>
  );
}
