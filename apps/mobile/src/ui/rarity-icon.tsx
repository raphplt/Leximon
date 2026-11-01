import { RARITY_LABELS } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import { rarityIconGrid, rarityIcons, rarityStyles } from "@leximon/tokens";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Mask, Path, Rect } from "react-native-svg";
import { cardFonts as fonts } from "@/theme";
import { FillGradient, paintOf } from "./fill";

/** The rarity's gem, its cut lines knocked out. Decorative: what holds it names the rarity. */
export function RarityIcon({
  rarity,
  size,
  color,
}: {
  readonly rarity: Rarity;
  readonly size: number;
  readonly color: string;
}) {
  const shape = rarityIcons[rarity];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${rarityIconGrid} ${rarityIconGrid}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <Mask
          id="cuts"
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={rarityIconGrid}
          height={rarityIconGrid}
        >
          <Rect width={rarityIconGrid} height={rarityIconGrid} fill="#fff" />
          {shape.cuts.map((cut) =>
            cut.kind === "line" ? (
              <Path
                key={cut.d}
                d={cut.d}
                fill="none"
                stroke="#000"
                strokeWidth={cut.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <Path key={cut.d} d={cut.d} fill="#000" />
            ),
          )}
        </Mask>
      </Defs>
      <G mask="url(#cuts)" fill={color}>
        {shape.body.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
    </Svg>
  );
}

/** The gem in its round chip of the rarity colour: how a rarity is shown beside its name. */
export function RarityChip({ rarity, size }: { readonly rarity: Rarity; readonly size: number }) {
  const style = rarityStyles[rarity];
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <FillGradient id="band" fill={style.band} />
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={paintOf("band", style.band)} />
      </Svg>
      <RarityIcon rarity={rarity} size={Math.round(size * 0.68)} color={style.bandInk} />
    </View>
  );
}

/** « ◆ Épique », or `text` in place of the name (« 2 Épique »). */
export function RarityName({
  rarity,
  text = RARITY_LABELS[rarity],
  color,
}: {
  readonly rarity: Rarity;
  readonly text?: string;
  readonly color: string;
}) {
  return (
    <View style={styles.name}>
      <RarityChip rarity={rarity} size={20} />
      <Text style={[styles.nameText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameText: { fontFamily: fonts.ui.extrabold, fontSize: 14 },
});
