import { StyleSheet } from "react-native";
import { space } from "@/theme";
import { Lettering, Toy } from "./toy";

/**
 * The gold toy of the main action; `secondary` is cut from paper, and `danger` from red leather,
 * for what cannot be undone. `small` is for a button that sits among others, above the content.
 */
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
  small = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly secondary?: boolean;
  readonly danger?: boolean;
  readonly small?: boolean;
}) {
  return (
    <Toy
      matter={danger ? "red" : secondary ? "paper" : disabled ? "locked" : "gold"}
      style={small ? styles.smallToy : styles.toy}
      bodyStyle={small ? styles.smallBody : styles.toyBody}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      <Lettering size={small ? 15 : 17}>{label}</Lettering>
    </Toy>
  );
}

const styles = StyleSheet.create({
  toy: { minHeight: 52 },
  toyBody: { paddingHorizontal: space.s12, paddingVertical: space.s4 },
  smallToy: { minHeight: 40 },
  smallBody: { paddingHorizontal: space.s8, paddingVertical: space.s2 },
});
