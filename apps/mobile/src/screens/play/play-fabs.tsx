import type { IconName } from "@leximon/tokens";
import {
  dailyView,
  type FabId,
  type Fab as FabModel,
  goalRing,
  lockedToast,
  NOT_BUILT_COPY,
  playFabs,
} from "@leximon/view-model";
import { router } from "expo-router";
import { type ReactNode, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Emblem } from "@/clan/emblem";
import { openCoffret } from "@/levels/coffret";
import { dailyChallenge } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { myClan } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { colors, fonts } from "@/theme";
import { Badge } from "@/ui/badge";
import { Icon } from "@/ui/icon";
import { toast } from "@/ui/toast";

const ICONS: Readonly<Record<FabId, IconName>> = {
  clan: "clan",
  chat: "chat",
  jousts: "joutes",
  friends: "amis",
  daily: "defi",
  coffrets: "coffret",
  mail: "courrier",
  settings: "reglages",
};

/** The top bar has the mail; the account page stands in for the settings. */
const HIDDEN: ReadonlySet<FabId> = new Set(["mail", "settings"]);

const CIRCLE = 50;
const DAILY_RING = "#3BD3A5";

/**
 * The round buttons on both sides of the sachet; the clan's carries the weekly goal in its ring,
 * the daily challenge its answers of the day.
 */
export function PlayFabs() {
  const view = usePlayerView();
  const now = useNow(60_000);
  const daily = useShared(dailyChallenge);
  const clan = useShared(myClan);
  const dailyRatio = daily === null ? 0 : dailyView(daily).ratio;
  const goal = clan?.goal == null ? null : goalRing(clan.goal);
  const { left, right } = playFabs(
    { level: view.progress?.level ?? 1, coffrets: view.coffrets.length, mail: view.mail },
    now,
  );

  const act = (fab: FabModel) => {
    switch (fab.id) {
      case "clan":
        router.navigate("/clan");
        return;
      case "chat":
        if (fab.lock !== null) toast(lockedToast("join_clan", now));
        else router.navigate("/clan");
        return;
      case "jousts":
        toast(fab.lock !== null ? lockedToast("jousts", now) : NOT_BUILT_COPY.jousts.title);
        return;
      case "daily":
        router.navigate("/defis");
        return;
      case "friends":
        router.push("/amis");
        return;
      case "coffrets":
        openCoffret();
        return;
      case "mail":
      case "settings":
        return;
    }
  };

  const ringOf = (id: FabId) => {
    if (id === "daily") return <Ring ratio={dailyRatio} color={DAILY_RING} />;
    if (id === "clan" && goal !== null) return <Ring ratio={goal.ratio} color={colors.accent} />;
    return null;
  };

  const column = (fabs: readonly FabModel[], side: "left" | "right") => (
    <View style={[styles.column, side === "left" ? styles.left : styles.right]}>
      {fabs
        .filter((fab) => !HIDDEN.has(fab.id))
        .map((fab) => (
          <Fab
            key={fab.id}
            fab={fab}
            icon={ICONS[fab.id]}
            ring={ringOf(fab.id)}
            visual={
              fab.id === "clan" && clan?.emblem != null ? (
                <Emblem emblem={clan.emblem} size={28} />
              ) : null
            }
            onPress={() => act(fab)}
          />
        ))}
    </View>
  );

  return (
    <>
      {column(left, "left")}
      {column(right, "right")}
    </>
  );
}

function Fab({
  fab,
  icon,
  ring,
  visual,
  onPress,
}: {
  readonly fab: FabModel;
  readonly icon: IconName;
  readonly ring: ReactNode;
  readonly visual: ReactNode;
  readonly onPress: () => void;
}) {
  const locked = fab.lock !== null;
  const label = locked
    ? `${fab.label}, ${fab.lock?.replace("Niv.", "niveau")}`
    : fab.badge > 0
      ? `${fab.label}, ${fab.badge}`
      : fab.label;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <View style={[styles.circle, fab.glow && styles.gold, locked && styles.locked]}>
        {fab.glow && <Pulse />}
        {ring}
        {visual ?? (
          <Icon
            name={icon}
            size={23}
            color={fab.glow ? colors.accentInk : locked ? colors.textMuted : colors.text}
          />
        )}
        {fab.badge > 0 && !locked && <Badge count={fab.badge} ring={colors.background} />}
        {locked && <Text style={styles.lock}>{fab.lock}</Text>}
      </View>
      <Text style={[styles.label, locked && styles.labelLocked]} numberOfLines={1}>
        {fab.label}
      </Text>
    </Pressable>
  );
}

/** A share of the circle's edge, drawn in `color`. */
function Ring({ ratio, color }: { readonly ratio: number; readonly color: string }) {
  const size = CIRCLE + 4;
  const width = 3;
  const r = (size - width) / 2;
  const length = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={styles.ring} pointerEvents="none">
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.track}
        strokeWidth={width}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={`${length * Math.min(1, Math.max(0, ratio))} ${length}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** A coffret waits: a gold wave leaves the button. */
function Pulse() {
  const reduced = useReducedMotion();
  const wave = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    wave.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 0 })),
      -1,
    );
    return () => cancelAnimation(wave);
  }, [reduced, wave]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - wave.value),
    transform: [{ scale: 1 + 0.45 * wave.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, style]} />;
}

const styles = StyleSheet.create({
  column: { position: "absolute", top: 4, zIndex: 3, gap: 12 },
  left: { left: 8 },
  right: { right: 8 },
  fab: { width: 62, alignItems: "center", gap: 5 },
  pressed: { transform: [{ translateY: 2 }] },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderColor: "rgba(246, 240, 226, 0.16)",
    backgroundColor: colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  gold: { borderColor: "#FFF0B8", backgroundColor: colors.accent },
  locked: {
    borderStyle: "dashed",
    backgroundColor: "rgba(27, 31, 51, 0.45)",
  },
  ring: { position: "absolute", top: -4, left: -4 },
  pulse: {
    position: "absolute",
    top: -2,
    left: -2,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.accent,
  },
  lock: {
    position: "absolute",
    bottom: -7,
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
    backgroundColor: colors.sunken,
    fontFamily: fonts.ui.extrabold,
    fontSize: 9,
    color: colors.textMuted,
  },
  label: { fontFamily: fonts.ui.extrabold, fontSize: 10, color: colors.text },
  labelLocked: { color: colors.textMuted },
});
