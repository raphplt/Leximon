import { UPDATE_COPY, versionBelow } from "@leximon/view-model";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { AppState, Linking, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";

const VERSION = Constants.expoConfig?.version ?? null;
const STORE_URL =
  Platform.OS === "ios"
    ? Constants.expoConfig?.ios?.appStoreUrl
    : Constants.expoConfig?.android?.playStoreUrl;

/**
 * Covers the game when the API no longer serves this version. Checked on launch and each time the
 * app comes back: a phone keeps an app open for days.
 */
export function UpdateGate() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (VERSION === null) return;
    const check = () => {
      api.fetchAppStatus().then(
        (status) => setOutdated(versionBelow(VERSION, status.mobileMinVersion)),
        // Offline or a hiccup: the game goes on, the next return to the app asks again.
        () => undefined,
      );
    };
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, []);

  return (
    <Modal visible={outdated} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.screen}>
        <Icon name="sachet" size={44} color={colors.accent} />
        <Text style={styles.title} accessibilityRole="header">
          {UPDATE_COPY.title}
        </Text>
        <Text style={styles.body}>{UPDATE_COPY.body}</Text>
        {STORE_URL !== undefined && (
          <Button
            label={UPDATE_COPY.action}
            onPress={() => void Linking.openURL(STORE_URL).catch(() => undefined)}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 32,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.text.regular,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: "center",
  },
});
