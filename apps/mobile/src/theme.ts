import { alpha, colors, fontSizes, radii, space } from "@leximon/tokens";

export { alpha, colors, fontSizes, radii, space };

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
