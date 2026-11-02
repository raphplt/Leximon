import { colors, type LinearGradient, type Palette } from "./tokens";

/**
 * « La Bibliothèque »: a card game played in a reading room at night. The room is the backdrop,
 * the controls are toys cut from leather and old gold, what is read lies on cream paper, and the
 * light is kept for what the player wins. One look only, whatever the device's theme.
 */
export const library: Palette = {
  ...colors,
  page: "#1C0F07",
  pageRaised: "#2C1709",
  pageInk: "#FFF4DC",
  pageInkSoft: "#EFE2C4",
  pageInkMuted: "#D2BE98",
  pageInkFaint: "#AE9A76",
  panel: "rgba(44, 23, 9, 0.78)",
  sheet: "#2C1709",
  sheetLight: "#4F2E16",
  bannerStart: "#922A34",
  bannerEnd: "#1F4D30",
  binding: "#2C1709",
  bindingDeep: "#1C0F07",
  bindingInk: "#FFF4DC",
  bindingInkMuted: "#D9C49C",
  well: "#1A0E06",
  track: "#4A3020",
  rule: "#6A4426",
  paper: "#FBECCB",
  paperInk: "#3B2414",
  paperInkMuted: "#6E5236",
  action: "#F6D47A",
  actionHover: "#FADF98",
  actionInk: "#2A1608",
  actionLight: "#F6D47A",
  actionDeep: "#D9A63A",
  actionEdge: "#A5741A",
  actionEdgeDeep: "#2A1608",
  control: "#4A3020",
  controlHover: "#5A3A26",
  controlEdge: "#1A0E06",
  xpLight: "#F6D47A",
  xpDeep: "#D9A63A",
  rubric: "#F6D47A",
  gilt: "#D9A63A",
  giltPale: "#FBEFC8",
  giltLight: "#F6D47A",
  giltDeep: "#A5741A",
  success: "#8FD0A3",
  successBright: "#9ED8AF",
  successLight: "#B2E2C0",
  successPale: "#CBEBD4",
  successDeep: "#34714A",
  successEdge: "#1F4D30",
  danger: "#F29A84",
  dangerBright: "#F27A62",
  dangerHover: "#F6B09F",
  dangerInk: "#2A0D05",
  dangerShade: "#922A34",
  dangerDeep: "#922A34",
  dangerEdge: "#5E131C",
  badge: "#B52D1C",
  bronze: "#C47D3E",
  mention: "#4A3020",
  mentionInk: "#F6D47A",
  data: "#8FB4D9",
  inkOnColor: "#FFF4DC",
  scrim: "#080300",
  dim: "#080300",
  focus: "#F6D47A",
};

/** A toy's leather or metal: its lit top, its darker bottom, and the thickness under it. */
export interface ToyMatter {
  readonly top: string;
  readonly bottom: string;
  readonly edge: string;
}

/** Old gold for the main action, a leather per function for the tiles, paper for the rest. */
export const toyMatters = {
  gold: { top: "#F6D47A", bottom: "#D9A63A", edge: "#A5741A" },
  red: { top: "#C25058", bottom: "#922A34", edge: "#5E131C" },
  green: { top: "#5C9A6B", bottom: "#34714A", edge: "#1F4D30" },
  blue: { top: "#5A7CB8", bottom: "#344F8F", edge: "#1D3263" },
  paper: { top: "#FBECCB", bottom: "#EAD2A0", edge: "#BF9C5E" },
  /** A closed control: grey, so that what is open stands out. */
  locked: { top: "#AAA397", bottom: "#857E72", edge: "#5C564C" },
  /** The red of a count waiting for the player. */
  alert: { top: "#E2513C", bottom: "#B52D1C", edge: "#7A1608" },
  /** A small tag under a control, such as a level to reach. */
  dark: { top: "#4A3020", bottom: "#3A2416", edge: "#24150B" },
} as const satisfies Record<string, ToyMatter>;

export type ToyMatterName = keyof typeof toyMatters;

/**
 * What every toy shares: a dark outline, a thickness that disappears when pressed, and a line of
 * light along its top.
 */
export const toy = {
  outline: "#2A1608",
  outlineWidth: 2.5,
  edge: { small: 4, large: 6 },
  /** The lip of the bottom half, inside the toy. */
  lip: { small: 3, large: 5 },
  sheen: "rgba(255, 255, 255, 0.4)",
  /** A fine gilt rule inside a tile. */
  innerRule: "rgba(255, 228, 160, 0.45)",
  /** The shadow a toy drops on the desk. */
  drop: "rgba(0, 0, 0, 0.35)",
} as const;

/** Corners of the toys: a tag, a small toy, a tile, the main button. Round things stay round. */
export const toyRadii = { tag: 8, small: 14, tile: 18, large: 22 } as const;

/**
 * Cream letters with a dark outline and a short drop, for titles, buttons, figures and short
 * labels. Never for a text of more than one line: that goes on paper.
 */
export const lettering = {
  fill: "#FFF4DC",
  outline: "#2A1608",
  /** Outline width as a share of the font size, with a floor so that small labels stay crisp. */
  outlineRatio: 0.2,
  minOutline: 3,
  /** The drop under the letters, in px. */
  drop: 2,
  /** Small capitals above a title, in the gilt of the frame. */
  kicker: "#E9C06A",
} as const;

/** Old gold as a gradient: the frame of the desk, the gilt of a sachet. */
export const oldGold: LinearGradient = {
  angle: 150,
  stops: [
    ["#F6DC94", 0],
    ["#D4A447", 0.3],
    ["#8F611C", 0.52],
    ["#E9C06A", 0.72],
    ["#A87A2A", 1],
  ],
};

/** The room behind every screen, and the green leather desk in its lamplight. */
export const room = {
  /** The baked tile of shelves (scripts/bake_room.py), in px at 1x. It wraps on both sides. */
  shelves: { width: 420, height: 1016 },
  /** Under the baked image of the room, and where it does not reach. */
  floor: "#1C0F07",
  /** Warm light from the lamp, over the middle of the screen. */
  lamp: "rgba(255, 190, 110, 0.22)",
  /** The dark that closes the edges. */
  vignette: "rgba(8, 3, 0, 0.8)",
  desk: {
    center: "#2D6849",
    middle: "#1A4631",
    edge: "#0D2A1C",
    frameWidth: 6,
    /** The gilt rule inside the frame, and its distance from it. */
    rule: "rgba(232, 190, 100, 0.45)",
    ruleInset: 9,
    radius: 26,
    /** The shade the frame casts inward. */
    hollow: "rgba(0, 0, 0, 0.6)",
  },
  /** The bar of the tabs: a shelf of dark wood edged with gold. */
  shelf: { top: "#4F2E16", bottom: "#2C1709", gilt: "#D4A447", giltShade: "#5E3A10" },
} as const;

/** The cloth of a sachet, one per collection tone (`backTones`): light, middle and dark. */
export const sachetCloths = {
  night: ["#34479A", "#18215A", "#0B1033"],
  burgundy: ["#A3253F", "#6A1023", "#33040F"],
  green: ["#2F8A5C", "#165238", "#082A1B"],
} as const satisfies Record<string, readonly [string, string, string]>;

/**
 * Curves as CSS cubic-béziers, which Reanimated's `Easing.bezier` reads too. `overshoot` lets what
 * appears go a little past its place, `land` throws what arrives harder, `leave` speeds up as it goes.
 */
export const easings = {
  overshoot: [0.34, 1.56, 0.64, 1],
  land: [0.2, 1.9, 0.4, 1],
  leave: [0.5, 0, 0.9, 0.6],
  settle: [0.1, 0.7, 0.3, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** A toy sinks by its thickness under the finger, then springs back as it is released. */
export const press = {
  sinkMs: 80,
  springMs: 420,
  scales: [0.9, 1.07, 0.98, 1],
  /** A short buzz, in ms, where the device allows it. */
  vibration: 6,
} as const;

/** The life at rest of the Jouer screen, in ms. */
export const idle = {
  /** The main button invites a press, once per period. */
  inviteMs: 3000,
  /** A count waiting for the player nudges, once per period. */
  nudgeMs: 2600,
  /** The sachet floats up and down. */
  floatMs: 3600,
  /** A sheen crosses the sachet. */
  sheenMs: 4200,
} as const;
