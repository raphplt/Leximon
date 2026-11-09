"use client";

import type { SharedResource } from "@leximon/view-model";
import { useEffect, useSyncExternalStore } from "react";

/** The resource's value, `null` until known; reading it starts the first request. */
export function useShared<T>(resource: SharedResource<T>): T | null {
  useEffect(() => resource.ensure(), [resource]);
  return useSyncExternalStore(resource.subscribe, resource.current, () => null);
}

/** The same, read only once `wanted`: what the player cannot use yet costs no request. */
export function useSharedWhen<T>(resource: SharedResource<T>, wanted: boolean): T | null {
  useEffect(() => {
    if (wanted) resource.ensure();
  }, [resource, wanted]);
  const value = useSyncExternalStore(resource.subscribe, resource.current, () => null);
  return wanted ? value : null;
}

/**
 * Whether the resource could not be read. A screen still waiting for its first value shows the
 * failure and offers `ensure` to try again, rather than waiting forever.
 */
export function useSharedFailed<T>(resource: SharedResource<T>): boolean {
  return useSyncExternalStore(resource.subscribe, resource.failed, () => false);
}
