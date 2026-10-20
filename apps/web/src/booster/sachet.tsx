"use client";

import { play, vibrate } from "./feedback";
import type { PackProps } from "./pack-shape";
import styles from "./sachet.module.css";
import { useTear } from "./use-tear";

/**
 * The pack as a classic booster: a soft foil pouch crimped at both ends, torn across the top
 * (P47). Touching the pouch opens it too.
 */
export function Sachet({ state, onTearStart, onOpen }: PackProps) {
  const sealed = state === "sealed";
  const tear = useTear({ enabled: sealed, onTearStart, onOpen });

  const openWithTouch = () => {
    onTearStart();
    play("tearFinish");
    vibrate([40]);
    onOpen();
  };

  const classes = [
    styles.sachet,
    state === "opening" ? styles.opening : "",
    state === "empty" ? styles.empty : "",
    tear.dragging ? styles.dragging : "",
    tear.fromRight ? styles.fromRight : "",
  ].join(" ");

  return (
    <div className={classes} style={tear.style}>
      <div className={styles.burst} aria-hidden="true">
        <span className={styles.burstCardA} />
        <span className={styles.burstCardB} />
      </div>
      <button
        type="button"
        className={styles.pouch}
        aria-label="Ouvrir le sachet"
        disabled={!sealed}
        onClick={openWithTouch}
      >
        <span className={styles.brand} aria-hidden="true">
          Leximon
        </span>
        <span className={styles.medal} aria-hidden="true">
          L
        </span>
        <span className={styles.sticker} aria-hidden="true">
          5 mots à découvrir
        </span>
      </button>
      <div ref={tear.strip} className={styles.strip} {...tear.handlers} aria-hidden="true">
        <div className={styles.stripKept}>déchirer ici ▸</div>
        <div className={styles.stripTorn}>déchirer ici ▸</div>
      </div>
    </div>
  );
}
