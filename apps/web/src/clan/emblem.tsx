"use client";

import type { EmblemView } from "@leximon/contract";
import {
  cssUrl,
  emblemColor,
  emblemField,
  emblemShield,
  emblemShieldPad,
  frameSheen,
  oldGold,
  toy,
  toyMatters,
} from "@leximon/tokens";
import { type CSSProperties, useId } from "react";
import { useEngravingInk } from "@/cards/use-engraving-ink";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import styles from "./emblem.module.css";

/**
 * A clan's emblem: a shield of the first colour, the engraving inked in the second, a rim of old
 * gold outlined in ink, and the clan's level on a medal when given. Decorative: the clan's name is always next to it.
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
    "--ink": emblemColor(emblem.colors[1]),
    ...(ink === null ? {} : { "--ink-src": cssUrl(ink) }),
  } as CSSProperties;
  return (
    <span className={styles.emblem} style={style} aria-hidden="true">
      <Shield field={emblem.colors[0]} size={size} />
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

/** The shield, drawn past the emblem's box by half its rim. */
function Shield({ field, size }: { readonly field: string; readonly size: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { path, width, height, rim, outline, depth, sheen } = emblemShield;
  const pad = emblemShieldPad;
  const k = size / width;
  const lit = emblemField(field);
  return (
    <svg
      className={styles.shield}
      width={(width + 2 * pad) * k}
      height={(height + 2 * pad + depth) * k}
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad + depth}`}
      style={{ left: -pad * k, top: -pad * k }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}field`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lit.top} />
          <stop offset="1" stopColor={lit.bottom} />
        </linearGradient>
        <linearGradient id={`${id}gold`} x1="0" y1="0" x2="0.5" y2="1">
          {oldGold.stops.map(([color, offset]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <path
        d={path}
        transform={`translate(0 ${depth})`}
        fill={toyMatters.gold.edge}
        stroke={toy.outline}
        strokeWidth={rim + 2 * outline}
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill={`url(#${id}field)`}
        stroke={toy.outline}
        strokeWidth={rim + 2 * outline}
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={`url(#${id}gold)`}
        strokeWidth={rim}
        strokeLinejoin="round"
      />
      <path
        d={sheen}
        stroke={frameSheen.color}
        strokeOpacity={frameSheen.opacity}
        strokeWidth={rim * 0.3}
        strokeLinecap="round"
      />
    </svg>
  );
}
