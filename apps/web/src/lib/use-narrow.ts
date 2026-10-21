"use client";

import { useSyncExternalStore } from "react";

/** Below this width the web takes the phone shell (C-08). Same value as the CSS media queries. */
const NARROW = "(max-width: 759px)";

function subscribe(listener: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** `true` on a phone-sized window; `false` on the server. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
