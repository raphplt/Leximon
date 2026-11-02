import { revealSheen } from "@leximon/tokens";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { Lettering } from "@/ui/toy";

const RAY_COUNT = 14;

/** Wedges from the center to the edge of a 200 box, every other one left empty. */
const RAYS = Array.from({ length: RAY_COUNT }, (_, index) => {
  const step = (Math.PI * 2) / RAY_COUNT;
  const start = index * step;
  const end = start + step * 0.45;
  const point = (angle: number) => `${100 + Math.cos(angle) * 100} ${100 + Math.sin(angle) * 100}`;
  return `M 100 100 L ${point(start)} L ${point(end)} Z`;
}).join(" ");

function square(size: number) {
  return { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 };
}

/**
 * Rays turning slowly behind a card of the highest rarities. They open with a spring when
 * `shown` turns true and stay until it turns false.
 */
export function Rays({
  size,
  color,
  shown,
}: {
  readonly size: number;
  readonly color: string;
  readonly shown: boolean;
}) {
  const reduced = useReducedMotion();
  const open = useSharedValue(0);
  const turn = useSharedValue(0);
  useEffect(() => {
    open.value = shown ? withSpring(1, { damping: 12, stiffness: 140 }) : withTiming(0);
    if (shown && !reduced) {
      turn.value = 0;
      turn.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1);
    }
  }, [shown, reduced, open, turn]);
  const style = useAnimatedStyle(() => ({
    opacity: open.value * 0.55,
    transform: [{ scale: 0.3 + 0.7 * open.value }, { rotate: `${turn.value * 360}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.centered, square(size), style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="rays" cx="100" cy="100" r="100" gradientUnits="userSpaceOnUse">
            <Stop offset="0.15" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={RAYS} fill="url(#rays)" />
      </Svg>
    </Animated.View>
  );
}

/** A light behind a card, in its rarity's color, while it is announced and once it shows. */
export function Aura({
  size,
  color,
  strength,
}: {
  readonly size: number;
  readonly color: string;
  /** 0 for none, 1 for full. */
  readonly strength: number;
}) {
  const reduced = useReducedMotion();
  const level = useSharedValue(0);
  const breath = useSharedValue(0);
  useEffect(() => {
    level.value = withTiming(strength, { duration: 350 });
  }, [strength, level]);
  useEffect(() => {
    if (reduced) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduced, breath]);
  const style = useAnimatedStyle(() => ({
    opacity: level.value * (0.75 + 0.25 * breath.value),
    transform: [{ scale: 0.9 + 0.1 * breath.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.centered, square(size), style]}>
      {/* An animated view drops a gradient given inline: a plain one inside carries it. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundImage: `radial-gradient(ellipse 50% 50% at 50% 50%, ${color}, transparent)` },
        ]}
      />
    </Animated.View>
  );
}

/**
 * The rarity's name stamped over the card: it falls from large, settles, holds, then rises
 * away. A new `stamp` plays it again.
 */
export function RarityBanner({
  text,
  color,
  stamp,
}: {
  readonly text: string;
  readonly color: string;
  readonly stamp: number;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const shown = useSharedValue(0);
  useEffect(() => {
    if (stamp === 0) return;
    scale.value = reduced
      ? 1
      : withSequence(
          withTiming(2.4, { duration: 0 }),
          withTiming(0.92, { duration: 220, easing: Easing.out(Easing.quad) }),
          withTiming(1.04, { duration: 140 }),
          withTiming(1, { duration: 120 }),
        );
    shown.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(1500, withTiming(0, { duration: 400 })),
    );
  }, [stamp, reduced, scale, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: -16 * (1 - shown.value) }, { scale: scale.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.banner, style]}>
      <Lettering size={40} color={color}>
        {text}
      </Lettering>
    </Animated.View>
  );
}

/**
 * A band of light sweeping across a card's face as it settles. A new `sweep` plays it again;
 * the face must clip it.
 */
export function Sheen({ width, sweep }: { readonly width: number; readonly sweep: number }) {
  const reduced = useReducedMotion();
  const place = useSharedValue(-1);
  useEffect(() => {
    if (sweep === 0 || reduced) return;
    place.value = withSequence(
      withTiming(-1, { duration: 0 }),
      withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }),
    );
  }, [sweep, reduced, place]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: place.value * width * 1.4 }, { rotate: "20deg" }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.sheen, style]} />;
}

const styles = StyleSheet.create({
  centered: { position: "absolute", left: "50%", top: "50%" },
  banner: { position: "absolute", left: -40, right: -40, top: "38%", alignItems: "center" },
  sheen: {
    position: "absolute",
    top: "-30%",
    bottom: "-30%",
    left: "35%",
    width: "30%",
    backgroundImage: `linear-gradient(90deg, transparent 0%, ${revealSheen} 50%, transparent 100%)`,
  },
});
