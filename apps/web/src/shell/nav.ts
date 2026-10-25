import { TAB_LABELS, TAB_ORDER, type TabId } from "@leximon/view-model";
import type { IconName } from "@/ui/icon";

export type { TabId };

const ROUTES: Readonly<Record<TabId, { href: string; icon: IconName }>> = {
  jouer: { href: "/jouer", icon: "sachet" },
  album: { href: "/album", icon: "album" },
  defis: { href: "/defis", icon: "defi" },
  echanges: { href: "/echanges", icon: "echange" },
  clan: { href: "/clan", icon: "clan" },
};

/** The five places of the game, in the order of the web top bar. */
export const TABS: readonly { id: TabId; href: string; label: string; icon: IconName }[] =
  TAB_ORDER.map((id) => ({ id, label: TAB_LABELS[id], ...ROUTES[id] }));

export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
