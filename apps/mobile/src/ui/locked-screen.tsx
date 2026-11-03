import type { IconName } from "@leximon/tokens";
import { toy as toyValues } from "@leximon/tokens";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, paperColors, space } from "@/theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { XpBar } from "./level";
import { Panel } from "./panel";
import { ToyBody } from "./toy";

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
      <Panel paper style={styles.panel}>
        {IS_LIBRARY ? (
          <ToyBody matter="gold" shape="round" large style={styles.medal}>
            <Icon name={icon} size={38} color={toyValues.outline} />
          </ToyBody>
        ) : (
          <View style={styles.icon}>
            <Icon name={icon} size={38} color={colors.rubric} />
          </View>
        )}
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

/** The closed feature is told on a leaf of paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space.s8,
    paddingVertical: space.s12,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  panel: { alignItems: "center", paddingVertical: space.s16, gap: space.s5 },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(ink.gilt, 0.14),
    marginBottom: space.s3,
  },
  medal: { width: 84, height: 84, marginBottom: space.s5 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 32,
    color: ink.pageInk,
    textAlign: "center",
  },
  text: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  progress: { alignSelf: "stretch", gap: space.s3, marginTop: space.s4, alignItems: "center" },
  left: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  actions: { alignSelf: "stretch", gap: space.s5, marginTop: space.s7 },
});
