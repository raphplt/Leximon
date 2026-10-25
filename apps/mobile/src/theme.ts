import { colors } from "@leximon/tokens";

export { colors };

/**
 * Font families embedded at build time (expo-font plugin): one static instance per weight, named
 * by its PostScript name, so no `fontWeight` is set alongside them.
 */
export const fonts = {
  /** The word and titles: Fraunces 900, SOFT 100. */
  display: "Fraunces-Black",
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

/** The bar under the tabs, darker than the background. */
export const TAB_BAR_COLOR = "#1C2033";
