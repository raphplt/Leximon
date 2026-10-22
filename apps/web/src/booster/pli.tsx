"use client";

import { play, vibrate } from "./feedback";
import type { PackProps } from "./pack-shape";
import styles from "./pli.module.css";
import { useTear } from "./use-tear";

/** The pack as a kraft fold sealed with wax. Torn along its strip, or opened by the seal. */
export function Pli({ state, onTearStart, onOpen }: PackProps) {
  const sealed = state === "sealed";
  const tear = useTear({ enabled: sealed, onTearStart, onOpen });

  const openWithSeal = () => {
    onTearStart();
    play("sealBreak");
    vibrate([40]);
    onOpen();
  };

  const classes = [
    styles.envelope,
    state === "opening" ? styles.opening : "",
    tear.dragging ? styles.dragging : "",
    tear.fromRight ? styles.fromRight : "",
  ].join(" ");

  return (
    <div className={classes} style={tear.style}>
      <div className={styles.burst} aria-hidden="true">
        <span className={styles.burstCardA} />
        <span className={styles.burstCardB} />
      </div>
      <div className={styles.kraft} />
      <div ref={tear.strip} className={styles.strip} {...tear.handlers} aria-hidden="true">
        <div className={styles.stripKept}>✂ déchirer ici</div>
        <div className={styles.stripTorn}>✂ déchirer ici</div>
      </div>
      <span className={styles.sticker}>5 mots à découvrir</span>
      <span className={styles.brand}>Leximon</span>
      <button
        type="button"
        className={styles.seal}
        aria-label="Briser le sceau et ouvrir le pli"
        disabled={!sealed}
        onClick={openWithSeal}
      >
        <span aria-hidden="true">L</span>
      </button>
    </div>
  );
}
