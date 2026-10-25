"use client";

import { cssUrl } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { useEngravingInk } from "@/cards/use-engraving-ink";
import styles from "./emblem.module.css";

/**
 * A banner the clan won by its level: the engraving, large and faint, behind its name. The parent
 * is positioned and clips it; nothing shows while the engraving is unknown.
 */
export function Banner({ cardId }: { readonly cardId: string | null }) {
  const ink = useEngravingInk(cardId);
  if (ink === null) return null;
  return (
    <span
      className={styles.banner}
      style={{ "--banner-src": cssUrl(ink) } as CSSProperties}
      aria-hidden="true"
    />
  );
}
