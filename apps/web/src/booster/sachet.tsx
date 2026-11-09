"use client";

import { sachetContents } from "@leximon/view-model";
import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useHoloLight } from "@/components/use-holo-light";
import { play, vibrate } from "./feedback";
import { PackSeal, packVariables } from "./pack-looks";
import type { PackProps } from "./pack-shape";
import styles from "./sachet.module.css";
import { useTear } from "./use-tear";

/** Depth of the layers between the back and the front of the pouch, in units: its thickness. */
const SLICES = [-7, -3.5, 0, 3.5, 7] as const;

/**
 * The pack as a classic booster: a soft foil pouch crimped at both ends, torn across the top.
 * Touching the pouch opens it too. Each collection prints its own colors, motif and gold seal,
 * its name on a kraft ribbon; the house seal stays the same on all of them.
 *
 * The pouch is a small 3D object: a back, a few slices for its thickness and a front, tilted by
 * the light of `useHoloLight` like a held card, swaying on its own until the pointer takes it.
 */
/** How long the pouch glows once its wait is over. */
const REFILLED_MS = 900;

export function Sachet({
  state,
  onTearStart,
  onOpen,
  collection,
  refill = null,
  refillLabel = null,
  still = false,
}: PackProps) {
  const sealed = state === "sealed";
  const refilled = useRefilled(state, refill);
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
    refilled ? styles.refilled : "",
    tear.dragging ? styles.dragging : "",
    tear.fromRight ? styles.fromRight : "",
  ].join(" ");

  return (
    <div className={styles.slot}>
      <div
        ref={light.ref}
        className={`${styles.scene} ${still ? styles.still : ""}`}
        style={packVariables(collection)}
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
              aria-label={`Ouvrir le sachet ${collection.name}`}
              disabled={!sealed}
              onClick={openWithTouch}
            >
              <span className={styles.motif} aria-hidden="true" />
              <span className={styles.frame} aria-hidden="true" />
              <span className={styles.brand} aria-hidden="true">
                Leximon
              </span>
              <PackSeal
                collectionId={collection.id}
                engraving={collection.engraving}
                className={styles.seal}
              />
              <span className={styles.ribbon} aria-hidden="true">
                <span className={styles.name}>{collection.name}</span>
              </span>
              <span className={styles.contents} aria-hidden="true">
                {sachetContents(Date.now())}
              </span>
              <Image
                src="/logo-mark.svg"
                alt=""
                aria-hidden="true"
                width={64}
                height={64}
                className={styles.mark}
              />
              {state === "empty" && (
                <span
                  className={styles.waiting}
                  style={{ "--refill": refill ?? 0 } as CSSProperties}
                  aria-hidden="true"
                >
                  <span className={styles.waitingFill} />
                  <span className={styles.waitingLine} />
                  {refill !== null && refillLabel !== null && (
                    <span className={styles.waitingTime}>{refillLabel}</span>
                  )}
                </span>
              )}
              <span className={styles.volume} aria-hidden="true" />
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

/**
 * True for a moment once a pouch that was filling up becomes sealed: the wait is over. A pouch
 * that arrives sealed, or one waiting for an account rather than for time, does not glow.
 */
function useRefilled(state: PackProps["state"], refill: number | null): boolean {
  const wasFilling = useRef(false);
  const [refilled, setRefilled] = useState(false);
  useEffect(() => {
    if (state === "empty") {
      wasFilling.current = refill !== null;
      return;
    }
    if (state !== "sealed" || !wasFilling.current) return;
    wasFilling.current = false;
    setRefilled(true);
    play("newCard");
    const timer = setTimeout(() => setRefilled(false), REFILLED_MS);
    return () => clearTimeout(timer);
  }, [state, refill]);
  return refilled;
}
