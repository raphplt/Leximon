"use client";

import type { Progress } from "@leximon/contract";
import { useEffect, useSyncExternalStore } from "react";
import { fetchProgress } from "@/lib/api";

/**
 * The player's level, shared by every screen of the page: read once from the API, then updated
 * from the answers of the actions that earn XP (`publishProgress`), without another request.
 */

let current: Progress | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** The progress returned by an action (open, answer): the freshest the client has. */
export function publishProgress(progress: Progress): void {
  current = {
    xp: progress.xp,
    level: progress.level,
    xpIntoLevel: progress.xpIntoLevel,
    xpForNextLevel: progress.xpForNextLevel,
  };
  emit();
}

/** The player changed (sign-in): the next screen reads the account's level afresh. */
export function forgetProgress(): void {
  current = null;
  emit();
  load();
}

function load(): void {
  if (current !== null || loading !== null) return;
  loading = fetchProgress()
    .then((progress) => {
      // An action may have answered meanwhile, with a more recent total.
      if (current === null || current.xp < progress.xp) publishProgress(progress);
    })
    .catch(() => {
      // The badge stays hidden; the next screen that mounts tries again.
    })
    .finally(() => {
      loading = null;
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `null` until known. */
export function useProgress(): Progress | null {
  useEffect(load, []);
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
