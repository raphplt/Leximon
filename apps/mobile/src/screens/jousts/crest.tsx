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
import Svg, { Defs, LinearGradient, Path, Pattern, Stop } from "react-native-svg";

/**
 * A league's crest, as illuminated arms: its emblem on a diapered field in a border of gold leaf.
 * `dim` darkens a league not reached yet, keeping its colours. As on the web.
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
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const art = leagueCrests[league];
  const colors = crestColors(dim);
  return (
    <Svg width={size} height={size * crestRatio} viewBox={crestViewBox}>
      <Defs>
        {tinctureGradients(id, colors)}
        <Pattern
          id={`${id}diaper`}
          width={art.diaper.size}
          height={art.diaper.size}
          patternUnits="userSpaceOnUse"
        >
          {art.diaper.layers.map((shape, index) => crestShape(shape, index, colors, id, true))}
        </Pattern>
      </Defs>
      {art.layers.map((shape, index) => crestShape(shape, index, colors, id))}
    </Svg>
  );
}

/** One gradient per tincture, named after `id`, for the shapes drawn with these colours. */
export function tinctureGradients(id: string, colors: CrestColors) {
  return tinctureNames.map((name) => (
    <LinearGradient key={name} id={`${id}${name}`} x1="0" y1="0" x2="0.25" y2="1">
      <Stop offset="0" stopColor={colors.tinctures[name].top} />
      <Stop offset="1" stopColor={colors.tinctures[name].bottom} />
    </LinearGradient>
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
    <Path
      key={key}
      d={shape.d}
      fill={paintOf(shape.fill, flat, colors, id)}
      stroke={paintOf(shape.stroke, flat, colors, id)}
      {...(shape.width === undefined ? {} : { strokeWidth: shape.width })}
      {...(shape.opacity === undefined
        ? {}
        : shape.stroke === undefined
          ? { fillOpacity: shape.opacity }
          : { strokeOpacity: shape.opacity })}
      {...(shape.dash === undefined ? {} : { strokeDasharray: shape.dash })}
      {...(shape.cap === undefined ? {} : { strokeLinecap: shape.cap })}
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
