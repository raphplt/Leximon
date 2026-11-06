import { openingTimes } from "./effects";
import {
  easings,
  gainBanner,
  lettering,
  oldGold,
  press,
  room,
  toy,
  toyMatters,
  toyRadii,
} from "./library";
import {
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
  Object.assign(variables, libraryParts());
  return variables;
}

/** The colors, and the shadows made of them. */
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

/** The toys, letters, room and grain of the reading room. */
function libraryParts(): Record<string, string> {
  const variables: Record<string, string> = {
    "--lx-toy-outline": toy.outline,
    "--lx-toy-outline-width": `${toy.outlineWidth}px`,
    "--lx-toy-edge-small": `${toy.edge.small}px`,
    "--lx-toy-edge-large": `${toy.edge.large}px`,
    "--lx-toy-lip-small": `${toy.lip.small}px`,
    "--lx-toy-lip-large": `${toy.lip.large}px`,
    "--lx-toy-sheen": toy.sheen,
    "--lx-toy-inner-rule": toy.innerRule,
    "--lx-toy-drop": toy.drop,
    "--lx-lettering-fill": lettering.fill,
    "--lx-lettering-outline": lettering.outline,
    "--lx-lettering-drop": `${lettering.drop}px`,
    "--lx-lettering-width": `max(${lettering.minOutline}px, ${lettering.outlineRatio}em)`,
    "--lx-lettering-kicker": lettering.kicker,
    "--lx-old-gold": cssFill(oldGold),
    "--lx-room": [
      `radial-gradient(ellipse 90% 80% at 50% 45%, transparent 45%, ${room.vignette} 100%)`,
      `radial-gradient(ellipse 80% 50% at 50% 40%, ${room.lamp}, transparent 70%)`,
      `image-set(url("/room/shelves.webp") 1x, url("/room/shelves@2x.webp") 2x) 50% 0 / ${room.shelves.width}px ${room.shelves.height}px`,
      room.floor,
    ].join(", "),
    "--lx-room-floor": room.floor,
    "--lx-room-lamp": room.lamp,
    "--lx-room-vignette": room.vignette,
    "--lx-desk-center": room.desk.center,
    "--lx-desk-middle": room.desk.middle,
    "--lx-desk-edge": room.desk.edge,
    "--lx-desk-rule": room.desk.rule,
    "--lx-desk-hollow": room.desk.hollow,
    "--lx-gain-center": gainBanner.center,
    "--lx-gain-middle": gainBanner.middle,
    "--lx-gain-edge": gainBanner.edge,
    "--lx-gain-rule": gainBanner.rule,
    "--lx-gain-rule-inset": `${gainBanner.ruleInset}px`,
    "--lx-shelf-top": room.shelf.top,
    "--lx-shelf-bottom": room.shelf.bottom,
    "--lx-shelf-gilt": room.shelf.gilt,
    "--lx-shelf-gilt-shade": room.shelf.giltShade,
    "--lx-matter-paper": 'url("/matter/paper.webp")',
    "--lx-matter-leather": 'url("/matter/leather.webp")',
    "--lx-matter-size": `${matter.size}px`,
  };
  for (const [name, tone] of Object.entries(toyMatters)) {
    variables[`--lx-toy-${name}-top`] = tone.top;
    variables[`--lx-toy-${name}-bottom`] = tone.bottom;
    variables[`--lx-toy-${name}-edge`] = tone.edge;
  }
  for (const [name, curve] of Object.entries(easings)) {
    variables[`--lx-ease-${name}`] = `cubic-bezier(${curve.join(", ")})`;
  }
  variables["--lx-press-sink"] = `${press.sinkMs}ms`;
  variables["--lx-open-arrive"] = `${openingTimes.arriveMs}ms`;
  variables["--lx-open-charge"] = `${openingTimes.chargeMs}ms`;
  variables["--lx-open-burst"] = `${openingTimes.burstMs}ms`;
  for (const [name, value] of Object.entries(toyRadii)) {
    variables[`--lx-toy-radius-${name}`] = `${value}px`;
  }
  return variables;
}

function rule(selector: string, variables: Record<string, string>, scheme: string): string {
  const declarations = Object.entries(variables).map(([name, value]) => `${name}:${value}`);
  return `${selector}{color-scheme:${scheme};${declarations.join(";")}}`;
}

/** The rule declaring the tokens. */
export function cssRootRule(): string {
  return rule(":root", cssVariables(), "dark");
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
