import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, fonts, radii } from "@/theme";

/**
 * A sticker on the corner of what holds it, such as « Nouveau »: it wiggles now and then, then
 * rests; still when motion is reduced.
 */
export function NewBadge({ label }: { readonly label: string }) {
  const reduced = useReducedMotion();
  const wiggle = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const swing = (to: number, duration: number) =>
      withTiming(to, { duration, easing: Easing.inOut(Easing.sin) });
    wiggle.value = withRepeat(
      withDelay(2000, withSequence(swing(-1, 160), swing(1, 170), swing(-0.4, 160), swing(0, 140))),
      -1,
    );
    return () => cancelAnimation(wiggle);
  }, [reduced, wiggle]);

  const moving = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${6 + 9 * wiggle.value}deg` },
      { scale: 1 + 0.12 * Math.abs(wiggle.value) },
    ],
  }));

  return <Animated.Text style={[styles.badge, moving]}>{label}</Animated.Text>;
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -8,
    right: -5,
    overflow: "hidden",
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.alert.top,
    color: colors.inkOnColor,
    fontFamily: fonts.ui.extrabold,
    fontSize: 10,
    lineHeight: 14,
  },
});
