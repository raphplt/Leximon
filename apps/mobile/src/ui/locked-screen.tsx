import type { IconName } from "@leximon/tokens";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fonts } from "@/theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { XpBar } from "./level";
import { Panel } from "./panel";

/**
 * A feature closed by the level: what opens it, a sentence of promise, the way there.
 * Without `level`, the feature is open but not built yet: the same screen, without the bar.
 */
export function LockedScreen({
  icon,
  level,
  title,
  text,
  left,
  ratio,
}: {
  readonly icon: IconName;
  readonly level?: number;
  readonly title: string;
  readonly text: string;
  readonly left?: string;
  readonly ratio?: number;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Panel style={styles.panel}>
        <View style={styles.icon}>
          <Icon name={icon} size={38} color={colors.accent} />
        </View>
        {level !== undefined && <Text style={styles.kicker}>NIVEAU {level}</Text>}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.text}>{text}</Text>
        {ratio !== undefined && (
          <View style={styles.progress}>
            <XpBar ratio={ratio} />
            <Text style={styles.left}>{left}</Text>
          </View>
        )}
        <View style={styles.actions}>
          <Button label="Ouvrir un sachet" onPress={() => router.navigate("/")} />
          <Button label="Faire un défi" secondary onPress={() => router.navigate("/defis")} />
        </View>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  panel: { alignItems: "center", paddingVertical: 32, gap: 10 },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 210, 77, 0.14)",
    marginBottom: 6,
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
    textAlign: "center",
  },
  text: {
    fontFamily: fonts.text.regular,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: "center",
  },
  progress: { alignSelf: "stretch", gap: 6, marginTop: 8, alignItems: "center" },
  left: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.textMuted },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 14 },
});
