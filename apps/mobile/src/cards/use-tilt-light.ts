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

/** About 50 readings a second: smooth under the eye, light on the battery. */
const READING_MS = 20;
const TURN = { duration: 100, easing: Easing.linear } as const;
const DEGREES = 180 / Math.PI;

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
        subscription = DeviceMotion.addListener(({ rotation }) => {
          // Radians, with the web's conventions: `beta` front to back, `gamma` side to side.
          if (rotation == null) return;
          const next = holoFromOrientation(rotation.beta * DEGREES, rotation.gamma * DEGREES);
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
