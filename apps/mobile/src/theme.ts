import { alpha, colors as currentLook, fontSizes, library, radii, space } from "@leximon/tokens";

export { alpha, fontSizes, radii, space };

/** « La Bibliothèque » stays out of the published app until the switch: a build turns it on. */
export const IS_LIBRARY = process.env.EXPO_PUBLIC_LOOK === "bibliotheque";

export const colors = IS_LIBRARY ? library : currentLook;

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
