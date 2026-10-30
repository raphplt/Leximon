import { holoFromOrientation } from "@leximon/view-model";
import { DeviceMotion } from "expo-sensors";
import { useEffect } from "react";
import {
  Easing,
  type SharedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** About 30 readings a second, eased between them: smooth under the eye, light on the JS thread. */
const READING_MS = 33;
const TURN = { duration: 100, easing: Easing.linear } as const;
const DEGREES = 180 / Math.PI;
/** In % of the card: the light never needs finer, and a held phone's tremor stays below it. */
const LIGHT_STEP = 0.25;

/**
 * The light on a step of its own: redrawing an SVG is what costs, so a foil is drawn again only
 * when the light has really moved, about 20 times a second instead of on every frame.
 */
export function steppedLight(value: number): number {
  "worklet";
  return Math.round(value / LIGHT_STEP) * LIGHT_STEP;
}

/** The light of a held card or pouch, from the phone's tilt. */
export interface TiltLight {
  /** 0 until the sensor gives a first reading, easing to 1: until then, the drift goes on. */
  readonly held: SharedValue<number>;
  /** Where the light falls, in % of the card. */
  readonly x: SharedValue<number>;
  readonly y: SharedValue<number>;
  /** In degrees. */
  readonly rotateX: SharedValue<number>;
  readonly rotateY: SharedValue<number>;
}

/**
 * Follows the phone's tilt while `enabled`, like the web on Android. Disabled, the light keeps
 * its last place. Nothing listens with « reduce motion » on, or on a phone without the sensor.
 */
export function useTiltLight(enabled: boolean): TiltLight {
  const reduced = useReducedMotion();
  const light: TiltLight = {
    held: useSharedValue(0),
    x: useSharedValue(50),
    y: useSharedValue(50),
    rotateX: useSharedValue(0),
    rotateY: useSharedValue(0),
  };
  const { held, x, y, rotateX, rotateY } = light;

  useEffect(() => {
    if (!enabled || reduced) return;
    let subscription: { remove: () => void } | null = null;
    let stopped = false;
    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!available || stopped) return;
        DeviceMotion.setUpdateInterval(READING_MS);
        let last = { x: Number.NaN, y: Number.NaN };
        subscription = DeviceMotion.addListener(({ rotation }) => {
          // Radians, with the web's conventions: `beta` front to back, `gamma` side to side.
          if (rotation == null) return;
          const next = holoFromOrientation(rotation.beta * DEGREES, rotation.gamma * DEGREES);
          if (Math.abs(next.x - last.x) < LIGHT_STEP && Math.abs(next.y - last.y) < LIGHT_STEP) {
            return;
          }
          last = next;
          x.value = next.x;
          y.value = next.y;
          rotateX.value = withTiming(next.rotateX, TURN);
          rotateY.value = withTiming(next.rotateY, TURN);
          if (held.value === 0) held.value = withTiming(1, { duration: 400 });
        });
      })
      // No sensor to read: the drift stays, as on a computer.
      .catch(() => undefined);
    return () => {
      stopped = true;
      subscription?.remove();
    };
  }, [enabled, reduced, held, x, y, rotateX, rotateY]);

  return light;
}
