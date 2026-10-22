"use client";

import type { CollectionChoice } from "@leximon/view-model";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./play.module.css";

/**
 * Which sachet to open: chips on the web, arrows around the name on a phone. Closed
 * choices stay visible with their level.
 */
export function CollectionPicker({
  choices,
  current,
  onPick,
  onLocked,
}: {
  readonly choices: readonly CollectionChoice[];
  readonly current: CollectionChoice;
  readonly onPick: (choice: CollectionChoice) => void;
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
    if (next !== undefined) onPick(next);
  };
  return (
    <>
      <fieldset className={styles.chips}>
        <legend className={styles.legend}>Collection du sachet</legend>
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            aria-pressed={choice.id === current.id}
            className={`${ui.chip} ${choice.lock !== null ? styles.chipLocked : ""}`}
            onClick={() => (choice.lock !== null ? onLocked() : onPick(choice))}
          >
            <span>{choice.short}</span>
            {choice.lock !== null && (
              <span className={styles.chipLock}>
                <Icon name="lock" size={12} />
                {choice.lock}
              </span>
            )}
          </button>
        ))}
      </fieldset>
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
    </>
  );
}
