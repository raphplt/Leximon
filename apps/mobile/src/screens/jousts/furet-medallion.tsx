import {
  type CrestLayer,
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
import Svg, { Circle, ClipPath, Defs, Image, Text } from "react-native-svg";
import { fonts } from "@/theme";
import { crestShape, tinctureGradients } from "./crest";

const ENGRAVING = require("../../../assets/images/maitre-furet.webp");

/**
 * Maître Furet's portrait: an engraving of a ferret by De Sève (1756) in a ring of gold leaf, with
 * a toque, and the ribbon that names him when there is room to read it. As on the web.
 */
export function FuretMedallion({
  size,
  ribbon = size >= 64,
}: {
  readonly size: number;
  readonly ribbon?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const colors = crestColors(false);
  const kind = ribbon ? "full" : "bare";
  const { cx, cy, r } = furetPortrait;
  const shape = (layers: readonly CrestLayer[]) =>
    layers.map((layer, index) => crestShape(layer, index, colors, id));
  const motto = (fill: string, dy: number) => (
    <Text
      x={furetMotto.x}
      y={furetMotto.y + dy}
      fontSize={furetMotto.size}
      textAnchor="middle"
      fill={fill}
      fontFamily={fonts.displayBold}
    >
      {FURET_TITLE}
    </Text>
  );
  return (
    <Svg width={size} height={size * furetRatio[kind]} viewBox={furetViewBox[kind]}>
      <Defs>
        {tinctureGradients(id, colors)}
        <ClipPath id={`${id}portrait`}>
          <Circle cx={cx} cy={cy} r={r} />
        </ClipPath>
      </Defs>
      {shape(furetBack)}
      <Image
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
    </Svg>
  );
}
