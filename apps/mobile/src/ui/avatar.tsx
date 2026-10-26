import { avatarName } from "@leximon/view-model";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useEngravingInk } from "@/cards/catalog";
import { colors } from "@/theme";
import { Icon } from "./icon";

const PAPER = "#FBF5E8";
const INK = "#2A1D0C";

/** A ring of the frame, from `from` to `to` px outside the medallion, at the 84 px preview. */
interface Ring {
  readonly from: number;
  readonly to: number;
  /** A colour, or the frame's gradient. */
  readonly paint: string | "gradient";
  /** Dashes around the ring, in degrees: beads, rope, rays. */
  readonly dash?: readonly [on: number, off: number];
  readonly opacity?: number;
}

interface Frame {
  /** Room the frame takes in the layout, as the web's: wider rings spill over it. */
  readonly footprint: number;
  readonly rings: readonly Ring[];
  /** Diagonal gradient of the rings painted "gradient". */
  readonly gradient?: readonly string[];
}

const GOLD = ["#B8862A", "#FFE08A", "#D9A233", "#FFF6D0", "#B8862A"];

const SIMPLE: Frame = { footprint: 3, rings: [{ from: 0, to: 3, paint: colors.textMuted }] };
const FRAMES: Readonly<Record<string, Frame>> = {
  simple: SIMPLE,
  gilded: {
    footprint: 6,
    rings: [
      { from: 0, to: 5, paint: "#D9A233" },
      { from: 5, to: 8, paint: "#FFE08A" },
    ],
  },
  ink: {
    footprint: 5,
    rings: [
      { from: 0, to: 5, paint: "#2449C4" },
      { from: 5, to: 10, paint: "#7C9BFF", opacity: 0.35 },
    ],
  },
  pearls: {
    footprint: 6,
    rings: [
      { from: 0, to: 2, paint: "#8A5A14" },
      { from: 2, to: 7, paint: "#E6B84A", dash: [6, 3] },
      { from: 3.5, to: 5, paint: "#FFF3C4", dash: [2, 7] },
    ],
  },
  verdigris: {
    footprint: 6,
    rings: [
      { from: 0, to: 3, paint: "#2E5A50" },
      { from: 3, to: 6, paint: "#6FAE9C" },
      { from: 6, to: 8, paint: "#2E5A50" },
    ],
  },
  twist: {
    footprint: 6,
    rings: [
      { from: 0, to: 1.5, paint: "#5A1D10" },
      { from: 1.5, to: 7, paint: "#C8321E" },
      { from: 1.5, to: 7, paint: "#F0B04A", dash: [9, 9] },
      { from: 7, to: 8.5, paint: "#5A1D10" },
    ],
  },
  lace: {
    footprint: 6,
    rings: [
      { from: 0, to: 3, paint: "#BDB6CC" },
      { from: 3, to: 10, paint: PAPER, dash: [7, 5] },
    ],
  },
  indigo: {
    footprint: 6,
    rings: [
      { from: 0, to: 2, paint: "#F3EAD6" },
      { from: 2, to: 6, paint: "#2A3A8C" },
      { from: 6, to: 8, paint: "#F3EAD6" },
      { from: 8, to: 10, paint: "#2A3A8C" },
    ],
  },
  wax: {
    footprint: 6,
    rings: [{ from: 0, to: 9, paint: "gradient" }],
    gradient: ["#EF7A63", "#A3201B", "#5E0F0C"],
  },
  rays: {
    footprint: 6,
    rings: [
      { from: 0, to: 3, paint: "#D9A233" },
      { from: 3, to: 13, paint: "#E6B84A", dash: [3, 7], opacity: 0.9 },
    ],
  },
  "bright-gold": { footprint: 6, rings: [{ from: 0, to: 7, paint: "gradient" }], gradient: GOLD },
  iridescent: {
    footprint: 6,
    rings: [{ from: 0, to: 7, paint: "gradient" }],
    gradient: ["#FF8FB1", "#FFD36E", "#8EF0C4", "#7CC7FF", "#C59BFF"],
  },
  "royal-sun": {
    footprint: 6,
    rings: [
      { from: 0, to: 4, paint: "#D9A233" },
      { from: 4, to: 6, paint: "#FFF0B8" },
      { from: 6, to: 16, paint: "#FFD76A", dash: [5, 7] },
    ],
  },
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
  const border = worn === null ? 0 : Math.round(worn.footprint * k + 1);
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
    <View style={[styles.ring, { width: outer, height: outer }]} {...a11y}>
      {worn !== null && <FrameRings frame={worn} size={size} outer={outer} />}
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

/** The frame's rings, centred on the medallion; wide ones spill over the avatar's box. */
function FrameRings({
  frame,
  size,
  outer,
}: {
  readonly frame: Frame;
  readonly size: number;
  readonly outer: number;
}) {
  const k = size / 84;
  // The simple ring keeps at least a pixel, as the border it replaces.
  const scale = (px: number) => px * k + (frame === SIMPLE ? 1 : 0);
  const reach = Math.max(...frame.rings.map((ring) => scale(ring.to)));
  const box = size + 2 * reach;
  const centre = box / 2;
  return (
    <Svg
      width={box}
      height={box}
      style={{ position: "absolute", left: (outer - box) / 2, top: (outer - box) / 2 }}
      pointerEvents="none"
    >
      {frame.gradient !== undefined && (
        <Defs>
          <LinearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
            {frame.gradient.map((color, index, all) => (
              <Stop key={color} offset={index / (all.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
      )}
      {frame.rings.map((ring) => {
        const from = scale(ring.from);
        const width = scale(ring.to) - from;
        const r = size / 2 + from + width / 2;
        const perDegree = (2 * Math.PI * r) / 360;
        return (
          <Circle
            key={`${ring.from}-${ring.paint}`}
            cx={centre}
            cy={centre}
            r={r}
            fill="none"
            stroke={ring.paint === "gradient" ? "url(#frame)" : ring.paint}
            strokeWidth={width}
            strokeOpacity={ring.opacity ?? 1}
            {...(ring.dash === undefined
              ? {}
              : { strokeDasharray: ring.dash.map((degrees) => degrees * perDegree) })}
          />
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  medallion: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: PAPER,
  },
});
