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

/**
 * « La Bibliothèque »: a card game played in a reading room at night. The room is the backdrop,
 * the controls are toys cut from leather and old gold, what is read lies on cream paper, and the
 * light is kept for what the player wins. One look only, whatever the device's theme.
 *
 * Colors by role, not by value: a screen says what a surface is (a page, the binding, a rule).
 * Translucent variants derive from a role: `alpha()` here, `color-mix()` in CSS.
 */
export const colors = {
  /** Screen background: the reading room at night, so that every rarity color stands out. */
  page: "#1C0F07",
  pageRaised: "#2C1709",
  /** Text and icons on the page. */
  pageInk: "#FFF4DC",
  pageInkSoft: "#EFE2C4",
  pageInkMuted: "#D2BE98",
  pageInkFaint: "#AE9A76",
  /** Panels on the page, slightly see-through. */
  panel: "rgba(44, 23, 9, 0.78)",
  /** Side panels, bottom sheets and dialogs. */
  sheet: "#2C1709",
  /** Top of a dialog's gradient. */
  sheetLight: "#4F2E16",
  /** The gradient of a profile's or a clan's banner. */
  bannerStart: "#922A34",
  bannerEnd: "#1F4D30",
  /** What holds the game: the bars of the shell and their menus, darker than the page. */
  binding: "#2C1709",
  /** The last strip of the binding, under the tabs. */
  bindingDeep: "#1C0F07",
  bindingInk: "#FFF4DC",
  bindingInkMuted: "#D9C49C",
  /** Hollow of a progress bar. */
  well: "#1A0E06",
  /** Unfilled part of a ring or a road. */
  track: "#4A3020",
  /** Thin lines and empty markers (stock dots, missing cards) on the page. */
  rule: "#6A4426",
  /** The cream paper a card, a road or a leaf of reading is printed on. */
  paper: "#FBECCB",
  paperInk: "#3B2414",
  paperInkMuted: "#6E5236",
  /** Main call to action. */
  action: "#F6D47A",
  actionHover: "#FADF98",
  actionInk: "#2A1608",
  /** The dome of the central tab: its lit side and its shaded side. */
  actionLight: "#F6D47A",
  actionDeep: "#D9A63A",
  /** Thickness under the main action, then under the central tab. */
  actionEdge: "#A5741A",
  actionEdgeDeep: "#2A1608",
  /** Secondary actions and their thickness. */
  control: "#4A3020",
  controlHover: "#5A3A26",
  controlEdge: "#1A0E06",
  /** The filled part of an XP bar, top to bottom. */
  xpLight: "#F6D47A",
  xpDeep: "#D9A63A",
  /** What the eye must catch in a text: a figure, a current tab, a link. */
  rubric: "#F6D47A",
  /** Gold in a thin line or a highlight, and its lights: the first glows, the last lies flat. */
  gilt: "#D9A63A",
  giltPale: "#FBEFC8",
  giltLight: "#F6D47A",
  giltDeep: "#A5741A",
  /** Done, received: a claimed level, a switch on. */
  success: "#8FD0A3",
  successBright: "#9ED8AF",
  successLight: "#B2E2C0",
  successPale: "#CBEBD4",
  /** Fill of a right answer, and the thickness under it. */
  successDeep: "#34714A",
  successEdge: "#1F4D30",
  /** Destructive actions on dark: sign out, block. */
  danger: "#F29A84",
  dangerBright: "#F27A62",
  dangerHover: "#F6B09F",
  dangerInk: "#2A0D05",
  /** Thickness under the button that destroys. */
  dangerShade: "#922A34",
  /** Fill of a wrong answer, and the thickness under it. */
  dangerDeep: "#922A34",
  dangerEdge: "#5E131C",
  /** Red counts of what waits for the player. */
  badge: "#B52D1C",
  /** The third step of a podium. */
  bronze: "#C47D3E",
  /** A player named in the clan's discussion: the bubble, then the name. */
  mention: "#4A3020",
  mentionInk: "#F6D47A",
  /** Figures of the admin charts. */
  data: "#8FB4D9",
  /** Text on a saturated fill. */
  inkOnColor: "#FFF4DC",
  /** A light that catches an edge, and the dark that falls behind a floating surface. */
  glint: "#FFFFFF",
  shade: "#000000",
  /** Behind a dialog or a sheet. */
  scrim: "#080300",
  /** Behind a card being revealed. */
  dim: "#080300",
  /** The kraft envelope of a booster and its wax seal. */
  kraft: "#D9B486",
  kraftInk: "#5A3D18",
  kraftTitle: "#2A1D0C",
  seal: "#E2431D",
  sealLight: "#FF7A55",
  sealDark: "#A82B0E",
  sealInk: "#8C2208",
  sticker: "#F0603C",
  focus: "#F6D47A",
} as const;

/** Every role, with its value. */
export type Palette = Readonly<Record<keyof typeof colors, string>>;

/** A `#RRGGBB` role at the given opacity, from 0 to 1. */
export function alpha(color: string, opacity: number): string {
  const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Written as CSS `box-shadow` values, which React Native reads too. */
export function shadowsOf(palette: Palette) {
  return {
    /** The thickness of what can be pressed, high then low, then pressed down. */
    action: `0 4px 0 ${palette.actionEdge}`,
    actionLow: `0 3px 0 ${palette.actionEdge}`,
    actionPressed: `0 1px 0 ${palette.actionEdge}`,
    control: `0 5px 0 ${palette.controlEdge}`,
    controlLow: `0 4px 0 ${palette.controlEdge}`,
    controlPressed: `0 2px 0 ${palette.controlEdge}`,
    /** What floats over the page, from a tooltip to a dialog. */
    raised: `0 8px 24px ${alpha(palette.shade, 0.4)}`,
    floating: `0 10px 30px ${alpha(palette.shade, 0.45)}`,
    menu: `0 20px 50px ${alpha(palette.shade, 0.5)}`,
    dialog: `0 30px 80px ${alpha(palette.shade, 0.55)}`,
    sidePanel: `-24px 0 60px ${alpha(palette.shade, 0.45)}`,
    bottomSheet: `0 -20px 60px ${alpha(palette.shade, 0.45)}`,
  } as const;
}

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
  /** The art of a card and a sachet. */
  card: 16,
  cardInner: 10,
  envelope: 14,
  chip: 8,
  /** The corners of the interface, from a tag to a full-screen panel. */
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  x3: 18,
  x4: 22,
  x5: 30,
  pill: 999,
} as const;

/** Text sizes in px. */
export const fontSizes = {
  nano: 10,
  micro: 11,
  caption: 12,
  small: 13,
  label: 14,
  body: 15,
  bodyLarge: 16,
  lead: 17,
  subtitle: 18,
  titleSmall: 20,
  title: 22,
  titleLarge: 24,
  heading: 28,
  headingLarge: 32,
  display: 40,
  displayLarge: 44,
} as const;

/** Spacing scale: a step is 2 px, so `s6` is 12 px. */
export const space = {
  s1: 2,
  s2: 4,
  s3: 6,
  s4: 8,
  s5: 10,
  s6: 12,
  s7: 14,
  s8: 16,
  s9: 18,
  s10: 20,
  s12: 24,
  s14: 28,
  s16: 32,
  s20: 40,
  s24: 48,
  s32: 64,
} as const;

/**
 * The baked tiles of paper and leather (scripts/bake_matter.py), size in px, and how far their
 * grain darkens or lightens a color at its strongest.
 */
export const matter = {
  size: 128,
  paper: { dark: "#140C06", darkest: 0.05, light: "#FFF6E2", lightest: 0.04 },
} as const;

/** The reference card is drawn at this size; smaller cards are scaled from it. */
export const cardSize = { width: 300, height: 420 } as const;

/** Cloth of a card back: its light center and dark edges. */
export interface BackTone {
  readonly light: string;
  readonly dark: string;
}

/**
 * Tones of the card back, one per collection (`back` in content/collections.toml, chosen
 * 2026-10-21). A pack shows the tone of its collection; an unknown name falls back to night.
 */
export const backTones = {
  night: { light: "#2C3459", dark: "#161A2C" },
  burgundy: { light: "#5E2130", dark: "#2A0D15" },
  green: { light: "#22493C", dark: "#0E221B" },
} as const satisfies Record<string, BackTone>;

export type BackToneName = keyof typeof backTones;

export function backTone(name: string | undefined): BackTone {
  return name !== undefined && Object.hasOwn(backTones, name)
    ? backTones[name as BackToneName]
    : backTones.night;
}

/** A word's mastery, from the dot on an album tile to the steps of its sheet. */
export const masteryColors = {
  /** A word never answered right yet: nothing drawn on the page. */
  blank: colors.pageInkFaint,
  sketch: colors.pageInkMuted,
  ink: "#7C9BFF",
  /** The ink step filled in, on a mastery ladder. */
  inkDeep: "#2449C4",
  gilded: "#FFD978",
} as const;

/** The progress bar of each launch collection (album, clan library). */
const COLLECTION_TONES: Readonly<Record<string, string>> = {
  fondateurs: "#7C9BFF",
  caracteres: "#FF8462",
  metiers: "#3BD3A5",
};

export function collectionTone(collectionId: string): string {
  return COLLECTION_TONES[collectionId] ?? colors.rubric;
}

/** Durations in ms. Screens skip them when the player asks for reduced motion. */
export const motion = {
  sealBreak: 700,
  envelopeOpen: 1150,
  cardReveal: 550,
  glow: 1200,
} as const;

/**
 * Colours of a clan's emblem, by their key in the rules: the field, then the ink of the
 * engraving. A key a newer server sends falls back on ink black. Tuned to the room: warm, a
 * little deep, so that the gold rim stands out on each.
 */
export const emblemColors = {
  sang: "#9A2232",
  or: "#D9A63A",
  indigo: "#344F8F",
  "vert-de-gris": "#5E9C8A",
  ocre: "#C67B2E",
  prune: "#6B2F5B",
  craie: "#F6E7C6",
  encre: "#231A24",
  vermillon: "#E04A30",
  turquoise: "#2FA8A0",
  argent: "#CFCAC0",
  safran: "#F2B829",
  azur: "#3A72C8",
  emeraude: "#2F8A5C",
  corail: "#EC7A5C",
  bronze: "#9C6B3A",
} as const satisfies Record<string, string>;

export function emblemColor(key: string): string {
  return Object.hasOwn(emblemColors, key)
    ? emblemColors[key as keyof typeof emblemColors]
    : emblemColors.encre;
}

/** The field of an emblem as a matter: its colour lit at the top, deeper at the point. */
export function emblemField(key: string): { readonly top: string; readonly bottom: string } {
  const base = emblemColor(key);
  return { top: mixHex(base, "#FFFFFF", 0.22), bottom: mixHex(base, "#000000", 0.28) };
}

/** Two `#RRGGBB` colours mixed, `share` of the second. */
export function mixHex(from: string, to: string, share: number): string {
  const channel = (hex: string, index: number) =>
    Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const mixed = [0, 1, 2].map((index) =>
    Math.round(channel(from, index) * (1 - share) + channel(to, index) * share)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("").toUpperCase()}`;
}

/**
 * The shield of an emblem on a 100 × 115 grid: straight top, rounded corners, a soft point. Its
 * rim is old gold outlined in ink, with its thickness under it, as the toys of the room.
 */
export const emblemShield = {
  path: "M14 0H86Q100 0 100 14V62Q100 98 50 115Q0 98 0 62V14Q0 0 14 0Z",
  width: 100,
  height: 115,
  rim: 7,
  outline: 2.4,
  depth: 5,
  /** The line of light along the top of the rim. */
  sheen: "M18 0H82",
} as const;

/** Room the drawing takes around the shield's grid: half the rim and its outline. */
export const emblemShieldPad = emblemShield.rim / 2 + emblemShield.outline;
