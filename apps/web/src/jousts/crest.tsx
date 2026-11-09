import type { LeagueId } from "@leximon/contract";
import {
  type CrestColors,
  type CrestLayer,
  type CrestPaint,
  crestColors,
  crestRatio,
  crestViewBox,
  leagueCrests,
  tinctureNames,
} from "@leximon/tokens";
import { useId } from "react";

/**
 * A league's crest, as illuminated arms: its emblem on a diapered field in a border of gold leaf.
 * `dim` darkens a league not reached yet, keeping its colours.
 */
export function Crest({
  league,
  size,
  dim = false,
}: {
  readonly league: LeagueId;
  readonly size: number;
  readonly dim?: boolean;
}) {
  const id = useId();
  const art = leagueCrests[league];
  const colors = crestColors(dim);
  return (
    <svg width={size} height={size * crestRatio} viewBox={crestViewBox} aria-hidden="true">
      <defs>
        <TinctureGradients id={id} colors={colors} />
        <pattern
          id={`${id}diaper`}
          width={art.diaper.size}
          height={art.diaper.size}
          patternUnits="userSpaceOnUse"
        >
          {art.diaper.layers.map((shape, index) => crestShape(shape, index, colors, id, true))}
        </pattern>
      </defs>
      {art.layers.map((shape, index) => crestShape(shape, index, colors, id))}
    </svg>
  );
}

/** One gradient per tincture, named after `id`, for the shapes drawn with these colours. */
export function TinctureGradients({
  id,
  colors,
}: {
  readonly id: string;
  readonly colors: CrestColors;
}) {
  return tinctureNames.map((name) => (
    <linearGradient key={name} id={`${id}${name}`} x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stopColor={colors.tinctures[name].top} />
      <stop offset="1" stopColor={colors.tinctures[name].bottom} />
    </linearGradient>
  ));
}

/** One layer of an illuminated drawing. `flat` paints a tincture plain, inside a pattern. */
export function crestShape(
  shape: CrestLayer,
  key: number,
  colors: CrestColors,
  id: string,
  flat = false,
) {
  return (
    <path
      key={key}
      d={shape.d}
      fill={paintOf(shape.fill, flat, colors, id)}
      stroke={paintOf(shape.stroke, flat, colors, id)}
      strokeWidth={shape.width}
      strokeOpacity={shape.stroke === undefined ? undefined : shape.opacity}
      fillOpacity={shape.fill === undefined ? undefined : shape.opacity}
      strokeDasharray={shape.dash}
      strokeLinecap={shape.cap}
      strokeLinejoin="round"
    />
  );
}

function paintOf(
  value: CrestPaint | undefined,
  flat: boolean,
  colors: CrestColors,
  id: string,
): string {
  if (value === undefined) return "none";
  if (value === "ink") return colors.ink;
  if (value === "sheen") return colors.sheen;
  if (value === "diaper") return `url(#${id}diaper)`;
  return flat ? colors.tinctures[value].top : `url(#${id}${value})`;
}
