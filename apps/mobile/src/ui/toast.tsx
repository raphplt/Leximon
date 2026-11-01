import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontSizes, fonts, radii, space } from "@/theme";

/** How long a toast stays. */
const TOAST_MS = 2600;

interface Said {
  readonly key: number;
  readonly message: string;
}

let said: Said | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** A short sentence over the screen, the result of an action that leaves no other trace. */
export function toast(message: string): void {
  said = { key: (said?.key ?? 0) + 1, message };
  emit();
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    said = null;
    emit();
  }, TOAST_MS);
}

/**
 * Where the toasts show: once at the root, and once more inside each sheet, whose window covers
 * the root's on Android.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(said);
  useEffect(() => {
    const listener = () => setCurrent(said);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return (
    <View style={[styles.host, { top: insets.top + 8 }]} pointerEvents="none">
      {current !== null && (
        <Animated.View
          key={current.key}
          entering={FadeInUp.duration(180)}
          exiting={FadeOutUp.duration(180)}
          style={styles.toast}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.text}>{current.message}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    maxWidth: 420,
    paddingHorizontal: space.s9,
    paddingVertical: space.s6,
    borderRadius: radii.xxl,
    backgroundColor: colors.pageInk,
  },
  text: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, lineHeight: 21, color: colors.page },
});
