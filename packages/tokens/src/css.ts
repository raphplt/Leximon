import { livreDay, livreNight } from "./livre";
import { framesOf } from "./ornaments";
import {
  bookRadii,
  bookShadowsOf,
  colors,
  type Fill,
  fontSizes,
  masteryColors,
  matter,
  type Palette,
  radii,
  shadowsOf,
  space,
} from "./tokens";

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
  Object.assign(variables, paletteVariables(colors));
  for (const [name, value] of Object.entries(masteryColors)) {
    variables[`--lx-mastery-${kebab(name)}`] = value;
  }
  for (const [name, value] of Object.entries(radii)) {
    variables[`--lx-radius-${kebab(name)}`] = `${value}px`;
  }
  for (const [name, value] of Object.entries(fontSizes)) {
    variables[`--lx-size-${kebab(name)}`] = `${value}px`;
  }
  for (const [name, value] of Object.entries(space)) {
    variables[`--lx-${name}`] = `${value}px`;
  }
  return variables;
}

/** What changes from one look or theme to another: its colors and the shadows made of them. */
function paletteVariables(palette: Palette): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [name, value] of Object.entries(palette)) {
    variables[`--lx-color-${kebab(name)}`] = value;
  }
  for (const [name, value] of Object.entries(shadowsOf(palette))) {
    variables[`--lx-shadow-${kebab(name)}`] = value;
  }
  return variables;
}

/** What a theme of Le Livre declares over the current look. */
function bookThemeVariables(palette: Palette): Record<string, string> {
  const variables = paletteVariables(palette);
  for (const [name, value] of Object.entries(bookShadowsOf(palette))) {
    variables[`--lx-shadow-${kebab(name)}`] = value;
  }
  for (const [name, value] of Object.entries(framesOf(palette))) {
    variables[`--lx-frame-${name}`] = value;
  }
  return variables;
}

function bookVariables(): Record<string, string> {
  const variables: Record<string, string> = {
    "--lx-matter-paper": 'url("/matter/paper.webp")',
    "--lx-matter-garde": 'url("/matter/garde.webp")',
    "--lx-matter-carnet": 'url("/matter/carnet.webp")',
    "--lx-matter-leather": 'url("/matter/leather.webp")',
    "--lx-matter-size": `${matter.size}px`,
  };
  for (const [name, value] of Object.entries(bookRadii)) {
    variables[`--lx-radius-${kebab(name)}`] = `${value}px`;
  }
  return variables;
}

/** All of a theme of Le Livre, for the one page that shows both side by side. */
export function bookTheme(theme: "light" | "dark"): Record<string, string> {
  return { ...bookThemeVariables(theme === "dark" ? livreNight : livreDay), ...bookVariables() };
}

function rule(selector: string, variables: Record<string, string>, scheme: string): string {
  const declarations = Object.entries(variables).map(([name, value]) => `${name}:${value}`);
  return `${selector}{color-scheme:${scheme};${declarations.join(";")}}`;
}

/**
 * The rules declaring the tokens: the current look, then « Le Livre » in its two themes, which the
 * script of the page turns on with `data-look` and `data-theme`.
 */
export function cssRootRule(): string {
  return [
    rule(":root", cssVariables(), "dark"),
    rule(':root[data-look="livre"]', bookTheme("light"), "light"),
    rule(':root[data-look="livre"][data-theme="dark"]', bookThemeVariables(livreNight), "dark"),
  ].join("");
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A CSS `url()` that a quote, backslash or line break in the path cannot break out of. */
export function cssUrl(url: string): string {
  return `url("${url.replace(/[\\"\n\r]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}")`;
}
