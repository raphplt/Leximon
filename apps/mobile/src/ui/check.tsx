import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Icon } from "./icon";

/** A box to tick, with its sentence beside it; the whole row toggles it. */
export function Check({
  checked,
  onChange,
  children,
  label,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: ReactNode;
  /** What a screen reader says, when `children` holds more than text. */
  readonly label?: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      {...(label === undefined ? {} : { accessibilityLabel: label })}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked && <Icon name="check" size={16} color={colors.actionInk} />}
      </View>
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.s6, paddingVertical: space.s2 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.track,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.action, borderColor: colors.gilt },
  text: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: colors.pageInk,
  },
});
