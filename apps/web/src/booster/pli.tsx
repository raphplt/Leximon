"use client";

import { type CSSProperties, type PointerEvent, useRef, useState } from "react";
import { play, playTearGrain, vibrate } from "./feedback";
import { TEAR_COMPLETE_AT, TEAR_STARTED_AT, tearProgress } from "./gesture";
import styles from "./pli.module.css";

/**
 * The pack as a kraft fold sealed with wax (D-022). Torn open along its strip, or opened by
 * touching the seal. Another pack shape only has to offer the same props
 * (docs/cahiers-des-charges/ouverture.md, « forme du paquet »).
 */
interface PliProps {
  /** `opening` once the player has opened it: the strip flies off and the cards come out. */
  readonly state: "sealed" | "empty" | "opening";
  /** The tear has really begun: time to ask the server for the cards. */
  readonly onTearStart: () => void;
  readonly onOpen: () => void;
}

interface Tear {
  readonly pointerId: number;
  readonly startX: number;
  /** +1 when the strip tears from its left end, -1 from its right end. */
  readonly direction: 1 | -1;
  readonly lastGrainAt: number;
  readonly lastGrainProgress: number;
  readonly started: boolean;
  readonly progress: number;
}

export function Pli({ state, onTearStart, onOpen }: PliProps) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const tear = useRef<Tear | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const sealed = state === "sealed";

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!sealed || tear.current !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    tear.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      direction: 1,
      lastGrainAt: event.timeStamp,
      lastGrainProgress: 0,
      started: false,
      progress: 0,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = tear.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const next = tearProgress(dx, strip.current?.offsetWidth ?? 0);
    const tearDirection: 1 | -1 = current.started ? current.direction : dx < 0 ? -1 : 1;
    let updated: Tear = { ...current, direction: tearDirection, progress: next };
    if (!current.started && next >= TEAR_STARTED_AT) {
      updated = { ...updated, started: true };
      onTearStart();
    }
    if (Math.abs(next - current.lastGrainProgress) >= 0.025) {
      const elapsed = Math.max(1, event.timeStamp - current.lastGrainAt);
      playTearGrain((Math.abs(next - current.lastGrainProgress) * 1000) / elapsed);
      updated = { ...updated, lastGrainAt: event.timeStamp, lastGrainProgress: next };
    }
    tear.current = updated;
    setDirection(tearDirection);
    setProgress(next);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const current = tear.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    tear.current = null;
    setDragging(false);
    if (current.progress >= TEAR_COMPLETE_AT) {
      setProgress(1);
      play("tearFinish");
      vibrate([30]);
      onOpen();
    } else {
      // The strip sticks back. A request already sent is kept for the next try.
      setProgress(0);
    }
  };

  const openWithSeal = () => {
    onTearStart();
    play("sealBreak");
    vibrate([40]);
    onOpen();
  };

  const tearStyle = {
    "--torn": `${progress * 100}%`,
    "--kept": `${(1 - progress) * 100}%`,
    "--lift": `${direction * progress * 14}deg`,
    "--rise": `${progress * 8}px`,
  } as CSSProperties;
  const classes = [
    styles.envelope,
    state === "opening" ? styles.opening : "",
    dragging ? styles.dragging : "",
    direction === -1 ? styles.fromRight : "",
  ].join(" ");

  return (
    <div className={classes} style={tearStyle}>
      <div className={styles.burst} aria-hidden="true">
        <span className={styles.burstCardA} />
        <span className={styles.burstCardB} />
      </div>
      <div className={styles.kraft} />
      <div
        ref={strip}
        className={styles.strip}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        aria-hidden="true"
      >
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
