"use client";

import { useEffect, useState } from "react";

/** Current time, refreshed every `intervalMs`. 0 until mounted: the clock is read in the browser only. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
