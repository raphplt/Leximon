/**
 * What a collection prints on its sachet: the emblem engraved in its gold seal and the faint
 * motif of its foil. Geometry only, so that the web (`<svg>`, CSS) and mobile (react-native-svg)
 * draw the same sachet.
 */

export type PackMotif = "dots" | "hatch" | "grid";

export interface PackLook {
  /** Strokes of the emblem, in a 64 × 64 box; the first ones listed in `solid` are filled too. */
  readonly emblem: readonly string[];
  /** How many of the first strokes are closed shapes, filled with a wash of gold. */
  readonly solid: number;
  /** Faint pattern printed on the foil, in kraft. */
  readonly motif: PackMotif;
}

const BOOK: PackLook = {
  emblem: [
    "M8 18c8-4 16-4 24 2 8-6 16-6 24-2v32c-8-4-16-4-24 2-8-6-16-6-24-2z",
    "M32 20v32",
    "M14 26c4-1 8-1 12 1M14 33c4-1 8-1 12 1M38 27c4-2 8-2 12-1M38 34c4-2 8-2 12-1",
  ],
  solid: 1,
  motif: "dots",
};

/** Each collection's emblem and motif; a collection missing here gets the book. */
const LOOKS: Readonly<Record<string, PackLook>> = {
  fondateurs: {
    emblem: [BOOK.emblem[0] as string, "m46 4 6 6-14 14-7 1 1-7z", ...BOOK.emblem.slice(1)],
    solid: 2,
    motif: "dots",
  },
  caracteres: {
    emblem: [
      "M10 14h26v18c0 9-6 15-13 15S10 41 10 32z",
      "M36 22h18v14c0 8-5 13-11 13-3 0-6-1-8-3",
      "M17 26h3M27 26h3M18 36c3 2 7 2 10 0",
      "M41 32h3M49 32h3M42 43c2-2 6-2 8 0",
    ],
    solid: 2,
    motif: "hatch",
  },
  metiers: {
    emblem: [
      "m36 14 14 14-6 6-14-14z",
      "M14 18a8 8 0 0 0 10 10l-4 4-6-6z",
      "M14 50 40 24",
      "M44 50 22 28",
    ],
    solid: 2,
    motif: "grid",
  },
};

export function packLook(collectionId: string): PackLook {
  return LOOKS[collectionId] ?? BOOK;
}

/** The seal is drawn in a 120 × 120 box. */
export const sealBox = 120;

/** The hot-stamped gold of the seal, from its light top left to its dark bottom right. */
export const sealGold: readonly (readonly [color: string, position: number])[] = [
  ["#fff1c2", 0],
  ["#e9bf62", 0.35],
  ["#b98128", 0.7],
  ["#7d5214", 1],
];

/** The scalloped rim of the seal: bumps of this many around a circle of radius 54. */
const SCALLOPS = 22;

export const sealScallopPath = (() => {
  const point = (k: number) => {
    const angle = (k / SCALLOPS) * 2 * Math.PI - Math.PI / 2;
    return `${(60 + 54 * Math.cos(angle)).toFixed(2)} ${(60 + 54 * Math.sin(angle)).toFixed(2)}`;
  };
  const bump = (54 * Math.PI) / SCALLOPS + 1.2;
  const arcs = Array.from(
    { length: SCALLOPS },
    (_, k) => `A${bump.toFixed(2)} ${bump.toFixed(2)} 0 0 1 ${point(k + 1)}`,
  );
  return `M${point(0)}${arcs.join("")}Z`;
})();

/** Beads around the engraved field, like on a coin. */
export const sealBeads: readonly (readonly [x: number, y: number])[] = Array.from(
  { length: 36 },
  (_, k) => {
    const angle = (k / 36) * 2 * Math.PI;
    // Rounded: the server and the browser must print the same figures.
    const at = (value: number) => Math.round(value * 100) / 100;
    return [at(60 + 45.5 * Math.cos(angle)), at(60 + 45.5 * Math.sin(angle))] as const;
  },
);
