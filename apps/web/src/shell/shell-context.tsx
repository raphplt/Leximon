"use client";

import { createContext, useContext } from "react";

/** What any game screen can open over itself, whatever the platform layout. */
export interface Shell {
  /** The coffret of `level`, or of the lowest level waiting; the level road when none waits. */
  openCoffret(level?: number): void;
  openSettings(): void;
  openMail(): void;
}

export const ShellContext = createContext<Shell>({
  openCoffret: () => undefined,
  openSettings: () => undefined,
  openMail: () => undefined,
});

export function useShell(): Shell {
  return useContext(ShellContext);
}
