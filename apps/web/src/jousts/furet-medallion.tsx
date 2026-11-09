import {
  crestColors,
  furetBack,
  furetFront,
  furetMotto,
  furetPortrait,
  furetRatio,
  furetRibbon,
  furetViewBox,
} from "@leximon/tokens";
import { FURET_TITLE } from "@leximon/view-model";
import { useId } from "react";
import { crestShape, TinctureGradients } from "./crest";

const ENGRAVING = "/jousts/maitre-furet.webp";

/**
 * Maître Furet's portrait: an engraving of a ferret by De Sève (1756) in a ring of gold leaf, with
 * a toque, and the ribbon that names him when there is room to read it.
 */
export function FuretMedallion({
  size,
  ribbon = size >= 64,
}: {
  readonly size: number;
  readonly ribbon?: boolean;
}) {
  const id = useId();
  const colors = crestColors(false);
  const kind = ribbon ? "full" : "bare";
  const { cx, cy, r } = furetPortrait;
  const shape = (layers: typeof furetFront) =>
    layers.map((layer, index) => crestShape(layer, index, colors, id));
  const motto = (fill: string, dy: number) => (
    <text
      x={furetMotto.x}
      y={furetMotto.y + dy}
      fontSize={furetMotto.size}
      textAnchor="middle"
      fill={fill}
      style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 800 }}
    >
      {FURET_TITLE}
    </text>
  );
  return (
    <svg
      width={size}
      height={size * furetRatio[kind]}
      viewBox={furetViewBox[kind]}
      aria-hidden="true"
    >
      <defs>
        <TinctureGradients id={id} colors={colors} />
        <clipPath id={`${id}portrait`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      {shape(furetBack)}
      <image
        href={ENGRAVING}
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
        clipPath={`url(#${id}portrait)`}
        preserveAspectRatio="xMidYMid slice"
      />
      {shape(furetFront)}
      {ribbon && (
        <>
          {shape(furetRibbon)}
          {motto(colors.ink, 0.9)}
          {motto(colors.tinctures.or.top, 0)}
        </>
      )}
    </svg>
  );
}
