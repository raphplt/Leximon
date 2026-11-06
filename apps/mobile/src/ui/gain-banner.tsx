import {
  cssFill,
  gainBanner,
  lettering,
  oldGold,
  type ToyIconName,
  toyMatters,
  toy as toyValues,
} from "@leximon/tokens";
import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontSizes, fonts } from "@/theme";
import { Matter } from "./matter";
import { Lettering, ToyIcon } from "./toy";

const FRAME = 4;
const LOZENGE = 9;

/**
 * What the player just won, on red leather in an old-gold frame: the reward drawn in its
 * medallion, the gain lettered beside it, where it went underneath. As on the web.
 */
export function GainBanner({
  icon,
  title,
  note,
}: {
  /** A toy icon by its name, or another drawing (a rarity's). */
  readonly icon: ToyIconName | ReactElement;
  /** « 1 sachet bonus » */
  readonly title: string;
  /** « Dans ta réserve » */
  readonly note?: string | null | undefined;
}) {
  return (
    <View
      style={styles.frame}
      accessible
      accessibilityLabel={[title, note].filter(Boolean).join(", ")}
    >
      <View style={styles.leather}>
        <Matter kind="leather" />
        <View style={styles.rule} />
        {CORNERS.map((corner) => (
          <View key={corner} style={[styles.lozenge, LOZENGE_AT[corner]]} />
        ))}
        <View style={styles.medallion}>
          {typeof icon === "string" ? <ToyIcon name={icon} size={30} /> : icon}
        </View>
        <View style={styles.words}>
          <Lettering size={fontSizes.titleSmall}>{title}</Lettering>
          {note != null && <Text style={styles.note}>{note.toUpperCase()}</Text>}
        </View>
      </View>
    </View>
  );
}

const CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;
const AT = gainBanner.ruleInset - FRAME - LOZENGE / 2;
const LOZENGE_AT = {
  topLeft: { top: AT, left: AT },
  topRight: { top: AT, right: AT },
  bottomLeft: { bottom: AT, left: AT },
  bottomRight: { bottom: AT, right: AT },
} as const;

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    maxWidth: "100%",
    padding: FRAME,
    borderRadius: 18,
    backgroundImage: cssFill(oldGold),
    boxShadow: `0 0 0 2.5px ${toyValues.outline}, 0 6px 0 2.5px ${toyValues.outline}, 0 14px 28px ${toyValues.drop}`,
  },
  leather: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 24,
    borderRadius: 14,
    backgroundImage: `radial-gradient(ellipse 90% 140% at 30% 20%, ${gainBanner.center} 0%, ${gainBanner.middle} 60%, ${gainBanner.edge} 100%)`,
  },
  rule: {
    position: "absolute",
    top: gainBanner.ruleInset - FRAME,
    left: gainBanner.ruleInset - FRAME,
    right: gainBanner.ruleInset - FRAME,
    bottom: gainBanner.ruleInset - FRAME,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: gainBanner.rule,
  },
  lozenge: {
    position: "absolute",
    width: LOZENGE,
    height: LOZENGE,
    borderWidth: 1.2,
    borderColor: toyValues.outline,
    backgroundColor: lettering.kicker,
    transform: [{ rotate: "45deg" }],
  },
  medallion: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: toyValues.outline,
    borderRadius: 25,
    backgroundImage: `radial-gradient(circle at 40% 30%, ${toyMatters.paper.top}, ${toyMatters.paper.bottom})`,
    boxShadow: `0 0 0 3px ${lettering.kicker}, 0 3px 0 3px ${toyValues.outline}`,
  },
  words: { flexShrink: 1, gap: 2 },
  note: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    letterSpacing: 1.2,
    color: lettering.kicker,
  },
});
