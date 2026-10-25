import type { Fill } from "@leximon/tokens";
import { LinearGradient, Stop } from "react-native-svg";

/**
 * A token fill in react-native-svg: a colour as it is, a gradient as a `<LinearGradient>` to put
 * in `<Defs>` and paint with `paintOf`. The angle follows CSS: 0 points up, 90 right.
 */
export function FillGradient({ id, fill }: { readonly id: string; readonly fill: Fill }) {
  if (typeof fill === "string") return null;
  const radians = (fill.angle * Math.PI) / 180;
  const dx = Math.sin(radians) / 2;
  const dy = -Math.cos(radians) / 2;
  return (
    <LinearGradient id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
      {fill.stops.map(([color, offset]) => (
        <Stop key={offset} offset={offset} stopColor={color} />
      ))}
    </LinearGradient>
  );
}

export function paintOf(id: string, fill: Fill): string {
  return typeof fill === "string" ? fill : `url(#${id})`;
}
