import { colors, type Fill, radii } from "./tokens";

/** CSS value of a fill: the color itself, or a `linear-gradient()`. */
export function cssFill(fill: Fill): string {
  if (typeof fill === "string") return fill;
  const stops = fill.stops.map(([color, position]) => `${color} ${round(position * 100)}%`);
  return `linear-gradient(${fill.angle}deg, ${stops.join(", ")})`;
}

/** Solid color usable where a gradient is not, such as a text color: its first stop. */
export function solidColor(fill: Fill): string {
  if (typeof fill === "string") return fill;
  const first = fill.stops[0];
  if (first === undefined) throw new Error("A gradient needs at least one stop");
  return first[0];
}

/**
 * Global tokens as CSS custom properties, e.g. `--lx-color-text`, `--lx-radius-card`.
 * Rarity styles are not included: a card sets its own variables from `rarityStyles`.
 */
export function cssVariables(): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [name, value] of Object.entries(colors)) {
    variables[`--lx-color-${kebab(name)}`] = value;
  }
  for (const [name, value] of Object.entries(radii)) {
    variables[`--lx-radius-${kebab(name)}`] = `${value}px`;
  }
  return variables;
}

/** `:root { … }` rule declaring `cssVariables()`. */
export function cssRootRule(): string {
  const declarations = Object.entries(cssVariables()).map(([name, value]) => `${name}:${value}`);
  return `:root{${declarations.join(";")}}`;
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
