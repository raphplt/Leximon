"use client";

import type { EmblemView } from "@leximon/contract";
import { cssUrl, emblemColor } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { useEngravingInk } from "@/cards/use-engraving-ink";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import styles from "./emblem.module.css";

/**
 * A clan's emblem: a shield of the first colour, the engraving inked in the second, a gold
 * rim, and the clan's level on a medal when given. Decorative: the clan's name is always next to it.
 */
export function Emblem({
  emblem,
  size,
  level,
}: {
  readonly emblem: EmblemView;
  readonly size: number;
  readonly level?: number;
}) {
  const ink = useEngravingInk(emblem.engraving);
  const style = {
    "--size": `${size}px`,
    "--field": emblemColor(emblem.colors[0]),
    "--ink": emblemColor(emblem.colors[1]),
    ...(ink === null ? {} : { "--ink-src": cssUrl(ink) }),
  } as CSSProperties;
  return (
    <span className={styles.emblem} style={style} aria-hidden="true">
      {ink === null ? (
        <Icon name="clan" size={Math.round(size * 0.5)} />
      ) : (
        <span className={styles.ink} />
      )}
      {level !== undefined && (
        <span className={styles.medal}>
          <LevelMedal level={level} size={Math.max(24, Math.round(size * 0.5))} />
        </span>
      )}
    </span>
  );
}
