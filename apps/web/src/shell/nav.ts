import { COMMUNITY_PATH, TAB_LABELS, TAB_ORDER, type TabId } from "@leximon/view-model";

const HREFS: Readonly<Record<TabId, string>> = {
  jouer: "/jouer",
  album: "/album",
  defis: "/defis",
  echanges: "/echanges",
  clan: "/clan",
};

/** The five places of the game, in the order of the web top bar. */
export const TABS: readonly { id: TabId; href: string; label: string }[] = TAB_ORDER.map((id) => ({
  id,
  label: TAB_LABELS[id],
  href: HREFS[id],
}));

/**
 * The community tab opens on the clan and also holds the friends and the lists; Défis holds the
 * training and the jousts.
 */
const TAB_PATHS: Readonly<Record<string, readonly string[]>> = {
  "/clan": ["/clan", "/amis", COMMUNITY_PATH],
  "/defis": ["/defis", "/joutes"],
};

export function isCurrent(pathname: string, href: string): boolean {
  const paths = TAB_PATHS[href] ?? [href];
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
