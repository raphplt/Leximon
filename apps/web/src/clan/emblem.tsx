"use client";

import type { EmblemView } from "@leximon/contract";
import { emblemColor } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { catalogFileUrl } from "@/cards/catalog";
import { cssUrl } from "@/cards/engraving";
import { useCatalog } from "@/cards/use-catalog";
import { Icon } from "@/ui/icon";
import styles from "./emblem.module.css";

/**
 * A clan's emblem: a shield of the first colour, the engraving inked in the second, a gold
 * rim. Decorative: the clan's name is always next to it.
 */
export function Emblem({ emblem, size }: { readonly emblem: EmblemView; readonly size: number }) {
  const catalog = useCatalog();
  const engraving = catalog?.cardsById.get(emblem.engraving)?.engraving ?? null;
  const style = {
    "--size": `${size}px`,
    "--field": emblemColor(emblem.colors[0]),
    "--ink": emblemColor(emblem.colors[1]),
    ...(engraving === null ? {} : { "--ink-src": cssUrl(catalogFileUrl(engraving.ink)) }),
  } as CSSProperties;
  return (
    <span className={styles.emblem} style={style} aria-hidden="true">
      {engraving === null ? (
        <Icon name="clan" size={Math.round(size * 0.5)} />
      ) : (
        <span className={styles.ink} />
      )}
    </span>
  );
}
