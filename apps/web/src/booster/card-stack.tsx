"use client";

import type { DrawnCard } from "@leximon/view-model";
import { type CSSProperties, type PointerEvent, useRef, useState } from "react";
import { CardBack } from "./card-back";
import styles from "./card-stack.module.css";
import { peekAmount, stackRelease } from "./gesture";

/** How far apart two cards of the stack drift at a full peek, in px. */
const FAN_STEP = 22;

interface CardStackProps {
  /** In reveal order: the first card is on top, the rarest at the bottom. */
  readonly cards: readonly DrawnCard[];
  readonly width: number;
  readonly onReveal: () => void;
  /** The `back` of the pack's collection. */
  readonly tone?: string | undefined;
}

interface Drag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly dx: number;
  readonly dy: number;
}

/**
 * The cards just out of the pack, face down. Dragging the stack diagonally fans it out and
 * shows the edges, colored by rarity: a bonus gesture that nothing on screen explains. The
 * draw is already made; this only shows it early.
 */
export function CardStack({ cards, width, onReveal, tone }: CardStackProps) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const update = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    update({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    update({ ...current, dx: event.clientX - current.startX, dy: event.clientY - current.startY });
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    update(null);
    if (stackRelease(current.dx, current.dy) === "reveal") onReveal();
  };

  const onPointerCancel = () => update(null);

  const dx = drag?.dx ?? 0;
  const dy = drag?.dy ?? 0;
  const peek = peekAmount(dx, dy);
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;

  return (
    <button
      type="button"
      className={drag === null ? styles.stack : `${styles.stack} ${styles.dragging}`}
      style={{ width, height: (width * 420) / 300 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onReveal();
      }}
      aria-label="Révéler la première carte"
    >
      {cards.map((card, index) => {
        const offset = index * FAN_STEP * peek;
        const settle = cards.length - 1 - index;
        const style = {
          zIndex: cards.length - index,
          transform:
            index === 0
              ? `translate(${dx * 0.12}px, ${dy * 0.12}px)`
              : `translate(${ux * offset + settle * 0.5}px, ${uy * offset - settle * 1.5}px) rotate(${index * ux * peek * 2.5}deg)`,
          animationDelay: `${index * 60}ms`,
        } as CSSProperties;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a pack can hold the same card twice
          <span key={index} className={styles.card} style={style}>
            <CardBack
              rarity={card.rarity}
              width={width}
              edge={index === 0 ? 0 : peek}
              tone={tone}
            />
          </span>
        );
      })}
    </button>
  );
}
