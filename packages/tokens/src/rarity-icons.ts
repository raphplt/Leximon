import type { Rarity } from "@leximon/core";

/**
 * Rarity icons, « Gemmes et minéraux » set (owner's choice, 2026-10-20): a gem that gains in cut
 * and splendour with the rarity. Path data only, so that the web (`<svg>`) and mobile
 * (react-native-svg) draw the same geometry.
 *
 * Each icon sits on a `rarityIconGrid` × `rarityIconGrid` grid. `body` is painted in the ink
 * colour; `cuts` are knocked out of it like the white lines of a woodcut. Cuts are thin on
 * purpose: they fade at 10 px and leave the silhouette, which carries the rank on its own.
 */
export const rarityIconGrid = 24;

/** A cut: a line of `width` grid units, or a shape knocked out whole. */
export type RarityIconCut =
  | { readonly kind: "line"; readonly d: string; readonly width: number }
  | { readonly kind: "solid"; readonly d: string };

export interface RarityIconShape {
  readonly body: readonly string[];
  readonly cuts: readonly RarityIconCut[];
}

const CUT = 1.2;

function line(d: string, width = CUT): RarityIconCut {
  return { kind: "line", d, width };
}

function round(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** A point at `r` from the centre; angles in degrees, 0 = up, clockwise. */
function polar(cx: number, cy: number, r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${round(cx + r * Math.sin(a))} ${round(cy - r * Math.cos(a))}`;
}

function starPath(
  cx: number,
  cy: number,
  points: number,
  outer: number,
  inner: number,
  rotation = 0,
): string {
  const step = 360 / points;
  const parts: string[] = [];
  for (let i = 0; i < points; i++) {
    const a = rotation + i * step;
    parts.push(`${i === 0 ? "M" : "L"}${polar(cx, cy, outer, a)}`);
    parts.push(`L${polar(cx, cy, inner, a + step / 2)}`);
  }
  return `${parts.join(" ")}Z`;
}

type Point = readonly [x: number, y: number];

/** Points turned by `deg` degrees (clockwise) around the centre of the grid. */
function turn(points: readonly Point[], deg: number): Point[] {
  const a = (deg * Math.PI) / 180;
  const c = rarityIconGrid / 2;
  return points.map(([x, y]) => [
    c + (x - c) * Math.cos(a) - (y - c) * Math.sin(a),
    c + (x - c) * Math.sin(a) + (y - c) * Math.cos(a),
  ]);
}

function polyline(points: readonly Point[], closed: boolean): string {
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`).join(" ");
  return closed ? `${d}Z` : d;
}

// ── Courant: a raw shard (owner's pick over a cabochon and a glass bead, 2026-10-20) ─────────

/** One raw crystal point, slanted, broken at its foot: a shard picked up from the ground. */
const SHARD_TILT = 30;
const courant: RarityIconShape = {
  body: [
    polyline(
      turn(
        [
          [8.6, 20.4],
          [7.4, 9.4],
          [12, 4],
          [16.6, 9.4],
          [15.4, 20.8],
          [12.4, 19.2],
        ],
        SHARD_TILT,
      ),
      true,
    ),
  ],
  cuts: [
    line(
      polyline(
        turn(
          [
            [7.6, 9.6],
            [12.2, 11.6],
            [16.4, 9.6],
          ],
          SHARD_TILT,
        ),
        false,
      ),
    ),
    line(
      polyline(
        turn(
          [
            [12.2, 11.6],
            [12.4, 19],
          ],
          SHARD_TILT,
        ),
        false,
      ),
    ),
  ],
};

// ── The other five ───────────────────────────────────────────────────────────────────────────

/** A rough stone, knapped into a few broad facets. */
const roughStone: RarityIconShape = {
  body: ["M5.4 18 L3.4 12.4 L6.4 6.8 L11.8 3.8 L18.2 5.6 L20.8 11.8 L18.6 17.8 L12.6 20.6Z"],
  cuts: [line("M3.6 12.2 L9.6 9.8 L13.8 11.4 L20.6 11.6 M9.6 9.8 L11.8 4 M13.8 11.4 L12.8 20.4")],
};

/** An emerald cut: a step-cut octagon seen from above. */
const emeraldCut: RarityIconShape = {
  body: ["M9 2.8 H15 L18.6 6.4 V17.6 L15 21.2 H9 L5.4 17.6 V6.4Z"],
  cuts: [
    line("M10.4 7.2 H13.6 L14.6 8.2 V15.8 L13.6 16.8 H10.4 L9.4 15.8 V8.2Z"),
    line("M7.2 4.6 L9.9 7.7 M16.8 4.6 L14.1 7.7 M16.8 19.4 L14.1 16.3 M7.2 19.4 L9.9 16.3"),
  ],
};

/** A brilliant seen from the side: crown, girdle and pavilion. */
const brilliant: RarityIconShape = {
  body: ["M7 5 H17 L21 10 L12 20.8 L3 10Z"],
  cuts: [line("M3.4 10 H20.6 M7 5 L9.4 10 L12 5 L14.6 10 L17 5 M9.4 10 L12 20.2 L14.6 10")],
};

/** A smaller brilliant under a crown. */
const crownedDiamond: RarityIconShape = {
  body: [
    "M6.8 7.4 L6.2 1.8 L9.4 4.6 L12 1.2 L14.6 4.6 L17.8 1.8 L17.2 7.4Z",
    "M8 9 H16 L19.6 13 L12 22.6 L4.4 13Z",
  ],
  cuts: [line("M4.8 13 H19.2 M8 9 L10 13 L12 9 L14 13 L16 9 M10 13 L12 22 L14 13")],
};

/** A star gem: six rays cut from a hexagonal heart. */
const STAR_CENTRE_Y = 12.2;
const starGem: RarityIconShape = {
  body: [starPath(12, STAR_CENTRE_Y, 6, 11.2, 5.4)],
  cuts: [
    line(
      [0, 60, 120, 180, 240, 300]
        .map((a) => `M12 ${STAR_CENTRE_Y} L${polar(12, STAR_CENTRE_Y, 9.6, a)}`)
        .join(" "),
    ),
    { kind: "solid", d: starPath(12, STAR_CENTRE_Y, 6, 2.6, 2.6, 30) },
  ],
};

export const rarityIcons: Readonly<Record<Rarity, RarityIconShape>> = {
  common: courant,
  uncommon: roughStone,
  rare: emeraldCut,
  precious: brilliant,
  epic: crownedDiamond,
  legendary: starGem,
};
