import {
  bindingRule,
  fleuron,
  fleuronFrame,
  giltCorner,
  giltCornerInset,
  type Ornament,
  type OrnamentPaint,
  ornamentInks,
  ornamentStrokes,
  tailpiece,
  titleRule,
  tooling,
} from "@leximon/tokens";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

/**
 * The ornaments of the paper. They are decorative, laid over the leaf whatever its size: the leaf
 * that holds a frame needs room enough in its padding.
 */

type Corner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

const CORNERS: readonly Corner[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

/** Each corner is the top left one, turned over. */
const FLIPS: Readonly<Record<Corner, ViewStyle["transform"]>> = {
  topLeft: [],
  topRight: [{ scaleX: -1 }],
  bottomRight: [{ scaleX: -1 }, { scaleY: -1 }],
  bottomLeft: [{ scaleY: -1 }],
};

function cornerAt(corner: Corner, offset: number): ViewStyle {
  return {
    position: "absolute",
    ...(corner.startsWith("top") ? { top: offset } : { bottom: offset }),
    ...(corner.endsWith("Left") ? { left: offset } : { right: offset }),
    transform: FLIPS[corner],
  };
}

const FILLED: Readonly<
  Record<Exclude<OrnamentPaint, "stem">, { fill: string; stroke: string; width: number }>
> = {
  leafRed: { fill: ornamentInks.red, stroke: ornamentInks.ink, width: ornamentStrokes.outline },
  leafBlue: { fill: ornamentInks.blue, stroke: ornamentInks.ink, width: ornamentStrokes.outline },
  bezant: { fill: ornamentInks.gold, stroke: ornamentInks.ink, width: ornamentStrokes.outline },
  dotRed: { fill: ornamentInks.red, stroke: ornamentInks.ink, width: ornamentStrokes.dotOutline },
  taper: { fill: ornamentInks.gold, stroke: ornamentInks.ink, width: ornamentStrokes.taperOutline },
  rule: { fill: "none", stroke: ornamentInks.rule, width: bindingRule.thick },
  ruleThin: { fill: "none", stroke: ornamentInks.ruleThin, width: bindingRule.thin },
  // The tooling is gold only, as the tools leave it on the leather: no ink around it.
  gilt: { fill: ornamentInks.gold, stroke: "none", width: 0 },
  giltThick: { fill: "none", stroke: ornamentInks.rule, width: tooling.thick },
  giltThin: { fill: "none", stroke: ornamentInks.rule, width: tooling.thin },
};

function Drawing({
  ornament,
  width,
  height,
}: {
  readonly ornament: Ornament;
  readonly width: number;
  readonly height: number;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${ornament.width} ${ornament.height}`}
      style={styles.drawing}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {ornament.parts.map((part, index) => {
        if (part.paint === "stem") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, painted in order
            <G key={index} transform={part.transform}>
              <Path
                d={part.d}
                fill="none"
                stroke={ornamentInks.ink}
                strokeWidth={ornamentStrokes.stemInk}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={part.d}
                fill="none"
                stroke={ornamentInks.gold}
                strokeWidth={ornamentStrokes.stemGold}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          );
        }
        const paint = FILLED[part.paint];
        return (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, painted in order
            key={index}
            d={part.d}
            fill={paint.fill}
            stroke={paint.stroke}
            strokeWidth={paint.width}
            strokeLinejoin="round"
            transform={part.transform}
          />
        );
      })}
    </Svg>
  );
}

/** The illuminated frame: a gilt rule, a red hairline inside it, a fleuron in each corner. */
export function Fleurons({ small = false }: { readonly small?: boolean }) {
  const { size, overhang } = small ? fleuronFrame.phoneCorner : fleuronFrame.corner;
  return (
    <View style={styles.fleuronFrame} pointerEvents="none">
      <View style={styles.hairline} />
      {CORNERS.map((corner) => (
        <View key={corner} style={cornerAt(corner, -overhang)}>
          <Drawing ornament={fleuron} width={size} height={size} />
        </View>
      ))}
    </View>
  );
}

/** The tooling at a phone's scale, as the web draws it on a small screen. */
const TOOLED = 0.7;

/** A single fine gilt fillet pressed into the leather of the desk, a little in from its edge. */
export function Tooling() {
  return <View style={styles.tooling} pointerEvents="none" />;
}

/** From the edge of the leather to where its content starts, clear of the fillet, in px. */
export const TOOLING_ROOM = (tooling.inset + tooling.width) * TOOLED;

/** A gilt square in each corner of a small tile, without a rule between them. */
export function GiltCorners() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {CORNERS.map((corner) => (
        <View key={corner} style={cornerAt(corner, giltCornerInset)}>
          <Drawing ornament={giltCorner} width={GILT_CORNER} height={GILT_CORNER} />
        </View>
      ))}
    </View>
  );
}

/** A gilt rule under a section title; `small` under a short one. */
export function TitleRule({ small = false }: { readonly small?: boolean }) {
  const width = small ? 100 : 140;
  return (
    <Drawing
      ornament={titleRule}
      width={width}
      height={(width * titleRule.height) / titleRule.width}
    />
  );
}

/** A tailpiece, to close a section or to part two. */
export function Tailpiece() {
  return (
    <View style={styles.tailpiece}>
      <Drawing ornament={tailpiece} width={tailpiece.width} height={tailpiece.height} />
    </View>
  );
}

/** The gilt corners of a small tile, in px. */
const GILT_CORNER = 24;

/** The room a leaf keeps inside, in px: a small tile, a panel, and a leaf framed in fleurons. */
export const LEAF_PADDING = {
  tile: 20,
  panel: 28,
  fleurons: 36,
} as const;

const styles = StyleSheet.create({
  drawing: { overflow: "visible" },
  fleuronFrame: {
    position: "absolute",
    top: fleuronFrame.inset,
    right: fleuronFrame.inset,
    bottom: fleuronFrame.inset,
    left: fleuronFrame.inset,
    borderWidth: fleuronFrame.rule,
    borderColor: ornamentInks.rule,
    borderRadius: 2,
  },
  hairline: {
    position: "absolute",
    top: fleuronFrame.hairlineInset,
    right: fleuronFrame.hairlineInset,
    bottom: fleuronFrame.hairlineInset,
    left: fleuronFrame.hairlineInset,
    borderWidth: 1,
    borderColor: ornamentInks.hairline,
    opacity: fleuronFrame.hairlineOpacity,
  },
  tailpiece: { alignSelf: "center" },
  tooling: {
    position: "absolute",
    top: tooling.inset * TOOLED,
    right: tooling.inset * TOOLED,
    bottom: tooling.inset * TOOLED,
    left: tooling.inset * TOOLED,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: ornamentInks.ruleThin,
    borderRadius: 10,
    opacity: 0.6,
  },
});
