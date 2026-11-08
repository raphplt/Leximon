"use client";

import { useEffect, useState } from "react";

/** Said to every flag of the page when one is marked, so that two buttons lose their badge together. */
const SEEN_EVENT = "leximon:seen";

function readFresh(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === null;
  } catch {
    // Storage refused (private window): no badge rather than one that never goes.
    return false;
  }
}

/**
 * Whether this device has yet to follow something new, and how to mark it followed. Read once
 * mounted, never on the server.
 */
export function useSeenFlag(key: string): readonly [boolean, () => void] {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    setFresh(readFresh(key));
    const onSeen = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === key) setFresh(false);
    };
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => window.removeEventListener(SEEN_EVENT, onSeen);
  }, [key]);
  const seen = () => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Not remembered: the badge is gone for this visit only.
    }
    window.dispatchEvent(new CustomEvent(SEEN_EVENT, { detail: key }));
  };
  return [fresh, seen];
}
