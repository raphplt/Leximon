"use client";

import type { CollectionChoice } from "@leximon/view-model";
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
  back,
  onPick,
  onLocked,
}: {
  readonly side: "left" | "right";
  readonly choice: CollectionChoice;
  readonly back: string | undefined;
  readonly onPick: (choice: CollectionChoice) => void;
  readonly onLocked: () => void;
}) {
  const locked = choice.lock !== null;
  return (
    <div
      className={[
        styles.peek,
        side === "left" ? styles.peekLeft : styles.peekRight,
        locked ? styles.peekLocked : "",
      ].join(" ")}
    >
      <div className={styles.peekPack} inert>
        <Sachet
          state="sealed"
          collection={{ id: choice.id, name: choice.name, back }}
          onTearStart={noop}
          onOpen={noop}
        />
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
        onClick={() => (locked ? onLocked() : onPick(choice))}
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
