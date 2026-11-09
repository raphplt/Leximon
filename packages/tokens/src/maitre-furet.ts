import type { CrestLayer, CrestPaint } from "./league-crests";

/**
 * Maître Furet's medallion: an old engraving of a ferret in a ring of gold leaf, a velvet toque
 * with a plume set askew on top, and a vermilion ribbon that names him. Geometry only, on a
 * 100 × 110 grid (100 × 100 without the ribbon), painted with the crests' colours, so that the
 * web and mobile draw the same medallion.
 */

export const furetViewBox = { full: "0 0 100 110", bare: "0 0 100 100" } as const;
export const furetRatio = { full: 1.1, bare: 1 } as const;

/** Where the engraving sits, clipped to this circle. */
export const furetPortrait = { cx: 50, cy: 60, r: 31 } as const;

/** Where the ribbon's word is written, centred on `x`. */
export const furetMotto = { x: 50, y: 98.6, size: 10.5 } as const;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${round(cx - r)} ${round(cy)} A${r} ${r} 0 1 0 ${round(cx + r)} ${round(cy)} A${r} ${r} 0 1 0 ${round(cx - r)} ${round(cy)} Z`;
}

/** The toque leans towards the ferret's face, on the right. */
const TILT = (9 * Math.PI) / 180;
const PIVOT = { x: 52, y: 24 };

function turned(x: number, y: number): [number, number] {
  const dx = x - PIVOT.x;
  const dy = y - PIVOT.y;
  return [
    round(PIVOT.x + dx * Math.cos(TILT) - dy * Math.sin(TILT)),
    round(PIVOT.y + dx * Math.sin(TILT) + dy * Math.cos(TILT)),
  ];
}

function askew(x: number, y: number): string {
  return turned(x, y).join(" ");
}

const outlined = (d: string, fill: CrestPaint, width = 1.8): CrestLayer => ({
  d,
  fill,
  stroke: "ink",
  width,
});

const RING = circle(50, 60, 38);
const BEZEL = circle(furetPortrait.cx, furetPortrait.cy, furetPortrait.r);

/** Under the engraving: the ring of gold leaf. */
export const furetBack: readonly CrestLayer[] = [outlined(RING, "or", 2.4)];

const ring: readonly CrestLayer[] = [
  {
    d: circle(50, 60, 34.6),
    stroke: "ink",
    width: 1.3,
    dash: "0.1 3.2",
    cap: "round",
    opacity: 0.55,
  },
  { d: "M19 52 A32 32 0 0 1 40 26", stroke: "sheen", width: 2.2, cap: "round", opacity: 0.55 },
  { d: BEZEL, stroke: "ink", width: 2 },
];

const toque: readonly CrestLayer[] = [
  outlined(
    `M${askew(71, 21)} Q${askew(58, 7)} ${askew(85, 0)} Q${askew(88, 14)} ${askew(76, 22)} Z`,
    "argent",
    1.4,
  ),
  {
    d: `M${askew(73, 20)} Q${askew(76, 9)} ${askew(84, 1.5)} M${askew(74, 13)} L${askew(69, 10)} M${askew(77, 8)} L${askew(73, 5)} M${askew(77, 15)} L${askew(81, 13)}`,
    stroke: "ink",
    width: 0.9,
    cap: "round",
    opacity: 0.5,
  },
  outlined(
    `M${askew(26, 23)} C${askew(19, 15)} ${askew(24, 6)} ${askew(34, 6)} C${askew(38, 1)} ${askew(46, 2)} ${askew(50, 4)} C${askew(55, 1)} ${askew(63, 1)} ${askew(67, 5)} C${askew(77, 5)} ${askew(83, 13)} ${askew(77, 23)} Z`,
    "sable",
  ),
  {
    d: `M${askew(40, 5)} Q${askew(43, 14)} ${askew(40, 21)}`,
    stroke: "ink",
    width: 1,
    opacity: 0.6,
  },
  {
    d: `M${askew(59, 4)} Q${askew(62, 13)} ${askew(62, 21)}`,
    stroke: "ink",
    width: 1,
    opacity: 0.6,
  },
  {
    d: `M${askew(28, 13)} Q${askew(33, 7)} ${askew(44, 5)}`,
    stroke: "sheen",
    width: 1.6,
    cap: "round",
    opacity: 0.3,
  },
  outlined(
    `M${askew(27, 21)} Q${askew(51, 24.5)} ${askew(76, 21)} L${askew(76, 28.5)} Q${askew(51, 32)} ${askew(27, 28.5)} Z`,
    "or",
  ),
  {
    d: `M${askew(29, 24.8)} Q${askew(51, 28.2)} ${askew(74, 24.8)}`,
    stroke: "ink",
    width: 0.9,
    dash: "0.1 2.6",
    cap: "round",
    opacity: 0.5,
  },
  outlined(circle(...turned(51, 26.5), 2.8), "gules", 1.2),
];

/** Over the engraving: the punched ring, its bezel and the toque. */
export const furetFront: readonly CrestLayer[] = [...ring, ...toque];

/** The ribbon under the medallion, its forked tails folded behind. */
export const furetRibbon: readonly CrestLayer[] = [
  outlined("M21 94 L4 96.5 L10 102 L4 108 L23 106 Z", "gules", 1.6),
  outlined("M79 94 L96 96.5 L90 102 L96 108 L77 106 Z", "gules", 1.6),
  { d: "M17 104 L23 106 L23 101 Z", fill: "ink", opacity: 0.45 },
  { d: "M83 104 L77 106 L77 101 Z", fill: "ink", opacity: 0.45 },
  outlined("M17 92 Q50 85 83 92 L83 104 Q50 97 17 104 Z", "gules", 1.8),
  { d: "M20 93.6 Q50 87.6 80 93.6", stroke: "sheen", width: 1, cap: "round", opacity: 0.35 },
];
