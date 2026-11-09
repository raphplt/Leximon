import { toy, toyMatters } from "./library";

/**
 * The ornaments of the paper: gilt rules, fleurons and tailpieces in the toys' gold and pigments,
 * drawn once for the web and the app.
 */

/**
 * What a part is painted in. A `stem` is a gilt line drawn twice, ink under gold; the other parts
 * are filled and outlined in ink.
 */
export type OrnamentPaint =
  | "stem"
  | "leafRed"
  | "leafBlue"
  | "bezant"
  | "dotRed"
  | "taper"
  | "rule"
  | "ruleThin";

export interface OrnamentPart {
  readonly paint: OrnamentPaint;
  readonly d: string;
  /** An SVG transform, for a part drawn again in a mirror. */
  readonly transform?: string;
}

export interface Ornament {
  readonly width: number;
  readonly height: number;
  readonly parts: readonly OrnamentPart[];
}

function dot(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

function mirrored(parts: readonly OrnamentPart[], transform: string): OrnamentPart[] {
  return parts.map((part) => ({ ...part, transform }));
}

const FLEURON_STEM = "M16 8 H33 C43 8 50 10 50 17 C50 22 44 24 41 20 C39 17 42 14 45 16";

/** One arm of a fleuron: a gilt stem along the rule, a red leaf, a curl and a bezant at its end. */
const FLEURON_ARM: readonly OrnamentPart[] = [
  { paint: "stem", d: FLEURON_STEM },
  { paint: "leafRed", d: "M22 9 C25 16 32 20 39 18 C36 12 30 9 22 9 Z M24 10 L36 17" },
  { paint: "bezant", d: dot(57, 8, 2.4) },
];

/**
 * A fleuron for the top left corner of a frame: a lozenge on the corner, an arm along each side, a
 * blue leaf on the diagonal.
 */
export const fleuron: Ornament = {
  width: 64,
  height: 64,
  parts: [
    ...FLEURON_ARM,
    ...mirrored(FLEURON_ARM, "matrix(0 1 1 0 0 0)"),
    { paint: "leafBlue", d: "M15 15 C24 15 31 22 31 31 C22 31 15 24 15 15 Z M17 17 L28 28" },
    { paint: "bezant", d: "M8 0 L16 8 L8 16 L0 8 Z" },
    { paint: "dotRed", d: dot(8, 8, 2.6) },
  ],
};

/** The frame that holds the fleurons: a gilt rule, a red hairline inside it. */
export const fleuronFrame = {
  inset: 8,
  rule: 2,
  hairlineInset: 3,
  hairlineOpacity: 0.7,
  /** The fleuron's size, and how far its lozenge reaches over the corner of the rule. */
  corner: { size: 60, overhang: 8.5 },
  phoneCorner: { size: 48, overhang: 7 },
} as const;

/**
 * The bookbinder's rule: a thick and a thin gilt line that turn inward at each corner around a
 * small lozenge. The corner piece is drawn for the top left; the straight runs between corners are
 * plain lines of the same widths.
 */
export const bindingRule = {
  inset: 8,
  thick: 2,
  thin: 1,
  /** Between the outside of the thick line and the outside of the thin one. */
  gap: 5,
  corner: {
    width: 24,
    height: 24,
    parts: [
      { paint: "rule", d: "M24 1 H11.96 A12 12 0 0 1 1 11.96 V24" },
      { paint: "ruleThin", d: "M24 5.5 H16.08 A17 17 0 0 1 5.5 16.08 V24" },
      { paint: "bezant", d: "M3.6 -0.6 L7.8 3.6 L3.6 7.8 L-0.6 3.6 Z" },
    ],
  } satisfies Ornament,
} as const;

/** A gilt square for the top left corner of a small tile, curled at both ends. */
export const giltCorner: Ornament = {
  width: 36,
  height: 36,
  parts: [
    { paint: "stem", d: "M5 30 V14 C5 8.5 8.5 5 14 5 H30" },
    { paint: "bezant", d: dot(5, 32, 2.2) },
    { paint: "bezant", d: dot(32, 5, 2.2) },
    { paint: "dotRed", d: dot(12, 12, 2.4) },
  ],
};

/** The room the gilt corners keep from the edge of the tile, in px. */
export const giltCornerInset = 5;

/** A gilt rule under a section title, tapering to both ends, a lozenge in its middle. */
export const titleRule: Ornament = {
  width: 160,
  height: 16,
  parts: [
    { paint: "taper", d: "M4 8 L64 6 L64 10 Z" },
    { paint: "taper", d: "M156 8 L96 6 L96 10 Z" },
    { paint: "dotRed", d: dot(69, 8, 2.2) },
    { paint: "dotRed", d: dot(91, 8, 2.2) },
    { paint: "bezant", d: "M80 1 L87 8 L80 15 L73 8 Z" },
  ],
};

const TAILPIECE_STEM = "M67 12 H80 C90 12 97 15 97 21 C97 26 91 27 89 23 C87 20 90 18 92 19";

const TAILPIECE_ARM: readonly OrnamentPart[] = [
  { paint: "stem", d: TAILPIECE_STEM },
  { paint: "leafRed", d: "M71 13 C74 19 81 22 87 20 C84 15 78 13 71 13 Z" },
  { paint: "bezant", d: dot(104, 12, 2.2) },
];

/** A tailpiece: two gilt curls from a lozenge and a blue drop under it, to close a section. */
export const tailpiece: Ornament = {
  width: 120,
  height: 36,
  parts: [
    ...TAILPIECE_ARM,
    ...mirrored(TAILPIECE_ARM, "matrix(-1 0 0 1 120 0)"),
    { paint: "leafBlue", d: "M60 19 C64 23 64 28 60 32 C56 28 56 23 60 19 Z" },
    { paint: "bezant", d: "M60 5 L67 12 L60 19 L53 12 Z" },
  ],
};

/** An ivy leaf, the printers' hedera: three pointed lobes on a curled stem. */
export const hedera: Ornament = {
  width: 30,
  height: 24,
  parts: [
    { paint: "stem", d: "M2 13 C5 13 6 15 9 13" },
    {
      paint: "leafRed",
      d: "M9 12 C9 8 11 5 15 2.5 C15.6 5 16.4 6.6 18.6 7.6 C21.6 8.4 25 10 28 12 C25 14 21.6 15.6 18.6 16.4 C16.4 17.4 15.6 19 15 21.5 C11 19 9 16 9 12 Z M10 12 H24 M12 12 L15.5 6 M12 12 L15.5 18",
    },
  ],
};

/** The pigments of the ornaments, from the toys' own. */
export const ornamentInks = {
  ink: toy.outline,
  gold: toyMatters.gold.top,
  rule: toyMatters.gold.bottom,
  ruleThin: toyMatters.gold.edge,
  red: toyMatters.red.top,
  hairline: toyMatters.red.bottom,
  blue: toyMatters.blue.top,
} as const;

/** Line widths, in the units of each drawing. */
export const ornamentStrokes = {
  stemInk: 4.6,
  stemGold: 2.4,
  outline: 1.4,
  dotOutline: 1.2,
  taperOutline: 1,
  /** The soft ink under each ornament, as an opacity of the outline. */
  dropOpacity: 0.45,
} as const;
