"use client";

import { useEffect } from "react";

/**
 * While `active`, the phone tabs leave the screen: a sachet being opened or a challenge under way
 * keeps the whole height, its buttons within reach without scrolling.
 */
export function useHideTabs(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.noTabs = "";
    return () => {
      delete root.dataset.noTabs;
    };
  }, [active]);
}
