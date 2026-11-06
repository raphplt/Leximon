"use client";

import {
  stripClicked,
  TEAR_COMPLETE_AT,
  TEAR_STARTED_AT,
  tearByClick,
  tearProgress,
} from "@leximon/view-model";
import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";
import { play, playTearGrain, vibrate } from "./feedback";

interface Tear {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  /** +1 when the strip tears from its left end, -1 from its right end. */
  readonly direction: 1 | -1;
  readonly lastGrainAt: number;
  readonly lastGrainProgress: number;
  readonly started: boolean;
  readonly progress: number;
}

interface TearOptions {
  readonly enabled: boolean;
  /** The tear has really begun: time to ask the server for the cards. */
  readonly onTearStart: () => void;
  readonly onOpen: () => void;
}

/** The share of strip a hovering mouse lifts: a split at its end, not a tear. */
const HINT = 0.1;
/** A crackle every this share of strip torn. */
const GRAIN_STEP = 0.025;

/**
 * Tearing a pack's strip with the finger, whatever the pack's shape: the strip follows the
 * finger, crackles, opens past 60 % and sticks back below. A mouse over the strip lifts its end
 * a little; a click on it tears it all, as a drag would. `style` carries `--torn`, `--kept`,
 * `--lift` and `--rise` for the pack's CSS to clip and lift the torn part.
 */
export function useTear({ enabled, onTearStart, onOpen }: TearOptions) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hinting, setHinting] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const tear = useRef<Tear | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const finish = () => {
    setProgress(1);
    play("tearFinish");
    vibrate([30]);
    onOpen();
  };

  /** Plays the whole tear from its left end, crackling as it goes. */
  const tearAll = () => {
    onTearStart();
    setDirection(1);
    setHinting(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setDragging(true);
    const start = performance.now();
    let grainAt = 0;
    const step = (now: number) => {
      const share = tearByClick(now - start);
      if (share - grainAt >= GRAIN_STEP) {
        playTearGrain(1.5);
        grainAt = share;
      }
      setProgress(share);
      if (share < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      setDragging(false);
      finish();
    };
    frame.current = requestAnimationFrame(step);
  };

  const onPointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (enabled && event.pointerType === "mouse") setHinting(true);
  };

  const onPointerLeave = () => setHinting(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || tear.current !== null || dragging) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    tear.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
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
    if (Math.abs(next - current.lastGrainProgress) >= GRAIN_STEP) {
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
      finish();
    } else if (
      event.type === "pointerup" &&
      !current.started &&
      stripClicked(event.clientX - current.startX, event.clientY - current.startY)
    ) {
      tearAll();
    } else {
      // The strip sticks back. A request already sent is kept for the next try.
      setProgress(0);
    }
  };

  const hint = progress === 0 && hinting && enabled;
  const shown = hint ? HINT : progress;
  const style = {
    "--torn": `${shown * 100}%`,
    "--kept": `${(1 - shown) * 100}%`,
    // The hint lifts its little piece higher than a drag would at that share, to be seen.
    "--lift": `${direction * (hint ? 12 : progress * 14)}deg`,
    "--rise": `${hint ? 4 : progress * 8}px`,
  } as CSSProperties;

  return {
    strip,
    style,
    dragging,
    fromRight: direction === -1,
    handlers: {
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
