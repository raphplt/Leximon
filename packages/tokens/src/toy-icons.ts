import type { ToyMatterName } from "./library";

/**
 * The filled icons of « La Bibliothèque »'s toys, on a 48 px grid: up to three fills, a dark
 * outline and a touch of light. Plain SVG paths, which the web and react-native-svg both draw.
 * Each icon has its own inks by default; a toy may give it others, as a closed tile turns grey.
 */

export const toyIconGrid = 48;
export const toyIconOutline = 2.6;

/** What paints a shape: one of the three fills, the outline's dark, or a light over the rest. */
export type ToyInk = "f1" | "f2" | "f3" | "outline" | "gloss" | "sheen";

export interface ToyShape {
  readonly d: string;
  readonly fill?: ToyInk;
  /** Outlined shapes take the outline's width unless they say otherwise. */
  readonly stroke?: ToyInk;
  readonly strokeWidth?: number;
  readonly dash?: string;
  /** Degrees, then the center of the turn. */
  readonly rotate?: readonly [number, number, number];
}

export interface ToyInks {
  readonly f1: string;
  readonly f2: string;
  readonly f3: string;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}

function rect(x: number, y: number, width: number, height: number, r = 0): string {
  if (r === 0) return `M${x} ${y}h${width}v${height}h${-width}Z`;
  const w = width - 2 * r;
  const h = height - 2 * r;
  return `M${x + r} ${y}h${w}a${r} ${r} 0 0 1 ${r} ${r}v${h}a${r} ${r} 0 0 1 ${-r} ${r}h${-w}a${r} ${r} 0 0 1 ${-r} ${-r}v${-h}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}

function gear(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const points: string[] = [];
  for (let index = 0; index < teeth * 4; index++) {
    const angle = (index / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
    const radius = index % 4 < 2 ? outer : inner;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

const outlined = (d: string, fill?: ToyInk, extra: Partial<ToyShape> = {}): ToyShape =>
  fill === undefined
    ? { d, stroke: "outline", ...extra }
    : { d, fill, stroke: "outline", ...extra };
const light = (d: string): ToyShape => ({ d, stroke: "sheen" });

function sword(angle: number): ToyShape[] {
  const rotate = [angle, 24, 24] as const;
  return [
    outlined(rect(21.5, 2, 5, 29, 1.5), "f2", { rotate }),
    outlined(rect(14, 30, 20, 4.5, 2.2), "f3", { rotate }),
    outlined(rect(22, 34, 4, 10, 1.8), "f1", { rotate }),
  ];
}

function star(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index++) {
    const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = index % 2 === 0 ? outer : inner;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

/** A leaf with its top corner folded, the ground of the mastery icons. */
function leaf(x: number, y: number, width: number, height: number): ToyShape[] {
  const fold = 7;
  return [
    outlined(`M${x} ${y}h${width - fold}l${fold} ${fold}v${height - fold}h${-width}z`, "f1"),
    outlined(`M${x + width - fold} ${y}v${fold}h${fold}z`, "f2"),
  ];
}

export const toyIcons = {
  challenge: [
    outlined(rect(19, 3, 10, 7, 2), "f3"),
    outlined(rect(35, 9, 6, 6, 1.5), "f3", { rotate: [45, 38, 12] }),
    outlined(circle(24, 27, 17), "f1"),
    outlined(circle(24, 27, 12), "f2"),
    outlined("M24 27V18M24 27l6 3"),
    { d: circle(24, 27, 2.6), fill: "outline" },
    light("M12 22a13 13 0 0 1 8-9"),
  ],
  friends: [
    outlined(circle(32, 15, 7), "f2"),
    outlined("M20 37a12 11 0 0 1 24 0v3H20z", "f2"),
    outlined(circle(19, 19, 8.5), "f1"),
    outlined("M4 43a15 13 0 0 1 30 0v1H4z", "f1"),
    { d: ellipse(16.5, 16, 3, 2.2), fill: "gloss" },
  ],
  chest: [
    outlined("M6 22v17a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3V22z", "f1"),
    outlined("M6 22v-4A10 10 0 0 1 16 8h16a10 10 0 0 1 10 10v4z", "f2"),
    { d: "M12 9v33M36 9v33", stroke: "outline", strokeWidth: 7 },
    { d: "M12 9v33M36 9v33", stroke: "f3", strokeWidth: 4 },
    outlined(rect(6, 20, 36, 5), "f3"),
    outlined(rect(19.5, 18, 9, 12, 2.5), "f3"),
    light("M11 17a8 8 0 0 1 6-6"),
    { d: circle(24, 23.5, 1.8), fill: "outline" },
  ],
  settings: [
    outlined(gear(24, 24, 20, 15.5, 8), "f1"),
    outlined(circle(24, 24, 7), "f2"),
    light("M12 17a14 14 0 0 1 7-6"),
  ],
  clan: [
    outlined("M24 4l17 6v12c0 11-7 18-17 22C14 40 7 33 7 22V10z", "f1"),
    { d: "M24 10v28c7-3 11-8 11-16v-8z", fill: "f2" },
    outlined("M24 4l17 6v12c0 11-7 18-17 22C14 40 7 33 7 22V10z"),
  ],
  discussion: [
    outlined(
      "M9 8h30a5 5 0 0 1 5 5v17a5 5 0 0 1-5 5H23l-9 8v-8H9a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z",
      "f1",
    ),
    { d: circle(15, 21.5, 2.8), fill: "outline" },
    { d: circle(24, 21.5, 2.8), fill: "outline" },
    { d: circle(33, 21.5, 2.8), fill: "outline" },
  ],
  jousts: [...sword(45), ...sword(-45)],
  album: [
    outlined("M24 12C18 7 10 7 4 9v31c6-2 14-2 20 3 6-5 14-5 20-3V9c-6-2-14-2-20 3z", "f1"),
    outlined("M8 12c5-1 11 0 15 3v23c-4-2-10-3-15-2zM40 12c-5-1-11 0-15 3v23c4-2 10-3 15-2z", "f2"),
  ],
  challenges: [
    outlined("M14 6h20v8a10 10 0 0 1-20 0z", "f1"),
    outlined("M14 9H7v3a7 7 0 0 0 7 7M34 9h7v3a7 7 0 0 1-7 7"),
    outlined(rect(21, 23, 6, 9), "f1"),
    outlined(rect(13, 32, 22, 9, 2.5), "f2"),
    light("M18 9v5a6 6 0 0 0 3 5"),
  ],
  sachet: [
    outlined("M11 5h26l2 5v28l-2 5H11l-2-5V10z", "f1"),
    outlined(circle(24, 24, 8), "f3"),
    { d: "M11 12h26", stroke: "outline", strokeWidth: 2, dash: "2.5 2.5" },
    light("M14 16v18"),
  ],
  trades: [
    outlined("M6 17h25v-7l11 9-11 9v-7H6z", "f1"),
    outlined("M42 31H17v-7L6 33l11 9v-7h25z", "f2"),
  ],
  community: [
    outlined("M10 5v39", undefined, { strokeWidth: 3.5 }),
    outlined("M11 7h28l-6 9 6 9H11z", "f1"),
    outlined(circle(10, 5, 3), "f3"),
  ],
  mail: [outlined(rect(4, 10, 40, 29, 5), "f2"), outlined("M6 13l18 14 18-14")],
  ecu: [
    outlined(circle(24, 24, 19), "f1"),
    outlined(circle(24, 24, 13.5), "f2"),
    outlined("M24 15l4.5 9-4.5 9-4.5-9z", "f3"),
    light("M11 19a14 14 0 0 1 7-8"),
  ],
  // A rolled list with its three ticks: the missions of the day.
  missions: [
    outlined("M12 6h24a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z", "f1"),
    outlined(rect(6, 3, 36, 7, 3.5), "f2"),
    outlined(rect(6, 39, 36, 7, 3.5), "f2"),
    outlined("M14 18l3 3 5-6M14 30l3 3 5-6", undefined, { strokeWidth: 3 }),
    { d: "M26 18h9M26 30h9", stroke: "f3", strokeWidth: 3 },
    light("M12 14v20"),
  ],
  lock: [
    outlined("M15 21v-6a9 9 0 0 1 18 0v6", undefined, { strokeWidth: 5.5 }),
    { d: "M15 21v-6a9 9 0 0 1 18 0v6", stroke: "f2", strokeWidth: 2 },
    outlined(rect(10, 20, 28, 23, 5), "f3"),
    { d: circle(24, 30, 3), fill: "outline" },
    { d: rect(22.6, 31, 2.8, 6, 1.2), fill: "outline" },
  ],
  arrow: [
    outlined("M30 8L14 24l16 16", undefined, { strokeWidth: 7 }),
    { d: "M30 8L14 24l16 16", stroke: "f1", strokeWidth: 3 },
  ],
  // The four levels of a word's mastery, from the blank page to the gilded one.
  blank: [
    ...leaf(11, 5, 26, 38),
    { d: "M16 20h16M16 26h16M16 32h10", stroke: "f3", strokeWidth: 1.8, dash: "3 2.5" },
    light("M14.5 10v28"),
  ],
  sketch: [
    ...leaf(6, 5, 25, 36),
    { d: "M11 31c2-8 7-12 10-8s-3 9 2 9c3 0 4-3 5-5", stroke: "f3", strokeWidth: 2.2 },
    { d: "M11 16h11", stroke: "f3", strokeWidth: 1.8, dash: "4 2.5" },
    outlined("M27 42L39 22l5 3-12 20z", "f2"),
    outlined("M27 42l5 3-5.5 1.8z", "f1"),
    outlined("M39 22l2.5-4 5 3-2.5 4z", "f3"),
  ],
  ink: [
    outlined("M13 27h20l3 5v11H10V32z", "f1"),
    outlined(rect(17, 21, 12, 6, 1.5), "f1"),
    outlined(rect(14, 34, 18, 6, 1), "f2"),
    outlined("M27 24C30 14 37 6 45 3c-1 9-7 17-16 22z", "f3"),
    { d: "M28 24.5L43 5.5", stroke: "outline", strokeWidth: 1.6 },
    light("M13.5 31v9"),
  ],
  // Along the level road, a reading room's odds and ends.
  books: [
    outlined(rect(5, 34, 38, 9, 2.5), "f1"),
    outlined(rect(9, 25, 31, 9, 2.5), "f2", { rotate: [-5, 24, 29] }),
    outlined(rect(8, 16, 29, 9, 2.5), "f3", { rotate: [4, 22, 20] }),
    { d: "M12 38.5h23M14 29.5h20M13 20.5h18", stroke: "sheen", strokeWidth: 1.6 },
    outlined("M29 16v-7l2.5 2.5L34 9v7", "f1", { strokeWidth: 2 }),
  ],
  candle: [
    outlined(ellipse(24, 41, 15, 4), "f1"),
    outlined(rect(19, 33, 10, 7, 2), "f1"),
    outlined(rect(18, 16, 12, 18, 2.5), "f2"),
    outlined("M30 19c-2 1-2 5-4 5s-1-4-3-5", "f2", { strokeWidth: 2 }),
    { d: "M24 16v-3", stroke: "outline", strokeWidth: 1.8 },
    outlined("M24 2c4 4 5.5 7 5.5 9.5a5.5 5.5 0 0 1-11 0C18.5 9 20 6 24 2z", "f3"),
    light("M21.5 20v10"),
  ],
  scroll: [
    outlined(rect(10, 10, 28, 28), "f1"),
    outlined(rect(6, 6, 36, 8, 4), "f2"),
    outlined(rect(6, 34, 36, 8, 4), "f2"),
    { d: "M15 19h18M15 24h18M15 29h11", stroke: "outline", strokeWidth: 1.6, dash: "3 2.2" },
    outlined(circle(33, 32, 4.5), "f3"),
    light("M10 9h20"),
  ],
  gilded: [
    outlined(gear(24, 26, 19, 16.5, 14), "f1"),
    outlined(circle(24, 26, 12), "f2"),
    outlined(star(24, 26, 8, 3.6), "f3"),
    outlined("M40 2l1.6 4.4L46 8l-4.4 1.6L40 14l-1.6-4.4L34 8l4.4-1.6z", "f3"),
    light("M12 21a13 13 0 0 1 7-8"),
  ],
} as const satisfies Record<string, readonly ToyShape[]>;

export type ToyIconName = keyof typeof toyIcons;

/** The inks each icon takes on its own tile. */
export const toyIconInks: Readonly<Record<ToyIconName, ToyInks>> = {
  challenge: { f1: "#F6D47A", f2: "#FFF6E0", f3: "#D9A63A" },
  friends: { f1: "#FBECCB", f2: "#F6D47A", f3: "#F6D47A" },
  chest: { f1: "#9C5F2C", f2: "#C47D3E", f3: "#F6D47A" },
  settings: { f1: "#FBECCB", f2: "#8F611C", f3: "#F6D47A" },
  clan: { f1: "#F6D47A", f2: "#D9A63A", f3: "#FBECCB" },
  discussion: { f1: "#FBECCB", f2: "#EAD2A0", f3: "#F6D47A" },
  jousts: { f1: "#9C5F2C", f2: "#E6E0D4", f3: "#F6D47A" },
  album: { f1: "#922A34", f2: "#FBECCB", f3: "#F6D47A" },
  challenges: { f1: "#F6D47A", f2: "#9C5F2C", f3: "#F6D47A" },
  sachet: { f1: "#922A34", f2: "#FBECCB", f3: "#FBECCB" },
  trades: { f1: "#5A7CB8", f2: "#F6D47A", f3: "#F6D47A" },
  community: { f1: "#34714A", f2: "#FBECCB", f3: "#F6D47A" },
  mail: { f1: "#FBECCB", f2: "#FBECCB", f3: "#F6D47A" },
  ecu: { f1: "#D9A63A", f2: "#F6D47A", f3: "#FFF6E0" },
  missions: { f1: "#FBECCB", f2: "#C47D3E", f3: "#922A34" },
  lock: { f1: "#D0C8BA", f2: "#D0C8BA", f3: "#F6D47A" },
  arrow: { f1: "#5A3418", f2: "#5A3418", f3: "#5A3418" },
  blank: { f1: "#FFF6E0", f2: "#EAD2A0", f3: "#BF9C5E" },
  sketch: { f1: "#FFF6E0", f2: "#E9B44C", f3: "#6B655C" },
  ink: { f1: "#2F3E66", f2: "#FBECCB", f3: "#FFF6E0" },
  gilded: { f1: "#D9A63A", f2: "#F6D47A", f3: "#FFF6E0" },
  books: { f1: "#922A34", f2: "#34714A", f3: "#344F8F" },
  candle: { f1: "#D9A63A", f2: "#FFF6E0", f3: "#F6D47A" },
  scroll: { f1: "#FBECCB", f2: "#C47D3E", f3: "#922A34" },
};

/** The sachet of the stock, in the blue of the night collection. */
export const stockToyInks: ToyInks = { f1: "#344F8F", f2: "#FBECCB", f3: "#F6D47A" };

/** The inks of an icon on a closed tile: greys, so that only what is open has color. */
export const lockedToyInks: ToyInks = { f1: "#E6E0D4", f2: "#C4BCAE", f3: "#D6CFC2" };

/** Colors of the two lights, over any ink. */
export const toyLights = {
  gloss: { color: "#FFFFFF", opacity: 0.28 },
  sheen: { color: "#FFFFFF", opacity: 0.6 },
} as const;

/** The chests of a clan's weekly goal, each in its metal. */
export const goalChestInks = {
  bronze: { f1: "#7A4A22", f2: "#9C5F2C", f3: "#D08A4E" },
  silver: { f1: "#6B6E78", f2: "#8C909B", f3: "#ECEAE4" },
  gold: { f1: "#9C5F2C", f2: "#C47D3E", f3: "#F6D47A" },
  illuminated: { f1: "#6E1428", f2: "#A3304A", f3: "#F6D47A" },
} as const satisfies Record<string, ToyInks>;

/**
 * Inks of illumination: gold leaf, the pigments of a manuscript and its iron-gall ink. The
 * lettrines of the tiles are painted with them; /planches/icones compares them with other looks.
 */
export const illumination = {
  goldLeaf: [
    ["#FFF3C4", 0],
    ["#F6D47A", 0.32],
    ["#C9952E", 0.68],
    ["#8A5A14", 1],
  ],
  ink: "#2A160B",
  sepia: "#5A3A1E",
  vellum: "#FBF3DE",
  parchment: "#F1E1BC",
  rubric: "#A3271F",
  pigments: {
    vermilion: "#B23A2A",
    lapis: "#2B4A8F",
    verdigris: "#2F6E52",
    madder: "#7A1E34",
    umber: "#7A4E2A",
  },
} as const;

/**
 * The inside of a tile as an illuminated initial: a ground of pigment, chosen by the tile's
 * matter, lit from above and darker at its edges, a dot of gold in each corner, and the icon
 * painted in vellum and gold. The tile around it is old gold, so that every tile of the room
 * reads as one family.
 */
export const lettrine = {
  grounds: {
    gold: illumination.pigments.madder,
    red: illumination.pigments.vermilion,
    green: illumination.pigments.verdigris,
    blue: illumination.pigments.lapis,
    paper: illumination.pigments.umber,
    locked: "#6E675C",
    alert: illumination.pigments.vermilion,
    dark: illumination.ink,
  } satisfies Record<ToyMatterName, string>,
  /** The line around the ground, in the shade of the gold: frame and ground read as one piece. */
  rule: "#8A5A14",
  ruleWidth: 1,
  /** Room between the tile's edge and the ground, in px; the lip of the tile comes on top below. */
  inset: 4,
  radius: 4,
  /** Over the ground: a light from above, fading to a shade at the edges, as under varnish. */
  glow: [
    { offset: 0, color: illumination.vellum, opacity: 0.24 },
    { offset: 0.55, color: illumination.vellum, opacity: 0 },
    { offset: 1, color: illumination.ink, opacity: 0.38 },
  ],
  /** The light's center and reach, as fractions of the ground. */
  glowAt: { cx: 0.5, cy: 0.32, r: 0.8 },
  /** The dots of gold in the corners, as fractions of the ground. */
  bezants: {
    r: 1,
    color: "#F6D47A",
    opacity: 0.85,
    at: [
      [0.13, 0.13],
      [0.87, 0.13],
      [0.13, 0.87],
      [0.87, 0.87],
    ],
  },
} as const;

/** Light and deep gold, for the parts of an icon that are not pale. */
const LETTRINE_GOLD = { light: "#F6D47A", deep: "#D9A63A" } as const;

/** Lighter than this, an ink is the icon's paper and stays vellum. */
const PALE_LIGHTNESS = 0.82;

/**
 * The inks of an icon on a lettrine: what was pale stays vellum, the rest turns to gold, lighter
 * where the toy's ink was lighter, so the drawing keeps its parts apart.
 */
export function lettrineInks(name: ToyIconName): ToyInks {
  const source = toyIconInks[name];
  const repaint = (hex: string): string => {
    const lightness = lightnessOf(hex);
    if (lightness > PALE_LIGHTNESS) return illumination.vellum;
    return lightness > 0.6 ? LETTRINE_GOLD.light : LETTRINE_GOLD.deep;
  };
  return { f1: repaint(source.f1), f2: repaint(source.f2), f3: repaint(source.f3) };
}

function lightnessOf(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (Math.max(...channels) + Math.min(...channels)) / 2 / 255;
}
