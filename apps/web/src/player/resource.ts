"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Player state shared by every screen of the page (wallet, coffrets, account): read once from the
 * API, then replaced by what actions return (`publish`), without another request. The server
 * stays the authority: this is only the freshest copy the client has.
 */
export interface SharedResource<T> {
  publish(value: T): void;
  /** Reads it again from the API, e.g. once a refill is due. */
  refresh(): void;
  current(): T | null;
  /** Reads it if it was never read, or failed last time. */
  ensure(): void;
  subscribe(listener: () => void): () => void;
}

export function sharedResource<T>(load: () => Promise<T>): SharedResource<T> {
  let value: T | null = null;
  let loading: Promise<void> | null = null;
  let stale = true;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };
  const fetchIt = () => {
    if (loading !== null) return;
    stale = false;
    loading = load()
      .then((loaded) => {
        value = loaded;
        emit();
      })
      .catch(() => {
        // Left as it was; the next screen that mounts tries again.
        stale = true;
      })
      .finally(() => {
        loading = null;
      });
  };

  return {
    publish(next) {
      value = next;
      stale = false;
      emit();
    },
    refresh() {
      stale = true;
      fetchIt();
    },
    current: () => value,
    ensure() {
      if (stale) fetchIt();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The resource's value, `null` until known; reading it starts the first request. */
export function useShared<T>(resource: SharedResource<T>): T | null {
  useEffect(() => resource.ensure(), [resource]);
  return useSyncExternalStore(resource.subscribe, resource.current, () => null);
}
