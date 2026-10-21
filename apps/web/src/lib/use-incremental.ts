"use client";

import { useEffect, useState } from "react";

/** How far below the window the next batch starts loading, so the scroll never hits a wall. */
const AHEAD = "1200px";

/**
 * Shows a long list batch by batch: `step` items first, then `step` more each time the sentinel
 * nears the window. A new `resetKey` (another filter, another search) starts over from the top.
 */
export function useIncremental(
  total: number,
  step: number,
  resetKey: string,
): { readonly shown: number; readonly sentinel: (element: HTMLElement | null) => void } {
  const [batch, setBatch] = useState({ key: resetKey, count: step });
  const [element, sentinel] = useState<HTMLElement | null>(null);
  const count = batch.key === resetKey ? batch.count : step;
  if (batch.key !== resetKey) setBatch({ key: resetKey, count: step });
  const shown = Math.min(count, total);

  // A fresh observer per batch: it reports at once if the sentinel is still in view after a
  // batch too short to fill a tall window, where a kept one would wait for a scroll.
  useEffect(() => {
    if (element === null || shown >= total) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setBatch((b) => (b.key === resetKey ? { key: b.key, count: shown + step } : b));
        }
      },
      { rootMargin: `0px 0px ${AHEAD} 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, shown, total, step, resetKey]);

  return { shown, sentinel };
}
