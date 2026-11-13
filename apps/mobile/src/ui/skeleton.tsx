import { useEffect } from "react";
import { type DimensionValue, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { alpha, colors, radii, space } from "@/theme";

/** A pulsing placeholder block while data loads from the server. */
export function Skeleton({
  width = "100%",
  height,
  radius = radii.md,
  style,
}: {
  readonly width?: DimensionValue;
  readonly height: number;
  readonly radius?: number;
  readonly style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.65);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduced, pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius }, animated, style]}
    />
  );
}

/** Placeholder rows for list screens (friends, mail, trades). */
export function ListSkeleton({ rows = 5 }: { readonly rows?: number }) {
  return (
    <View style={styles.list} accessible accessibilityLabel="Chargement en cours">
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <View key={index} style={styles.row}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.lines}>
            <Skeleton width="58%" height={16} />
            <Skeleton width="36%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Placeholder card grid while the album computes or loads. */
export function AlbumSkeleton({
  columns,
  cardWidth,
}: {
  readonly columns: number;
  readonly cardWidth: number;
}) {
  const cardHeight = Math.ceil(cardWidth * 1.4);
  const count = columns * 2;
  return (
    <View style={styles.grid} accessible accessibilityLabel="Chargement des cartes">
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cards
        <Skeleton key={index} width={cardWidth} height={cardHeight} radius={radii.lg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: alpha(colors.pageInk, 0.14) },
  list: { gap: space.s7, paddingVertical: space.s4 },
  row: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  lines: { flex: 1, gap: space.s3 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: space.s8,
    paddingTop: space.s12,
  },
});
