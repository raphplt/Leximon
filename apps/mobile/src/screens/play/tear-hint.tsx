import { OPEN_HINTS } from "@leximon/view-model";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

/** Kept on the device: the hint closed, and how many sachets were opened since it showed. */
const HINT_KEY = "leximon_tear_hint";
/** After this many sachets, the player knows the gesture. */
const HINT_OPENS = 3;

function readHint(): number {
  try {
    return Number(SecureStore.getItem(HINT_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writeHint(value: number): void {
  SecureStore.setItemAsync(HINT_KEY, String(value)).catch(() => {
    // Shown again next time; nothing else depends on it.
  });
}

/** Counts a sachet opened, so that the hint goes once the gesture is known. */
export function noteSachetOpened(): void {
  const opened = readHint();
  if (opened < HINT_OPENS) writeHint(opened + 1);
}

/** How to open the sachet, under it, until the player closes it or has opened a few. */
export function TearHint() {
  // Read at once: shown a moment later, it would push the sachet.
  const [shown, setShown] = useState(() => readHint() < HINT_OPENS);
  if (!shown) return null;
  return (
    <View style={styles.hint}>
      <Text style={styles.text}>{OPEN_HINTS.sachet}</Text>
      <Pressable
        onPress={() => {
          writeHint(HINT_OPENS);
          setShown(false);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Fermer l'astuce"
        style={styles.close}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: "rgba(246, 240, 226, 0.1)",
  },
  text: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.text },
  close: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(246, 240, 226, 0.12)",
  },
  closeText: { fontFamily: fonts.ui.extrabold, fontSize: 16, lineHeight: 18, color: colors.text },
});
