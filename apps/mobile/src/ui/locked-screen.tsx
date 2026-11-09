import type { IconName } from "@leximon/tokens";
import { toy as toyValues } from "@leximon/tokens";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { XpBar } from "./level";
import { Fleurons, ORNAMENT_PADDING } from "./ornaments";
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
  above,
}: {
  readonly icon: IconName;
  readonly level?: number;
  readonly title: string;
  readonly text: string;
  readonly left?: string;
  readonly ratio?: number;
  /** Over the leaf: the way to the rest of the place the feature belongs to. */
  readonly above?: ReactNode;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {above}
      <Panel paper style={styles.panel}>
        <Fleurons small />
        <ToyBody matter="gold" shape="round" large style={styles.medal}>
          <Icon name={icon} size={38} color={toyValues.outline} />
        </ToyBody>
        {level !== undefined && <Text style={styles.kicker}>Niveau {level}</Text>}
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

/** The closed feature is told on a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: "center",
    gap: space.s8,
    paddingHorizontal: space.s8,
    paddingVertical: space.s12,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  panel: {
    alignItems: "center",
    paddingVertical: space.s16,
    paddingHorizontal: ORNAMENT_PADDING.fleurons,
    gap: space.s5,
  },
  medal: { width: 84, height: 84, marginBottom: space.s5 },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
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
