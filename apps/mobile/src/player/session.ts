import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import { resetCollection } from "./collection";
import { resetPlayerState } from "./state";

/**
 * Which player the screens show, counted on the device: it changes when someone signs in, signs
 * out or comes through an invitation, and every screen then starts again from scratch.
 */
let generation = 0;
const listeners = new Set<() => void>();

/** Forgets everything read for the previous player and mounts every screen again. */
export function startOver(): void {
  resetPlayerState();
  resetCollection();
  generation += 1;
  for (const listener of listeners) listener();
}

/** Back to the game as another player, with nothing left behind to go back to. */
export function playFromScratch(): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace("/");
  startOver();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes with the player: a key that remounts what depends on who plays. */
export function useSessionGeneration(): number {
  return useSyncExternalStore(subscribe, () => generation);
}
