"use client";

import type { StockView } from "@leximon/view-model";
import { type CSSProperties, useState } from "react";
import styles from "./play.module.css";

/**
 * The free stock as a row of dots, one per sachet it holds: full ones lit, the next one filling
 * as it comes, with when it comes. The count stays at hand, quietly.
 */
export function StockDots({ stock }: { readonly stock: StockView }) {
  return (
    <span className={styles.stockDots} role="img" aria-label={stock.description}>
      <span className={styles.dots}>
        {Array.from({ length: stock.capacity }, (_, slot) => {
          const share = slot < stock.stored ? 1 : slot === stock.stored ? (stock.refill ?? 0) : 0;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a slot of the stock is its place.
              key={slot}
              className={share === 1 ? styles.dotFull : styles.dotSlot}
              style={{ "--share": `${Math.round(share * 360)}deg` } as CSSProperties}
            />
          );
        })}
      </span>
      <span className={styles.stockNote}>{stock.note}</span>
    </span>
  );
}

/** Kept on the device: the hint closed, and how many sachets were opened since it showed. */
const HINT_KEY = "leximon.tearHint";
/** After this many sachets, the player knows the gesture. */
const HINT_OPENS = 3;

function readHint(): number {
  try {
    const value = window.localStorage.getItem(HINT_KEY);
    return value === null ? 0 : Number(value) || 0;
  } catch {
    return 0;
  }
}

function writeHint(value: number): void {
  try {
    window.localStorage.setItem(HINT_KEY, String(value));
  } catch {
    // Shown again on the next visit; nothing else depends on it.
  }
}

/** Counts a sachet opened, so that the hint goes once the gesture is known. */
export function noteSachetOpened(): void {
  writeHint(readHint() + 1);
}

/** How to open the sachet, beside it, until the player closes it or has opened a few. */
export function TearHint({ text }: { readonly text: string }) {
  // Read at once: drawn only in the browser, with the sachet, it must not push it a moment later.
  const [shown, setShown] = useState(() => readHint() < HINT_OPENS);
  if (!shown) return null;
  return (
    <p className={styles.tearHint}>
      {text}
      <button
        type="button"
        className={styles.tearHintClose}
        aria-label="Fermer l'astuce"
        onClick={() => {
          writeHint(HINT_OPENS);
          setShown(false);
        }}
      >
        ×
      </button>
    </p>
  );
}
