import {
  alpha,
  colors as currentLook,
  fontSizes,
  library,
  radii,
  space,
  toyMatters,
} from "@leximon/tokens";

export { alpha, fontSizes, radii, space };

/** « La Bibliothèque » stays out of the published app until the switch: a build turns it on. */
export const IS_LIBRARY = process.env.EXPO_PUBLIC_LOOK === "bibliotheque";

export const colors = IS_LIBRARY ? library : currentLook;

/** The same roles on a leaf of paper in « La Bibliothèque »: everything reads in brown ink. */
export const paperColors: typeof colors = IS_LIBRARY
  ? {
      ...library,
      page: library.paper,
      pageRaised: toyMatters.paper.bottom,
      pageInk: library.paperInk,
      pageInkSoft: alpha(library.paperInk, 0.85),
      pageInkMuted: library.paperInkMuted,
      pageInkFaint: alpha(library.paperInkMuted, 0.7),
      panel: toyMatters.paper.top,
      rule: alpha(library.paperInk, 0.22),
      well: alpha(toyMatters.paper.bottom, 0.7),
      track: toyMatters.paper.bottom,
      control: toyMatters.paper.bottom,
      controlHover: toyMatters.paper.edge,
      rubric: toyMatters.red.bottom,
      gilt: toyMatters.gold.edge,
      success: library.successDeep,
      danger: library.dangerDeep,
    }
  : currentLook;

/** A switch's track, off and on, and its knob: a dark groove, green when on, in « La Bibliothèque ». */
export const switchColors = IS_LIBRARY
  ? { off: toyMatters.dark.bottom, on: toyMatters.green.top, knob: toyMatters.paper.top }
  : { off: currentLook.track, on: currentLook.success, knob: currentLook.pageInk };

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
