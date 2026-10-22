"use client";

import type { CSSProperties } from "react";
import { catalogFileUrl } from "@/cards/catalog";
import { cssUrl } from "@/cards/engraving";
import { useCatalog } from "@/cards/use-catalog";
import styles from "./emblem.module.css";

/**
 * A banner the clan won by its level: the engraving, large and faint, behind its name. The parent
 * is positioned and clips it; nothing shows while the catalogue loads.
 */
export function Banner({ cardId }: { readonly cardId: string | null }) {
  const catalog = useCatalog();
  const engraving = cardId === null ? null : (catalog?.cardsById.get(cardId)?.engraving ?? null);
  if (engraving === null) return null;
  return (
    <span
      className={styles.banner}
      style={{ "--banner-src": cssUrl(catalogFileUrl(engraving.ink)) } as CSSProperties}
      aria-hidden="true"
    />
  );
}
