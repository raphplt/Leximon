"use client";

import { useEffect, useState } from "react";
import styles from "./play.module.css";

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
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(readHint() < HINT_OPENS), []);
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
