"use client";

import { createContext, useContext } from "react";

/** What any game screen can open over itself, whatever the platform layout. */
export interface Shell {
  /** The coffret of `level`, or of the lowest level waiting; the level road when none waits. */
  openCoffret(level?: number): void;
  /** The welcome week. */
  openWelcome(): void;
  /** What waits in « Récompenses »: today's day of the welcome week first, then the coffrets. */
  openRewards(): void;
  /** Spending écus on a missing word, from `collectionId` when given. */
  openMissingWord(collectionId?: string): void;
  openSettings(): void;
  openMail(): void;
  /** The clan's discussion in a panel. */
  openChat(): void;
  /**
   * The sheet of a card, from any screen that shows one. `among`: the cards shown with it, in
   * their order, to turn from one to the next without closing the sheet.
   */
  openCard(cardId: string, among?: readonly string[]): void;
}

export const ShellContext = createContext<Shell>({
  openCoffret: () => undefined,
  openWelcome: () => undefined,
  openRewards: () => undefined,
  openMissingWord: () => undefined,
  openSettings: () => undefined,
  openMail: () => undefined,
  openChat: () => undefined,
  openCard: () => undefined,
});

export function useShell(): Shell {
  return useContext(ShellContext);
}
