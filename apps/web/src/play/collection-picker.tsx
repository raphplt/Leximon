"use client";

import type { CollectionChoice } from "@leximon/view-model";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./play.module.css";

/**
 * On a phone, which sachet to open: arrows around its name, going through the open ones, and a
 * dot per collection, the closed ones with their padlock. On a wider screen, the other sachets
 * wait behind the counter's (`PackPeek`).
 */
export function CollectionPicker({
  choices,
  current,
  onPick,
  onLocked,
}: {
  readonly choices: readonly CollectionChoice[];
  readonly current: CollectionChoice;
  /** `from`: the side the new sachet comes in from. */
  readonly onPick: (choice: CollectionChoice, from: "left" | "right") => void;
  readonly onLocked: () => void;
}) {
  const open = choices.filter((c) => c.lock === null);
  const shift = (step: number) => {
    if (open.length < 2) {
      onLocked();
      return;
    }
    const index = open.findIndex((c) => c.id === current.id);
    const next = open[(index + step + open.length) % open.length];
    if (next !== undefined) onPick(next, step > 0 ? "right" : "left");
  };
  const at = choices.findIndex((c) => c.id === current.id);
  return (
    <div className={styles.picker}>
      <div className={styles.arrows}>
        <button
          type="button"
          className={ui.round}
          onClick={() => shift(-1)}
          aria-label="Collection précédente"
        >
          <Icon name="back" size={18} />
        </button>
        <div className={styles.arrowName} aria-live="polite">
          <span className={ui.kicker}>Sachet</span>
          <span className={`${ui.display} ${styles.arrowTitle}`}>{current.short}</span>
        </div>
        <button
          type="button"
          className={ui.round}
          onClick={() => shift(1)}
          aria-label="Collection suivante"
        >
          <Icon name="chev" size={18} />
        </button>
      </div>
      {choices.length > 1 && (
        <fieldset className={styles.pickerChips} aria-label="Collections">
          {choices.map((choice, index) => (
            <button
              key={choice.id}
              type="button"
              className={`${styles.pickerChip} ${
                choice.id === current.id ? styles.pickerChipOn : ""
              } ${choice.lock !== null ? styles.pickerChipLocked : ""}`}
              aria-pressed={choice.id === current.id}
              aria-label={
                choice.lock === null
                  ? `Sachet ${choice.name}`
                  : `Sachet ${choice.name}, ${choice.lock.replace("Niv.", "niveau")}`
              }
              onClick={() =>
                choice.lock !== null
                  ? onLocked()
                  : choice.id !== current.id && onPick(choice, index > at ? "right" : "left")
              }
            >
              {choice.lock !== null && <Icon name="lock" size={10} />}
            </button>
          ))}
        </fieldset>
      )}
      {current.tagline !== null && <p className={styles.pickerTagline}>{current.tagline}</p>}
    </div>
  );
}
