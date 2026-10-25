import { avatarName } from "@leximon/view-model";
import { Image, StyleSheet, View } from "react-native";
import { useEngravingInk } from "@/cards/catalog";
import { colors } from "@/theme";
import { Icon } from "./icon";

const PAPER = "#FBF5E8";
const INK = "#2A1D0C";

interface Frame {
  readonly width: number;
  readonly color: string;
}

/** Ring widths at the 84 px atelier preview; smaller avatars scale them down. */
const SIMPLE: Frame = { width: 3, color: colors.textMuted };
const FRAMES: Readonly<Record<string, Frame>> = {
  simple: SIMPLE,
  gilded: { width: 6, color: "#D9A233" },
  ink: { width: 5, color: "#2449C4" },
};

/**
 * The player's avatar: a card's engraving printed in a medallion, inside the frame worn.
 * Decorative unless `label` is given; `frame: null` draws none. The silhouette stands in until
 * the engraving is known.
 */
export function Avatar({
  avatar,
  frame,
  size,
  label,
}: {
  readonly avatar: string | null;
  readonly frame: string | null;
  readonly size: number;
  readonly label?: string;
}) {
  const ink = useEngravingInk(avatar);
  const k = size / 84;
  const worn = frame === null ? null : (FRAMES[frame] ?? SIMPLE);
  const border = worn === null ? 0 : Math.round(worn.width * k + 1);
  const outer = size + 2 * border;
  const a11y =
    label === undefined
      ? { importantForAccessibility: "no-hide-descendants" as const, accessible: false }
      : {
          accessible: true,
          accessibilityRole: "image" as const,
          accessibilityLabel: avatar === null ? label : `${label}, ${avatarName(avatar)}`,
        };
  return (
    <View
      style={[
        styles.ring,
        { width: outer, height: outer, borderRadius: outer / 2, borderWidth: border },
        worn !== null && { borderColor: worn.color },
      ]}
      {...a11y}
    >
      <View style={[styles.medallion, { width: size, height: size, borderRadius: size / 2 }]}>
        {ink === null ? (
          <Icon name="profil" size={Math.round(size * 0.6)} color={colors.kraftInk} />
        ) : (
          <Image
            source={{ uri: ink }}
            style={{ width: size * 0.78, height: size * 0.78, tintColor: INK }}
            resizeMode="contain"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center" },
  medallion: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: PAPER,
  },
});
