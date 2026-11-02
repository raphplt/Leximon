import { useSyncExternalStore } from "react";
import { isLibraryLook } from "./look";

function stillTheSame(): () => void {
  return () => undefined;
}

/**
 * Whether this browser shows « La Bibliothèque ». The server cannot know: its first render is in
 * the current look, then the screen takes the right one as soon as it runs in the browser.
 */
export function useLibraryLook(): boolean {
  return useSyncExternalStore(stillTheSame, isLibraryLook, () => false);
}
