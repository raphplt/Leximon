"use client";

import { type HoloLight, holoFromOrientation, holoFromPointer } from "@leximon/view-model";
import { type PointerEvent, useCallback, useEffect, useRef } from "react";

/** After a pointer move, the phone's tilt waits this long before taking the light back. */
const POINTER_PRIORITY_MS = 1500;
const HOLO_VARIABLES = ["--holo-x", "--holo-y", "--holo-rx", "--holo-ry"] as const;

/**
 * Feeds the light of a held card (`--holo-x`, `--holo-y`, `--holo-rx`, `--holo-ry`) to the
 * element behind `ref`, from the pointer, or from the phone's tilt where the browser gives it
 * without asking (Android). Written straight to the element's style: a moving finger must not
 * re-render React 60 times a second. Until the first move, the card's own idle drift runs.
 */
export function useHoloLight(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const lastPointer = useRef(0);

  const apply = useCallback((light: HoloLight) => {
    const element = ref.current;
    if (element === null) return;
    element.dataset["holo"] = "live";
    element.style.setProperty("--holo-x", `${light.x.toFixed(1)}%`);
    element.style.setProperty("--holo-y", `${light.y.toFixed(1)}%`);
    element.style.setProperty("--holo-rx", `${light.rotateX.toFixed(2)}deg`);
    element.style.setProperty("--holo-ry", `${light.rotateY.toFixed(2)}deg`);
  }, []);

  // The light goes back to its rest: left as the pointer last set it, the card or the pouch
  // would keep leaning towards a pointer that has gone.
  const rest = useCallback(() => {
    const element = ref.current;
    if (element === null) return;
    element.dataset["holo"] = "idle";
    for (const name of HOLO_VARIABLES) element.style.removeProperty(name);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      if (performance.now() - lastPointer.current < POINTER_PRIORITY_MS) return;
      apply(holoFromOrientation(event.beta, event.gamma));
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [enabled, apply]);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const element = ref.current;
      if (!enabled || element === null) return;
      const box = element.getBoundingClientRect();
      lastPointer.current = performance.now();
      apply(
        holoFromPointer(event.clientX - box.left, event.clientY - box.top, box.width, box.height),
      );
    },
    [enabled, apply],
  );

  return { ref, onPointerMove, onPointerLeave: rest };
}
