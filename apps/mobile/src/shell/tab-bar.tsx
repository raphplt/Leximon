import type { TabId } from "@leximon/view-model";

/** The route of each tab in `app/(tabs)`. */
export const TAB_ROUTES: Readonly<Record<TabId, string>> = {
  jouer: "index",
  album: "album",
  defis: "defis",
  echanges: "echanges",
  clan: "clan",
};

/** What a screen keeps clear at its foot, above the shelf of tabs. */
export const TAB_BAR_RISE = 30;
