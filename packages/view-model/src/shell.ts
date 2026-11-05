import type { EpochMs } from "@leximon/core";
import { levelsOfFeatures } from "./features";

/** The game's five places and the counts the shell shows on them. */

export type TabId = "jouer" | "album" | "defis" | "echanges" | "clan";

export const TAB_LABELS: Readonly<Record<TabId, string>> = {
  jouer: "Jouer",
  album: "Album",
  defis: "Défis",
  echanges: "Échanges",
  clan: "Communauté",
};

/** The order of the web top bar. */
export const TAB_ORDER: readonly TabId[] = ["jouer", "album", "defis", "echanges", "clan"];

/** Phones: Jouer in the middle, raised. */
export const PHONE_TAB_ORDER: readonly TabId[] = ["album", "defis", "jouer", "echanges", "clan"];

/** Which tabs a level still closes: shown with a padlock, never hidden. */
export function closedTabs(level: number | null, now: EpochMs): ReadonlySet<TabId> {
  if (level === null || now === 0) return new Set();
  return new Set(level < levelsOfFeatures(now).trade ? (["echanges"] as const) : []);
}

/** The red count on a tab: offers received on Échanges, coffrets waiting on Jouer. */
export function tabBadge(
  tab: TabId,
  counts: { readonly offers: number; readonly coffrets: number },
): number {
  if (tab === "echanges") return counts.offers;
  if (tab === "jouer") return counts.coffrets;
  return 0;
}

/**
 * The mail's count: what waits to be done (coffrets, goal sachets, friend links' sachets) and the
 * letters not read. Words slipping away are left out: they come back every day, and a count that
 * never empties only nags.
 */
export function mailCount(waiting: {
  readonly coffrets: number;
  /** 1 while a day of the welcome week waits. */
  readonly welcome: number;
  readonly goalSachets: number;
  readonly referralSachets: number;
  readonly unread: number;
}): number {
  return (
    waiting.coffrets +
    waiting.welcome +
    waiting.goalSachets +
    waiting.referralSachets +
    waiting.unread
  );
}

/** « Courrier, 3 en attente », for screen readers. */
export function mailLabel(count: number): string {
  return count > 0 ? `Courrier, ${count} en attente` : "Courrier";
}
