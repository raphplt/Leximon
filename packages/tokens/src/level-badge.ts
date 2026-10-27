/**
 * The level badge: a gold medal with a scalloped rim, in the hot-stamped gold of the sachets'
 * seal, and the number engraved in brown on its face. The one look of a level, a player's or a
 * clan's. Geometry only, in a 100 × 100 box, so that the web (`<svg>`) and mobile
 * (react-native-svg) draw the same badge.
 */

import { sealGold } from "./pack-looks";

export const levelBadgeBox = 100;

const CENTER_X = 50;
/** The medal sits a little high: its dark edge shows under it, as a thickness. */
const CENTER_Y = 48.5;
const SCALLOPS = 24;

/** A rim of `SCALLOPS` round bumps standing on a circle of radius `radius` around (50, `cy`). */
function scallops(radius: number, cy = CENTER_Y): string {
  const point = (index: number) => {
    const angle = (index / SCALLOPS) * 2 * Math.PI - Math.PI / 2;
    return `${round(CENTER_X + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`;
  };
  // Half the chord between two hollows: each bump is a half circle.
  const bump = round(radius * Math.sin(Math.PI / SCALLOPS));
  const parts = [`M${point(0)}`];
  for (let index = 1; index <= SCALLOPS; index++) {
    parts.push(`A${bump} ${bump} 0 0 1 ${point(index)}`);
  }
  return `${parts.join(" ")}Z`;
}

function disc(radius: number, cy = CENTER_Y): string {
  return `M${CENTER_X - radius} ${cy} A${radius} ${radius} 0 1 1 ${CENTER_X + radius} ${cy} A${radius} ${radius} 0 1 1 ${CENTER_X - radius} ${cy}Z`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export const levelBadge = {
  /** The dark edge, dropped a little: the medal's thickness. */
  edge: scallops(43, CENTER_Y + 2.5),
  /** The scalloped rim, in the seal's gold, from its light top left to its dark bottom right. */
  rim: scallops(43),
  rimGold: sealGold,
  /** The engraved groove between the rim and the face. */
  groove: disc(35.5),
  face: disc(33),
  colors: {
    edge: "#5A3D10",
    groove: "#7A5410",
    faceTop: "#F6DC8E",
    faceBottom: "#D9A740",
    /** The number, engraved. */
    ink: "#4A300A",
    /** The light lip under the engraved number. */
    inkLip: "rgba(255, 243, 196, 0.85)",
  },
} as const;

/** How far below the number its light lip shows, in the 100 box. */
export const levelBadgeLip = 1.6;

/**
 * Where and how big the number is drawn, in the 100 box: its baseline sits so that the digits
 * centre on the face, and three digits get smaller to stay inside it.
 */
export function levelBadgeText(level: number): { x: number; y: number; fontSize: number } {
  const digits = String(level).length;
  const fontSize = digits <= 1 ? 48 : digits === 2 ? 42 : 32;
  return { x: CENTER_X, y: round(CENTER_Y + 1 + fontSize * 0.35), fontSize };
}
