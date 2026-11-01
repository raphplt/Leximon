import { Pressable, StyleSheet, Switch, View } from "react-native";
import { SHOWS_THEME_CHOICE as BOOK, colors } from "@/theme";

/** A setting that is on or off. */
export function Toggle({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  if (!BOOK) {
    return (
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.track, true: colors.success }}
        thumbColor={colors.pageInk}
      />
    );
  }
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.track, value && styles.trackOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={10}
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.pageInkMuted,
  },
  trackOn: {
    alignItems: "flex-end",
    borderColor: colors.action,
    backgroundColor: colors.action,
  },
  knob: { width: 16, height: 16, backgroundColor: colors.pageInkMuted },
  knobOn: { backgroundColor: colors.actionInk },
});
