import type { EmblemView } from "@leximon/contract";
import {
  emblemColor,
  emblemField,
  emblemShield,
  emblemShieldPad,
  frameSheen,
  oldGold,
  toy,
  toyMatters,
} from "@leximon/tokens";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useEngravingInk } from "@/cards/catalog";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";

/**
 * A clan's emblem: a shield of the first colour, the engraving inked in the second, a rim of old
 * gold outlined in ink, and the clan's level on a medal when given. Decorative: the clan's name is always next to it.
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
  const inkColor = emblemColor(emblem.colors[1]);
  const height = size * 1.15;
  const medal = Math.max(24, Math.round(size * 0.5));
  return (
    <View
      style={{ width: size, height }}
      importantForAccessibility="no-hide-descendants"
      accessible={false}
    >
      <Shield field={emblem.colors[0]} size={size} />
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

/** The shield, drawn past the emblem's box by half its rim. */
function Shield({ field, size }: { readonly field: string; readonly size: number }) {
  const { path, width, height, rim, outline, depth, sheen } = emblemShield;
  const pad = emblemShieldPad;
  const k = size / width;
  const lit = emblemField(field);
  return (
    <Svg
      width={(width + 2 * pad) * k}
      height={(height + 2 * pad + depth) * k}
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad + depth}`}
      style={{ position: "absolute", left: -pad * k, top: -pad * k }}
    >
      <Defs>
        <LinearGradient id="field" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lit.top} />
          <Stop offset="1" stopColor={lit.bottom} />
        </LinearGradient>
        <LinearGradient id="gold" x1="0" y1="0" x2="0.5" y2="1">
          {oldGold.stops.map(([color, offset]) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Path
        d={path}
        y={depth}
        fill={toyMatters.gold.edge}
        stroke={toy.outline}
        strokeWidth={rim + 2 * outline}
        strokeLinejoin="round"
      />
      <Path
        d={path}
        fill="url(#field)"
        stroke={toy.outline}
        strokeWidth={rim + 2 * outline}
        strokeLinejoin="round"
      />
      <Path d={path} fill="none" stroke="url(#gold)" strokeWidth={rim} strokeLinejoin="round" />
      <Path
        d={sheen}
        stroke={frameSheen.color}
        strokeOpacity={frameSheen.opacity}
        strokeWidth={rim * 0.3}
        strokeLinecap="round"
      />
    </Svg>
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
