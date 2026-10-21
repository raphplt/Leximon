"use client";

import type { CSSProperties } from "react";
import { useHoloLight } from "@/components/use-holo-light";
import { play, vibrate } from "./feedback";
import type { PackProps } from "./pack-shape";
import styles from "./sachet.module.css";
import { useTear } from "./use-tear";

/** Depth of the layers between the back and the front of the pouch, in units: its thickness. */
const SLICES = [-4, -2, 0, 2, 4] as const;

/**
 * The pack as a classic booster: a soft foil pouch crimped at both ends, torn across the top
 * (P47). Touching the pouch opens it too.
 *
 * The pouch is a small 3D object: a back, a few slices for its thickness and a front, tilted by
 * the light of `useHoloLight` like a held card, swaying on its own until the pointer takes it.
 */
export function Sachet({ state, onTearStart, onOpen }: PackProps) {
  const sealed = state === "sealed";
  const tear = useTear({ enabled: sealed, onTearStart, onOpen });
  // While the strip is pulled, the pouch holds still under the finger.
  const light = useHoloLight(sealed && !tear.dragging);

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
    <div className={styles.slot}>
      <div
        ref={light.ref}
        className={styles.scene}
        onPointerMove={light.onPointerMove}
        onPointerLeave={light.onPointerLeave}
      >
        <div className={styles.stage}>
          <div className={styles.shadow} aria-hidden="true" />
          <div className={classes} style={tear.style}>
            <div className={styles.back} aria-hidden="true" />
            {SLICES.map((z) => (
              <div
                key={z}
                className={styles.slice}
                style={{ "--z": `calc(${z} * var(--u))` } as CSSProperties}
                aria-hidden="true"
              />
            ))}
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
              <span className={styles.seal} aria-hidden="true">
                <span className={styles.stamp}>L</span>
              </span>
              <span className={styles.sticker} aria-hidden="true">
                5 mots à découvrir
              </span>
              <span className={styles.glare} aria-hidden="true" />
            </button>
            <div ref={tear.strip} className={styles.strip} {...tear.handlers} aria-hidden="true">
              <div className={styles.stripKept}>
                déchirer ici ▸<span className={styles.glare} />
              </div>
              <div className={styles.stripTorn}>
                déchirer ici ▸<span className={styles.glare} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
