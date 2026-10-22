import type { IconName } from "@/ui/icon";

export type TabId = "jouer" | "album" | "defis" | "echanges" | "clan";

/** The five places of the game, in the order of the web top bar. */
export const TABS: readonly { id: TabId; href: string; label: string; icon: IconName }[] = [
  { id: "jouer", href: "/jouer", label: "Jouer", icon: "sachet" },
  { id: "album", href: "/album", label: "Album", icon: "album" },
  { id: "defis", href: "/defis", label: "Défis", icon: "defi" },
  { id: "echanges", href: "/echanges", label: "Échanges", icon: "echange" },
  { id: "clan", href: "/clan", label: "Clan", icon: "clan" },
];

/** Phones: Jouer in the middle, raised. */
export const PHONE_ORDER: readonly TabId[] = ["album", "defis", "jouer", "echanges", "clan"];

export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
