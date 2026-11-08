import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

/** Told when a flag is marked, so that two buttons lose their badge together. */
const listeners = new Set<(key: string) => void>();

/** Storage can fail: then no badge, rather than one that never goes. */
function readFresh(key: string): boolean {
  try {
    return SecureStore.getItem(key) === null;
  } catch {
    return false;
  }
}

/** Whether this device has yet to follow something new, and how to mark it followed. */
export function useSeenFlag(key: string): readonly [boolean, () => void] {
  const [fresh, setFresh] = useState(() => readFresh(key));
  useEffect(() => {
    const onSeen = (seenKey: string) => {
      if (seenKey === key) setFresh(false);
    };
    listeners.add(onSeen);
    return () => {
      listeners.delete(onSeen);
    };
  }, [key]);
  const seen = () => {
    SecureStore.setItemAsync(key, "1").catch(() => {
      // Not remembered: the badge comes back next time.
    });
    for (const listener of listeners) listener(key);
  };
  return [fresh, seen];
}
