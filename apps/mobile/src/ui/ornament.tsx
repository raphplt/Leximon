import {
  frameCell,
  frameCorner,
  frameRules,
  lettrineFor,
  type PlateName,
  plates,
  type ToolName,
  toolGrid,
  tools,
} from "@leximon/tokens";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, type ViewProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { alpha, colors, fontSizes, fonts, space } from "@/theme";
import { PLATE_FILES } from "./ornament-files";

/** A binder's tool. Decorative. */
export function Tool({
  name,
  size = 16,
  color,
}: {
  readonly name: ToolName;
  readonly size?: number;
  readonly color: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${toolGrid} ${toolGrid}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={tools[name]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export type FiletKind = "maigre" | "gras-maigre" | "perle" | "fleuron";

const PEARLS = 64;

/** The four rules: a thin one, thick and thin together, a row of dots, a tool in the middle. */
export function Filet({
  kind = "maigre",
  tool = "losange",
}: {
  readonly kind?: FiletKind;
  readonly tool?: ToolName;
}) {
  if (kind === "fleuron") {
    return (
      <View style={styles.fleuron}>
        <View style={styles.line} />
        <Tool name={tool} size={13} color={colors.rule} />
        <View style={styles.line} />
      </View>
    );
  }
  if (kind === "perle") {
    return (
      <View style={styles.pearls}>
        {Array.from({ length: PEARLS }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical dots that never move
          <View key={index} style={styles.pearl} />
        ))}
      </View>
    );
  }
  return <View style={kind === "maigre" ? styles.maigre : styles.gras} />;
}

/** An ornament from an old book, inked in `color`. Decorative. */
export function Plate({
  name,
  width,
  color = colors.pageInk,
}: {
  readonly name: PlateName;
  readonly width: number;
  readonly color?: string;
}) {
  const plate = plates[name];
  return (
    <Image
      source={PLATE_FILES[name]}
      style={{ width, height: (width * plate.height) / plate.width, tintColor: color }}
      accessible={false}
    />
  );
}

/** A text opened by an ornate capital, beside it: text cannot flow around an image here. */
export function LettrineParagraph({ text }: { readonly text: string }) {
  const capital = lettrineFor(text);
  return (
    <View style={styles.lettrined}>
      {capital !== null && <Plate name={capital} width={64} />}
      <Text style={styles.lettrinedText}>{capital === null ? text : text.slice(1)}</Text>
    </View>
  );
}

const CORNERS = [
  { key: "topLeft", style: { top: 0, left: 0 } },
  { key: "topRight", style: { top: 0, right: 0, transform: [{ scaleX: -1 }] } },
  { key: "bottomLeft", style: { bottom: 0, left: 0, transform: [{ scaleY: -1 }] } },
  {
    key: "bottomRight",
    style: { bottom: 0, right: 0, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
  },
] as const;

function Corner({ color, style }: { readonly color: string; readonly style: object }) {
  const { at, scale, path } = frameCorner.tool;
  return (
    <Svg width={frameCell} height={frameCell} style={[styles.corner, style]}>
      <Path d={frameCorner.outer} fill="none" stroke={color} strokeWidth={frameRules.outer.width} />
      <Path d={frameCorner.inner} fill="none" stroke={color} strokeWidth={frameRules.inner.width} />
      <G x={at} y={at} scale={scale}>
        <Path d={path} fill={color} fillRule="evenodd" />
      </G>
    </Svg>
  );
}

function Edges({ color, at, width }: { color: string; at: number; width: number }) {
  const inset = at - width / 2;
  const across = { left: frameCell, right: frameCell, height: width, backgroundColor: color };
  const along = { top: frameCell, bottom: frameCell, width, backgroundColor: color };
  return (
    <>
      <View style={[styles.edge, across, { top: inset }]} />
      <View style={[styles.edge, across, { bottom: inset }]} />
      <View style={[styles.edge, along, { left: inset }]} />
      <View style={[styles.edge, along, { right: inset }]} />
    </>
  );
}

/** The printed frame, drawn over what it holds. In gilt on what is bound, in ink elsewhere. */
export function Frame({
  color = colors.rule,
  style,
  children,
  ...view
}: ViewProps & { readonly color?: string }) {
  return (
    <View {...view} style={style}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Edges color={color} at={frameRules.outer.at} width={frameRules.outer.width} />
        <Edges color={color} at={frameRules.inner.at} width={frameRules.inner.width} />
        {CORNERS.map((corner) => (
          <Corner key={corner.key} color={color} style={corner.style} />
        ))}
      </View>
    </View>
  );
}

const SWEEP = 2_200;
const SWEEP_PAUSE = 2_800;

/** A gold plate with a slow reflection. One on a screen at most: it is the reward's own light. */
export function Gilt({ label }: { readonly label: string }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(
      withDelay(SWEEP_PAUSE, withTiming(1, { duration: SWEEP, easing: Easing.inOut(Easing.quad) })),
      -1,
    );
  }, [reduced, sweep]);
  const band = useAnimatedStyle(() => ({
    transform: [{ translateX: (sweep.value * 2 - 1) * width }],
  }));
  return (
    <View style={styles.gilt} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Text style={styles.giltLabel}>{label}</Text>
      {!reduced && width > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, band]} pointerEvents="none">
          <Svg width={width} height="100%">
            <Defs>
              <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0.35" stopColor={colors.glint} stopOpacity={0} />
                <Stop offset="0.5" stopColor={colors.glint} stopOpacity={0.55} />
                <Stop offset="0.65" stopColor={colors.glint} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height="100%" fill="url(#sheen)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  maigre: { height: 1, backgroundColor: colors.rule },
  gras: { height: 6, borderTopWidth: 2, borderBottomWidth: 1, borderColor: colors.rule },
  fleuron: { flexDirection: "row", alignItems: "center", gap: space.s5 },
  line: { flex: 1, height: 1, backgroundColor: colors.rule },
  pearls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
    height: 3,
  },
  pearl: { width: 2, height: 2, marginRight: 5, borderRadius: 1, backgroundColor: colors.rule },
  lettrined: { flexDirection: "row", gap: space.s5 },
  lettrinedText: {
    flex: 1,
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 23,
    color: colors.pageInk,
  },
  corner: { position: "absolute" },
  edge: { position: "absolute" },
  gilt: {
    alignSelf: "flex-start",
    paddingHorizontal: space.s9,
    paddingVertical: space.s3,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.giltDeep,
    backgroundColor: colors.gilt,
  },
  giltLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.label,
    letterSpacing: 0.8,
    fontVariant: ["small-caps"],
    color: alpha(colors.actionInk, 1),
  },
});
