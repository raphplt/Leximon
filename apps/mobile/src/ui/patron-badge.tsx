import type { PatronMarkView } from "@leximon/contract";
import { toyMatters } from "@leximon/tokens";
import { patronMarkHint, patronMarkLabel } from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "@/theme";
import { Icon } from "./icon";

/** The patron's badge, beside the title; `compact` keeps only the crown, for a list. */
export function PatronBadge({
  mark,
  compact = false,
}: {
  readonly mark: PatronMarkView;
  readonly compact?: boolean;
}) {
  const label = patronMarkLabel(mark);
  const hint = patronMarkHint(mark);
  if (label === null || hint === null) return null;
  const founder = mark === "founder";
  const ink = founder ? colors.paper : toyMatters.gold.edge;
  return (
    <View
      style={[styles.badge, founder && styles.founder]}
      accessible
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Icon name="crown" size={compact ? 13 : 15} color={ink} />
      {!compact && <Text style={[styles.text, { color: ink }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: toyMatters.gold.edge,
    backgroundColor: toyMatters.gold.top,
  },
  /* A founder's badge on the rubric's red, so the two read apart at a glance. */
  founder: { backgroundColor: toyMatters.red.bottom, borderColor: toyMatters.red.edge },
  text: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, includeFontPadding: false },
});
