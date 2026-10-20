import type { Rarity } from "@leximon/core";

/**
 * Values are platform-neutral (hex colors, numbers in px, gradients as stops) so that the web
 * and React Native can both read them. Helpers for CSS live in `css.ts`.
 */

export interface LinearGradient {
  /** CSS convention: 0 points up, 90 points right. */
  readonly angle: number;
  /** Colors with their position, from 0 to 1. */
  readonly stops: readonly (readonly [color: string, position: number])[];
}

/** A plain color or a gradient. */
export type Fill = string | LinearGradient;

export const colors = {
  /** Screen background: a deep blue-grey night, so that every rarity color stands out. */
  background: "#262B40",
  backgroundRaised: "#343B5C",
  backgroundDot: "rgba(255, 255, 255, 0.05)",
  text: "#F6F0E2",
  textMuted: "#BDB6CC",
  /** Empty markers (stock dots, missing cards) on the background. */
  outline: "#5A6182",
  /** Main call to action. */
  accent: "#FFD24D",
  accentInk: "#2A1D05",
  accentShadow: "#C99A12",
  /** The kraft envelope of a booster and its wax seal. */
  kraft: "#D9B486",
  kraftInk: "#5A3D18",
  kraftTitle: "#2A1D0C",
  seal: "#E2431D",
  sealLight: "#FF7A55",
  sealDark: "#A82B0E",
  sealInk: "#8C2208",
  sticker: "#F0603C",
  focus: "#FFD24D",
} as const;

const gold: LinearGradient = {
  angle: 125,
  stops: [
    ["#B07D1E", 0],
    ["#FFE08A", 0.3],
    ["#D9A233", 0.55],
    ["#FFF0B8", 0.8],
    ["#B07D1E", 1],
  ],
};

const iridescent: LinearGradient = {
  angle: 115,
  stops: [
    ["#FF6FB5", 0],
    ["#FFD24D", 0.22],
    ["#7CF08A", 0.42],
    ["#4FD8FF", 0.62],
    ["#A77BFF", 0.82],
    ["#FF6FB5", 1],
  ],
};

/** How a card of a given rarity is painted. */
export interface RarityStyle {
  /** Thick outer frame of the card. */
  readonly frame: Fill;
  /** Round chip holding the rarity icon (`rarity-icons.ts`). */
  readonly band: Fill;
  readonly bandInk: string;
  /** The word itself: a color, or a gradient clipped to the text. */
  readonly word: Fill;
  readonly paper: string;
  readonly ink: string;
  readonly muted: string;
  readonly chip: string;
  readonly chipInk: string;
  /** Frequency figure in the footer. */
  readonly spot: string;
  /** Hatching lines of the engraving. */
  readonly hatch: string;
  /** Halo behind the card when it is revealed. `null` for no halo. */
  readonly glow: string | null;
}

const cream = {
  paper: "#FBF5E8",
  ink: "#1E1B16",
  muted: "#625A4E",
  chip: "#EFE6D3",
  chipInk: "#3E382F",
  glow: null,
} as const;

/** Épique and Légendaire are night cards: the pépites must look different at a glance. */
const night = {
  paper: "#1B1F33",
  ink: "#F6F0E2",
  muted: "#BDB6CC",
  chip: "#2B3150",
  chipInk: "#E9E3F5",
} as const;

export const rarityStyles: Readonly<Record<Rarity, RarityStyle>> = {
  common: {
    ...cream,
    frame: "#D8CFBD",
    band: "#2A2722",
    bandInk: "#FBF5E8",
    word: "#1E1B16",
    spot: "#2A2722",
    hatch: "rgba(60, 50, 40, 0.55)",
  },
  uncommon: {
    ...cream,
    frame: "#1F9E7A",
    band: "#1F9E7A",
    bandInk: "#FFFFFF",
    word: "#157A5E",
    spot: "#157A5E",
    hatch: "rgba(31, 158, 122, 0.6)",
  },
  rare: {
    ...cream,
    frame: "#F0603C",
    band: "#F0603C",
    bandInk: "#FFFFFF",
    word: "#D2431F",
    spot: "#C23D1B",
    hatch: "rgba(240, 96, 60, 0.6)",
  },
  precious: {
    ...cream,
    frame: "#3361E8",
    band: "#3361E8",
    bandInk: "#FFFFFF",
    word: "#2449C4",
    spot: "#2449C4",
    hatch: "rgba(51, 97, 232, 0.6)",
  },
  epic: {
    ...night,
    frame: gold,
    band: gold,
    bandInk: "#2A1D05",
    word: gold,
    spot: "#FFD978",
    hatch: "rgba(255, 210, 110, 0.6)",
    glow: "rgba(255, 210, 90, 0.6)",
  },
  legendary: {
    ...night,
    frame: iridescent,
    band: iridescent,
    bandInk: "#1B1F33",
    word: iridescent,
    spot: "#8FE6FF",
    hatch: "rgba(150, 225, 255, 0.6)",
    glow: "rgba(150, 225, 255, 0.55)",
  },
};

/**
 * Font families, all under the SIL Open Font License. Each platform loads the files itself
 * (next/font on the web, expo-font on mobile).
 */
export const fonts = {
  /** The word and titles. Always weight 900 with the SOFT axis at 100. */
  display: { family: "Fraunces", weight: 900, soft: 100 },
  /** Labels, buttons, numbers. */
  ui: { family: "Bricolage Grotesque", weights: [500, 600, 700, 800] },
  /** Definition and quote. */
  text: { family: "Newsreader", weights: [400, 500] },
} as const;

export const radii = {
  card: 16,
  cardInner: 10,
  envelope: 14,
  chip: 8,
  pill: 999,
} as const;

/** Spacing scale in px. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** The reference card is drawn at this size; smaller cards are scaled from it. */
export const cardSize = { width: 300, height: 420 } as const;

/** Durations in ms. Screens skip them when the player asks for reduced motion. */
export const motion = {
  sealBreak: 700,
  envelopeOpen: 1150,
  cardReveal: 550,
  glow: 1200,
} as const;
