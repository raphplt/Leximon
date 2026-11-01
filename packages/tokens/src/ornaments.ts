/**
 * The ornaments of Le Livre that we draw ourselves: a binder's tools, the corner of a frame and
 * the shading of the icons. Path data only, so that the web (`<svg>`) and mobile
 * (react-native-svg) draw the same geometry.
 */

import type { IconName } from "./icons";
import { lettrines, type PlateName } from "./ornament-plates";
import type { Palette } from "./tokens";

/**
 * The ornate capital that opens `text`, if there is one. Old type had no J or U of their own: they
 * take the I and the V, as they did in the books these letters come from.
 */
export function lettrineFor(text: string): PlateName | null {
  const first = text.normalize("NFD").charAt(0).toUpperCase();
  const letter = first === "J" ? "I" : first === "U" ? "V" : first;
  return letter in lettrines ? lettrines[letter as keyof typeof lettrines] : null;
}

export const toolGrid = 24;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function polar(radius: number, angle: number): string {
  return `${round(12 + radius * Math.cos(angle))} ${round(12 + radius * Math.sin(angle))}`;
}

const dot = (radius: number) =>
  `M${12 - radius} 12 A${radius} ${radius} 0 1 1 ${12 + radius} 12 A${radius} ${radius} 0 1 1 ${12 - radius} 12Z`;

/** Leaves around the centre, each a lens from `from` to `to`, `belly` wide in radians. */
function leaves(count: number, from: number, to: number, belly: number): string {
  const middle = (from + to) / 2;
  const parts: string[] = [];
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
    const base = polar(from, angle);
    parts.push(
      `M${base} Q${polar(middle, angle + belly)} ${polar(to, angle)} Q${polar(middle, angle - belly)} ${base}Z`,
    );
  }
  return parts.join(" ");
}

function star(points: number, outer: number, inner: number): string {
  const corners: string[] = [];
  for (let index = 0; index < points * 2; index++) {
    const angle = (index / (points * 2)) * 2 * Math.PI - Math.PI / 2;
    corners.push(polar(index % 2 === 0 ? outer : inner, angle));
  }
  return `M${corners.join(" L")}Z`;
}

/** Filled shapes on a 24 px grid, with the even-odd rule: the small tools of the binder. */
export const tools = {
  rosette: `${leaves(8, 3.6, 11.5, 0.42)} ${dot(2.2)}`,
  losange: "M12 .5 L23.5 12 L12 23.5 L.5 12Z M12 5 L5 12 L12 19 L19 12Z M12 9 L9 12 L12 15 L15 12Z",
  etoile: `${star(8, 11.5, 4.6)} ${dot(1.6)}`,
  lys: [
    "M12 1 C14.6 4.4 15.4 8.2 13 12.6 H11 C8.6 8.2 9.4 4.4 12 1Z",
    "M14 12.6 C14.4 9.6 16.6 6.6 19.4 7 C22.4 7.4 23 11.4 20.6 12.8 C19.4 13.5 18 12.8 18.2 11.4 C17 11.6 16.2 12.2 15.8 12.6Z",
    "M10 12.6 C9.6 9.6 7.4 6.6 4.6 7 C1.6 7.4 1 11.4 3.4 12.8 C4.6 13.5 6 12.8 5.8 11.4 C7 11.6 7.8 12.2 8.2 12.6Z",
    "M7.4 13.8 H16.6 V15.4 H7.4Z",
    "M12 16 C12.6 18.2 14 19.8 16.2 20.2 C15 22.2 13 22 12 20.4 C11 22 9 22.2 7.8 20.2 C10 19.8 11.4 18.2 12 16Z",
  ].join(" "),
} as const;

export type ToolName = keyof typeof tools;

/**
 * One corner of a frame, top left in a square of `frameCell`: two rules that step in around a
 * small tool, as on a binding. The edges carry the same two rules straight on.
 */
export const frameCell = 28;

export const frameRules = {
  outer: { at: 3, width: 1.4 },
  inner: { at: 7, width: 0.7 },
} as const;

const TOOL_SCALE = 0.4;

export const frameCorner = {
  outer: "M28 3 H12 V12 H3 V28",
  inner: "M28 7 H16 V16 H7 V28",
  tool: { path: tools.rosette, scale: TOOL_SCALE, at: 1.2 },
} as const;

/**
 * A frame as an SVG for CSS `border-image`, which cannot follow `currentColor`: one per color. Its
 * nine squares are the four corners, the four edges and an empty centre.
 */
function frameImage(color: string): string {
  const size = frameCell * 3;
  const corner = [
    `<path d="${frameCorner.outer}" stroke-width="${frameRules.outer.width}"/>`,
    `<path d="${frameCorner.inner}" stroke-width="${frameRules.inner.width}"/>`,
    `<path d="${tools.rosette}" fill="${color}" fill-rule="evenodd" stroke="none" transform="translate(${frameCorner.tool.at} ${frameCorner.tool.at}) scale(${TOOL_SCALE})"/>`,
  ].join("");
  const edge = (at: number, width: number) =>
    `<path d="M${frameCell} ${at} H${size - frameCell} M${frameCell} ${size - at} H${size - frameCell} M${at} ${frameCell} V${size - frameCell} M${size - at} ${frameCell} V${size - frameCell}" stroke-width="${width}"/>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="none" stroke="${color}">`,
    `<g>${corner}</g>`,
    `<g transform="matrix(-1 0 0 1 ${size} 0)">${corner}</g>`,
    `<g transform="matrix(1 0 0 -1 0 ${size})">${corner}</g>`,
    `<g transform="matrix(-1 0 0 -1 ${size} ${size})">${corner}</g>`,
    edge(frameRules.outer.at, frameRules.outer.width),
    edge(frameRules.inner.at, frameRules.inner.width),
    "</svg>",
  ].join("");
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The two frames of a palette: in gilt for what is bound, in ink for what is printed. */
export function framesOf(palette: Palette) {
  return { gilt: frameImage(palette.gilt), ink: frameImage(palette.rule) };
}

/** The strokes of an engraved icon, in units of the icon grid. */
export const engravingStroke = { line: 1.3, shade: 2.1, hatch: 0.65 } as const;

/**
 * What engraves an icon. Its outline stays the one in `icons`, thinner and with square ends; the
 * side away from the light gets a heavier line (`shade`) and fine strokes (`hatch`), which is what
 * makes a drawing read as cut in wood. Controls stay legible: they only get the heavier line.
 */
export const engravings: Readonly<
  Record<IconName, { readonly shade?: string; readonly hatch?: string }>
> = {
  sachet: {
    shade: "M17 6 L18 21 H6",
    hatch:
      "M15.6 8.4 H16.6 M15.2 10.6 H16.7 M15.2 12.8 H16.9 M14.4 15 H17 M13.6 17 H17.2 M9 19 H17.3",
  },
  album: {
    shade: "M20 5 V19 C17 18 14 18.5 12 20",
    hatch:
      "M14.4 8.2 C15.8 7.6 17 7.3 18.2 7.3 M14.4 10.8 C15.8 10.2 17 9.9 18.2 9.9 M14.4 13.4 C15.8 12.8 17 12.5 18.2 12.5 M14.4 16 C15.8 15.4 17 15.1 18.2 15.1",
  },
  defi: {
    shade: "M20 13 A8 8 0 0 1 12 21",
    hatch: "M18 12.4 L12.4 18 M18.5 14.2 L14.2 18.5 M16.6 11.3 L11.3 16.6",
  },
  echange: { shade: "M20 16 H6 L9.5 19.5" },
  clan: {
    shade: "M19 4 V12 C19 16.5 15.5 19.5 12 21",
    hatch: "M17.4 13 L13 17.4 M17 15 L14.4 17.6 M17.4 10.8 L11.8 16.4",
  },
  courrier: {
    shade: "M20.5 6 V18 H3.5",
    hatch: "M18.8 10.5 L14.6 14.7 M18.8 12.6 L13.4 18 M18.8 14.7 L15.5 18",
  },
  chat: {
    shade: "M20 5 V16 H11 L6.5 20",
    hatch: "M18.4 12.6 H10 M18.4 14.2 H10",
  },
  joutes: { shade: "M20 4 L9.5 14.5 M11.5 16.5 L7.5 20.5" },
  coffret: {
    shade: "M20.5 10 V20 H3.5",
    hatch:
      "M15.5 15.6 L12.3 18.8 M17.7 15.6 L14.5 18.8 M19 16.5 L16.7 18.8 M6 8.4 C6.4 6.8 7.4 5.9 9 5.4 M7.8 8.4 C8.2 7.2 9 6.5 10.2 6.1",
  },
  reglages: {
    shade: "M19 12 A7 7 0 0 1 12 19",
    hatch: "M17.6 11.4 L11.4 17.6 M16 11.2 L11.2 16 M17.4 13.5 L13.5 17.4",
  },
  profil: {
    shade: "M16 8.5 A4 4 0 0 1 12 12.5 M16 14.8 C18.4 16 19.8 18 20 21",
    hatch:
      "M14.8 8.6 L12.6 10.8 M14.4 7.2 L11.4 10.2 M16.6 16.6 L13.2 20 M17.8 18 L15.8 20 M15 15.6 L10.6 20",
  },
  star: {
    shade: "M20.6 9.3 L16.1 13.4 L17.4 19.4 L12 16.4",
    hatch: "M15.2 11.2 L12.4 14 M14.6 13.6 L13.6 14.6 M15.4 14.6 L14.5 15.5 M13.2 10.6 L11.4 12.4",
  },
  lock: {
    shade: "M18.5 11 V20.5 H5.5",
    hatch: "M17 13 L14.4 15.6 M17 15 L12.6 19.4 M17 17 L14.6 19.4 M15 13 L13.6 14.4",
  },
  check: { shade: "M10 17.5 L19 7" },
  close: { shade: "M6 6 L18 18" },
  back: { shade: "M8 12 L15 19" },
  chev: { shade: "M16 12 L9 19" },
  chevd: { shade: "M12 15 L18 9" },
  search: {
    shade: "M16.5 10.5 A6 6 0 0 1 10.5 16.5 M15 15 L20 20",
    hatch: "M15 9.8 L9.8 15 M14.3 8 L8 14.3",
  },
  plus: { shade: "M12 5 V19" },
  pin: {
    shade: "M14 9.5 L17.5 13.5 H6.5 M14 3.5 V9.5",
    hatch: "M15.5 12 L14.4 11 M13.3 12.8 L12 11.5",
  },
  plume: {
    shade: "M5.5 17 C11 17 16 13 20 4",
    hatch: "M11 14 L9.8 12.6 M13 12.4 L11.8 10.9 M14.9 10.5 L13.7 9 M16.5 8.5 L15.2 7.1",
  },
  bolt: {
    shade: "M19 10.5 H12.5 M11.5 13.5 L10.5 21.5 L19 10.5",
    hatch: "M14.3 11.8 L12.6 14 M15.6 11.8 L12.7 15.6",
  },
  carte: {
    shade: "M19 5 V19 C19 20 18 21 17 21 H7",
    hatch: "M17.4 13.5 L12.6 19.4 M17.4 15.8 L14.4 19.4 M17.4 17.8 L16.2 19.4",
  },
  logout: { shade: "M19 4 V20 H14" },
  share: {
    shade: "M19 12 V20 H5",
    hatch: "M17.6 14.4 L13.6 18.6 M17.6 16.4 L15.6 18.6",
  },
  clock: {
    shade: "M21 12 A9 9 0 0 1 12 21",
    hatch: "M19.4 13.4 L13.4 19.4 M19.9 11.4 L17.5 13.8 M18.3 16 L16 18.3",
  },
  encre: {
    shade: "M17 10 L18.5 20.5 H5.5",
    hatch: "M16.4 12.4 L10.2 18.8 M16.8 14.6 L12.4 19.2 M17 17 L14.8 19.2 M14.2 12.4 L8.2 18.8",
  },
  palette: {
    shade: "M21 11 C21 14 18.5 15 16.5 14.5 M14.5 17.5 C15.5 19.5 14 21 12 21",
    hatch: "M12.6 18.4 L9.8 19.4 M12.4 16.6 L7.6 18.2",
  },
  flag: {
    shade: "M5 21 V4",
    hatch: "M7 6.2 L9 8.2 M7 8.4 L9.4 10.8 M9.2 6.2 L11.6 8.6 M11.4 6.2 L12.8 7.6",
  },
  cle: {
    shade: "M12.5 16 A4.5 4.5 0 0 1 8 20.5 M11.2 12.8 L20 4",
    hatch: "M11.2 15 L7 19.2 M11 13.4 L5.6 18.8",
  },
  sound: { shade: "M13 5 V19 L8 14.5 M19 6.5 C21.5 9.5 21.5 14.5 19 17.5" },
  soundOff: { shade: "M13 5 V19 L8 14.5 M16.5 9.5 L21 14.5" },
  play: { shade: "M19 12 L8 19", hatch: "M15.4 13.1 L12 15.2 M13.3 12.6 L9.8 14.8" },
  send: { shade: "M20 4 L15 20 L11.5 13", hatch: "M17.4 9.4 L13.7 13 M16.7 12 L14.4 14.4" },
  dots: {},
  crown: {
    shade: "M4 18 H20 M21 7.5 L20 18",
    hatch: "M18.6 11.6 L14.4 15.8 M18.4 13.8 L16.2 16 M16.2 11 L12.8 14.6",
  },
  block: { shade: "M20.5 12 A8.5 8.5 0 0 1 12 20.5 M6 6 L18 18" },
  amis: {
    shade:
      "M12.5 8.5 A3.5 3.5 0 0 1 9 12 M12.5 14.8 C14.4 16 15.3 17.8 15.5 20 M17 14.3 C19.5 15 21 17 21.5 20",
    hatch: "M12 16.4 L8.4 20 M13.6 17 L10.6 20 M14.4 18.4 L12.8 20",
  },
};
