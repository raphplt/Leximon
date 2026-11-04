import { alpha, colors, fontSizes, type Palette, radii, space, toyMatters } from "@leximon/tokens";

export { alpha, colors, fontSizes, type Palette, radii, space };

/** The same roles on a leaf of paper: everything reads in brown ink. */
export const paperColors: Palette = {
  ...colors,
  page: colors.paper,
  pageRaised: toyMatters.paper.bottom,
  pageInk: colors.paperInk,
  pageInkSoft: alpha(colors.paperInk, 0.85),
  pageInkMuted: colors.paperInkMuted,
  pageInkFaint: alpha(colors.paperInkMuted, 0.7),
  panel: toyMatters.paper.top,
  rule: alpha(colors.paperInk, 0.22),
  well: alpha(toyMatters.paper.bottom, 0.7),
  track: toyMatters.paper.bottom,
  control: toyMatters.paper.bottom,
  controlHover: toyMatters.paper.edge,
  rubric: toyMatters.red.bottom,
  gilt: toyMatters.gold.edge,
  success: colors.successDeep,
  danger: colors.dangerDeep,
};

/** A switch's track, off and on, and its knob: a dark groove, green when on. */
export const switchColors = {
  off: toyMatters.dark.bottom,
  on: toyMatters.green.top,
  knob: toyMatters.paper.top,
};

/**
 * Font families embedded at build time (expo-font plugin): one static instance per weight, named
 * by its PostScript name, so no `fontWeight` is set alongside them.
 */
export const fonts = {
  /** The word and titles: Fraunces 900, SOFT 100. */
  display: "Fraunces-Black",
  /** The sachet's print: Fraunces 800, SOFT 100. */
  displayBold: "Fraunces-ExtraBold",
  ui: {
    medium: "BricolageGrotesque-Medium",
    semibold: "BricolageGrotesque-SemiBold",
    bold: "BricolageGrotesque-Bold",
    extrabold: "BricolageGrotesque-ExtraBold",
  },
  text: {
    regular: "Newsreader-Regular",
    medium: "Newsreader-Medium",
    italic: "Newsreader-Italic",
  },
} as const;
