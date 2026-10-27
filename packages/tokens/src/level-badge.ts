/**
 * The level badge: a blue rosette with soft tips, a light bevelled rim and the number in white,
 * ringed in ink. The one look of a level, a player's or a clan's. Geometry only, in a 100 × 100
 * box, so that the web (`<svg>`) and mobile (react-native-svg) draw the same badge.
 */

export const levelBadgeBox = 100;

const TIPS = 12;
const CENTER_X = 50;
/** The rosette sits a little high: its dark outline shows under it, as a thickness. */
const CENTER_Y = 48.5;

/**
 * A rosette of `TIPS` tips around (50, `cy`): tips at `outer`, hollows at `inner`, each corner
 * rounded by a curve so that nothing reads as a sharp star.
 */
function rosette(outer: number, inner: number, cy = CENTER_Y): string {
  const count = TIPS * 2;
  const vertex = (index: number): readonly [number, number] => {
    const angle = (Math.PI * index) / TIPS - Math.PI / 2;
    const radius = index % 2 === 0 ? outer : inner;
    return [CENTER_X + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };
  const toward = (from: readonly [number, number], to: readonly [number, number], t: number) =>
    `${round(from[0] + (to[0] - from[0]) * t)} ${round(from[1] + (to[1] - from[1]) * t)}`;
  const parts: string[] = [];
  for (let index = 0; index < count; index++) {
    const here = vertex(index);
    const before = vertex((index - 1 + count) % count);
    const after = vertex((index + 1) % count);
    const softness = index % 2 === 0 ? 0.42 : 0.3;
    parts.push(
      `${index === 0 ? "M" : "L"}${toward(here, before, softness)}`,
      `Q${round(here[0])} ${round(here[1])} ${toward(here, after, softness)}`,
    );
  }
  return `${parts.join(" ")}Z`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export const levelBadge = {
  /** The dark outline, dropped a little: the badge's edge and thickness. */
  outline: rosette(49, 40.5, CENTER_Y + 2.5),
  /** The light rim, bevelled from top to bottom. */
  rim: rosette(46.5, 38.5),
  /** A thin dark line between the rim and the face. */
  seam: rosette(38.5, 32.2),
  face: rosette(36.5, 30.5),
  /** The shine on the upper half of the face. */
  gloss: `M${CENTER_X - 25} 40 C${CENTER_X - 22} 22 ${CENTER_X + 22} 22 ${CENTER_X + 25} 40 C${CENTER_X + 12} 34 ${CENTER_X - 12} 34 ${CENTER_X - 25} 40Z`,
  colors: {
    outline: "#0B2A52",
    rimTop: "#E9F9FF",
    rimBottom: "#6FB8EC",
    seam: "#1B4F94",
    faceTop: "#68CFFF",
    faceBottom: "#1D62C4",
    gloss: "rgba(255, 255, 255, 0.32)",
    ink: "#FFFFFF",
    inkRing: "#0B2A52",
  },
} as const;

/**
 * Where and how big the number is drawn, in the 100 box: its baseline sits so that the digits
 * centre on the face, and three digits get smaller to stay inside it.
 */
export function levelBadgeText(level: number): { x: number; y: number; fontSize: number } {
  const digits = String(level).length;
  const fontSize = digits <= 1 ? 50 : digits === 2 ? 44 : 34;
  return { x: CENTER_X, y: round(CENTER_Y + 1 + fontSize * 0.35), fontSize };
}

/** The width of the ink ring around the number, in the 100 box. */
export const levelBadgeInkRing = 9;
