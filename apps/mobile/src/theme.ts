import {
  alpha,
  bookRadii,
  colors as currentLook,
  radii as currentRadii,
  fontSizes,
  livreDay,
  livreNight,
  type Palette,
  space,
} from "@leximon/tokens";
import { parseThemeChoice, resolveTheme, type ThemeChoice } from "@leximon/view-model";
import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";

export { alpha, fontSizes, space };

const THEME_KEY = "leximon_theme";

/** « Le Livre » stays out of the published app until the switch. */
export const SHOWS_THEME_CHOICE = process.env.EXPO_PUBLIC_LOOK === "livre";

export function readThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(SecureStore.getItem(THEME_KEY));
  } catch {
    return "device";
  }
}

export function writeThemeChoice(choice: ThemeChoice): void {
  SecureStore.setItemAsync(THEME_KEY, choice).catch(() => {
    // Not remembered: the next launch follows the device.
  });
}

function startingTheme(): "light" | "dark" {
  // The current look is dark whatever the phone: its native dialogs and keyboard must stay so.
  if (!SHOWS_THEME_CHOICE) {
    Appearance.setColorScheme("dark");
    return "dark";
  }
  return resolveTheme(readThemeChoice(), Appearance.getColorScheme() === "dark");
}

/**
 * Read once, before any screen's style sheet is made from it: the theme holds until the next
 * launch, so that hundreds of static styles need no rebuilding when it changes.
 */
export const theme = startingTheme();

function startingColors(): Palette {
  if (!SHOWS_THEME_CHOICE) return currentLook;
  return theme === "dark" ? livreNight : livreDay;
}

export const colors = startingColors();

export const radii = SHOWS_THEME_CHOICE ? bookRadii : currentRadii;

/** What stays a circle in every look: an avatar, a dot, a round handle. */
export const ROUND = 999;

/**
 * Font families embedded at build time (expo-font plugin): one static instance per weight, named
 * by its PostScript name, so no `fontWeight` is set alongside them.
 */
export const cardFonts = {
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

const bookFonts = {
  display: "LeximonCanon-Regular",
  displayBold: "LeximonCanon-Regular",
  ui: {
    medium: "Spectral-Medium",
    semibold: "Spectral-SemiBold",
    bold: "Spectral-SemiBold",
    extrabold: "Spectral-SemiBold",
  },
  text: {
    regular: "Spectral-Regular",
    medium: "Spectral-Medium",
    italic: "Spectral-Italic",
  },
} as const;

/** The interface's fonts. Cards, sachets and rarity marks keep `cardFonts` in every look. */
export const fonts = SHOWS_THEME_CHOICE ? bookFonts : cardFonts;
