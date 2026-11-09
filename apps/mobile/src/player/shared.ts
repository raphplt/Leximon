import type { SharedResource } from "@leximon/view-model";
import { useEffect, useState, useSyncExternalStore } from "react";

/** The resource's value, `null` until known; reading it starts the first request. */
export function useShared<T>(resource: SharedResource<T>): T | null {
  useEffect(() => resource.ensure(), [resource]);
  return useSyncExternalStore(resource.subscribe, resource.current);
}

/** The same, read only once `wanted`: what the player cannot use yet costs no request. */
export function useSharedWhen<T>(resource: SharedResource<T>, wanted: boolean): T | null {
  useEffect(() => {
    if (wanted) resource.ensure();
  }, [resource, wanted]);
  const value = useSyncExternalStore(resource.subscribe, resource.current);
  return wanted ? value : null;
}

/** Whether the resource could not be read: a screen waiting for it offers to try again. */
export function useSharedFailed<T>(resource: SharedResource<T>): boolean {
  return useSyncExternalStore(resource.subscribe, resource.failed);
}

/** Current time, refreshed every `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
