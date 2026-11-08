import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { alpha, colors } from "@/theme";
import { Icon } from "@/ui/icon";

/**
 * A piece not yet the player's is an empty slot sunk into the shelf: dark and flat beside the
 * raised paper tiles, its drawing faded behind a lock.
 */
export const sunkTile: ViewStyle = {
  marginTop: 4,
  borderWidth: 2,
  borderStyle: "dashed",
  borderColor: alpha(colors.inkOnColor, 0.3),
  backgroundColor: alpha(toyValues.outline, 0.74),
  boxShadow: `inset 0 4px 14px ${toyValues.drop}`,
};

export const sunkInk = alpha(colors.inkOnColor, 0.72);
export const sunkCall = toyMatters.gold.top;

/** The lock over a sunk piece's faded drawing. */
export function LockSeal() {
  return (
    <View style={styles.cover} pointerEvents="none">
      <View style={styles.seal}>
        <Icon name="lock" size={18} color={toyMatters.gold.top} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  seal: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    borderWidth: 2,
    borderColor: toyMatters.gold.top,
    backgroundColor: toyValues.outline,
  },
});
