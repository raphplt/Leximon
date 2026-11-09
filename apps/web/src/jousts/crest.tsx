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
  const paint = (value: CrestPaint | undefined, flat: boolean) => paintOf(value, flat, colors, id);
  const layer = (shape: CrestLayer, index: number, flat: boolean) => (
    <path
      key={index}
      d={shape.d}
      fill={paint(shape.fill, flat)}
      stroke={paint(shape.stroke, flat)}
      strokeWidth={shape.width}
      strokeOpacity={shape.stroke === undefined ? undefined : shape.opacity}
      fillOpacity={shape.fill === undefined ? undefined : shape.opacity}
      strokeDasharray={shape.dash}
      strokeLinecap={shape.cap}
      strokeLinejoin="round"
    />
  );
  return (
    <svg width={size} height={size * crestRatio} viewBox={crestViewBox} aria-hidden="true">
      <defs>
        {tinctureNames.map((name) => (
          <linearGradient key={name} id={`${id}${name}`} x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" stopColor={colors.tinctures[name].top} />
            <stop offset="1" stopColor={colors.tinctures[name].bottom} />
          </linearGradient>
        ))}
        <pattern
          id={`${id}diaper`}
          width={art.diaper.size}
          height={art.diaper.size}
          patternUnits="userSpaceOnUse"
        >
          {art.diaper.layers.map((shape, index) => layer(shape, index, true))}
        </pattern>
      </defs>
      {art.layers.map((shape, index) => layer(shape, index, false))}
    </svg>
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
