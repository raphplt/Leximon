import type { EmblemView } from "@leximon/contract";
import { emblemColor } from "@leximon/tokens";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useEngravingInk } from "@/cards/catalog";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";

const RIM = "#D9A233";
const RIM_SHADOW = "#7A5410";
/** A shield on a 100 × 115 box: straight top, rounded corners, a soft point. */
const SHIELD = "M14 0H86Q100 0 100 14V62Q100 98 50 115Q0 98 0 62V14Q0 0 14 0Z";

/**
 * A clan's emblem: a shield of the first colour, the engraving inked in the second, a gold
 * rim, and the clan's level on a medal when given. Decorative: the clan's name is always next to it.
 */
export function Emblem({
  emblem,
  size,
  level,
}: {
  readonly emblem: EmblemView;
  readonly size: number;
  readonly level?: number;
}) {
  const ink = useEngravingInk(emblem.engraving);
  const field = emblemColor(emblem.colors[0]);
  const inkColor = emblemColor(emblem.colors[1]);
  const height = size * 1.15;
  const rim = Math.max(2, size * 0.045);
  const medal = Math.max(24, Math.round(size * 0.5));
  return (
    <View
      style={{ width: size, height: height + rim }}
      importantForAccessibility="no-hide-descendants"
      accessible={false}
    >
      <Svg
        width={size}
        height={height + rim}
        viewBox={`${-rim} ${-rim} ${100 + 2 * rim} ${115 + 3 * rim}`}
        style={StyleSheet.absoluteFill}
      >
        <Path d={SHIELD} fill={RIM_SHADOW} stroke={RIM_SHADOW} strokeWidth={rim * 2} y={rim} />
        <Path d={SHIELD} fill={field} stroke={RIM} strokeWidth={rim * 2} />
      </Svg>
      <View style={[styles.inkBox, { height }]}>
        {ink === null ? (
          <Icon name="clan" size={Math.round(size * 0.5)} color={inkColor} />
        ) : (
          <Image
            source={{ uri: ink }}
            style={{ width: size * 0.72, height: height * 0.62, tintColor: inkColor }}
            resizeMode="contain"
          />
        )}
      </View>
      {level !== undefined && (
        <View style={[styles.medal, { right: -size * 0.22, bottom: -size * 0.14 }]}>
          <LevelMedal level={level} size={medal} />
        </View>
      )}
    </View>
  );
}

/**
 * A banner the clan won by its level: the engraving, large and faint, on the right behind the
 * clan's name. The parent clips it; nothing shows while the engraving is unknown.
 */
export function Banner({ cardId }: { readonly cardId: string | null }) {
  const ink = useEngravingInk(cardId);
  if (ink === null) return null;
  return (
    <Image
      source={{ uri: ink }}
      style={styles.banner}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  inkBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: "8%",
  },
  medal: { position: "absolute" },
  banner: {
    position: "absolute",
    top: "-12%",
    bottom: "-12%",
    left: "45%",
    right: "-4%",
    opacity: 0.16,
    tintColor: "#F2C9A8",
  },
});
