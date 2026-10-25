import type { Rarity } from "@leximon/core";
import { backTone, cardSize, colors, rarityStyles } from "@leximon/tokens";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
  TextPath,
} from "react-native-svg";
import { fonts } from "@/theme";
import { FillGradient, paintOf } from "@/ui/fill";

const GILT = colors.kraft;

/**
 * The back of a card, the same for every word: a printer's mark on domino paper. Only its edge
 * can betray the rarity, from 0 (plain kraft) to 1.
 */
export function CardBack({
  rarity,
  width = cardSize.width,
  edge = 0,
  tone,
}: {
  readonly rarity: Rarity;
  readonly width?: number;
  readonly edge?: number;
  /** The `back` of the pack's collection; night when absent. */
  readonly tone?: string | undefined;
}) {
  const u = width / cardSize.width;
  const height = cardSize.height * u;
  const cloth = backTone(tone);
  const frame = rarityStyles[rarity].frame;
  const inner = { x: 4 * u, y: 4 * u, w: width - 8 * u, h: height - 8 * u };
  const mark = 160 * u;
  return (
    <View
      style={[styles.back, { width, height, borderRadius: 16 * u }]}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <FillGradient id="edge" fill={frame} />
          <RadialGradient id="cloth" cx="50%" cy="40%" rx="80%" ry="80%">
            <Stop offset="0" stopColor={cloth.light} />
            <Stop offset="1" stopColor={cloth.dark} />
          </RadialGradient>
          <Pattern id="domino" patternUnits="userSpaceOnUse" width={24 * u} height={24 * u}>
            <Path
              d="M12 2Q16 8 22 12Q16 16 12 22Q8 16 2 12Q8 8 12 2Z"
              scale={u}
              fill="none"
              stroke={GILT}
              strokeOpacity={0.22}
              strokeWidth={0.8}
            />
            <Circle cx={12 * u} cy={12 * u} r={1.6 * u} fill={GILT} fillOpacity={0.3} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} rx={16 * u} fill={paintOf("edge", frame)} />
        <Rect width={width} height={height} rx={16 * u} fill={GILT} opacity={1 - edge} />
        <Rect
          x={inner.x}
          y={inner.y}
          width={inner.w}
          height={inner.h}
          rx={12 * u}
          fill="url(#cloth)"
        />
        <Rect
          x={inner.x}
          y={inner.y}
          width={inner.w}
          height={inner.h}
          rx={12 * u}
          fill="url(#domino)"
        />
        <Rect
          x={inner.x + 6.65 * u}
          y={inner.y + 6.65 * u}
          width={inner.w - 13.3 * u}
          height={inner.h - 13.3 * u}
          rx={8 * u}
          fill="none"
          stroke={GILT}
          strokeOpacity={0.8}
          strokeWidth={1.3 * u}
        />
        <Rect
          x={inner.x + 9.25 * u}
          y={inner.y + 9.25 * u}
          width={inner.w - 18.5 * u}
          height={inner.h - 18.5 * u}
          rx={5.5 * u}
          fill="none"
          stroke={GILT}
          strokeOpacity={0.8}
          strokeWidth={0.5 * u}
        />
      </Svg>
      <View style={[styles.center, { gap: 14 * u }]}>
        <Svg width={mark} height={mark} viewBox="0 0 160 160">
          <Defs>
            <Path id="motto" d="M80 80m-58 0a58 58 0 1 1 116 0a58 58 0 1 1 -116 0" />
          </Defs>
          <Circle cx={80} cy={80} r={74} fill={cloth.light} stroke={GILT} strokeWidth={1.4} />
          <Circle cx={80} cy={80} r={71} fill="none" stroke={GILT} strokeWidth={0.6} />
          <Circle cx={80} cy={80} r={46} fill="none" stroke={GILT} strokeWidth={0.6} />
          <SvgText fill={GILT} fontFamily={fonts.text.regular} fontSize={10}>
            <TextPath href="#motto" textLength={360} lengthAdjust="spacing">
              MOTS RARES · MOTS ANCIENS · MOTS RARES · MOTS ANCIENS ·
            </TextPath>
          </SvgText>
          <SvgText
            x={80}
            y={100}
            fill={GILT}
            fontFamily={fonts.display}
            fontSize={58}
            textAnchor="middle"
          >
            L
          </SvgText>
        </Svg>
        <Text
          style={[
            styles.name,
            {
              backgroundColor: cloth.dark,
              fontSize: 11 * u,
              letterSpacing: 3.85 * u,
              paddingHorizontal: 8 * u,
              paddingVertical: 2 * u,
              borderRadius: 3 * u,
            },
          ]}
        >
          LEXIMON
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.text.regular, color: GILT, overflow: "hidden" },
});
