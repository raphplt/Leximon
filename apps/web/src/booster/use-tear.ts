"use client";

import { type CSSProperties, type PointerEvent, useRef, useState } from "react";
import { play, playTearGrain, vibrate } from "./feedback";
import { TEAR_COMPLETE_AT, TEAR_STARTED_AT, tearProgress } from "./gesture";

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

interface TearOptions {
  readonly enabled: boolean;
  /** The tear has really begun: time to ask the server for the cards. */
  readonly onTearStart: () => void;
  readonly onOpen: (via: "tear") => void;
}

/**
 * Tearing a pack's strip with the finger, whatever the pack's shape: the strip follows the
 * finger, crackles, opens past 60 % and sticks back below. `style` carries `--torn`, `--kept`,
 * `--lift` and `--rise` for the pack's CSS to clip and lift the torn part.
 */
export function useTear({ enabled, onTearStart, onOpen }: TearOptions) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const tear = useRef<Tear | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || tear.current !== null) return;
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
      onOpen("tear");
    } else {
      // The strip sticks back. A request already sent is kept for the next try.
      setProgress(0);
    }
  };

  const style = {
    "--torn": `${progress * 100}%`,
    "--kept": `${(1 - progress) * 100}%`,
    "--lift": `${direction * progress * 14}deg`,
    "--rise": `${progress * 8}px`,
  } as CSSProperties;

  return {
    strip,
    style,
    dragging,
    fromRight: direction === -1,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
