import {
  AVATAR_MEDALLION,
  type AvatarFrame,
  avatarFrame,
  type FrameShape,
  frameGradients,
  frameMatters,
  frameOutline,
  framePaint,
  frameSheen,
} from "@leximon/tokens";
import { avatarName } from "@leximon/view-model";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useEngravingInk } from "@/cards/catalog";
import { colors } from "@/theme";
import { Icon } from "./icon";

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
  const worn = frame === null ? null : avatarFrame(frame);
  const border =
    worn === null ? 0 : Math.round((worn.footprint * size) / (2 * AVATAR_MEDALLION) + 1);
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
      {worn !== null && <FrameDrawing frame={worn} size={size} outer={outer} />}
      <View style={[styles.medallion, { width: size, height: size, borderRadius: size / 2 }]}>
        {ink === null ? (
          <Icon name="profil" size={Math.round(size * 0.6)} color={colors.paperInk} />
        ) : (
          <Image
            source={{ uri: ink }}
            style={{ width: size * 0.78, height: size * 0.78, tintColor: colors.paperInk }}
            resizeMode="contain"
          />
        )}
      </View>
    </View>
  );
}

/**
 * The frame around the medallion, in its matters; wide frames spill over the avatar's box. The
 * rays of the rarest one stay still here: a turning drawing on every list would cost too much.
 */
function FrameDrawing({
  frame,
  size,
  outer,
}: {
  readonly frame: AvatarFrame;
  readonly size: number;
  readonly outer: number;
}) {
  const box = (size * frame.reach) / AVATAR_MEDALLION;
  const paint = (ink: FrameShape["fill"]) => {
    if (ink === undefined) return "none";
    const used = framePaint(ink);
    return "color" in used ? used.color : `url(#${used.matter})`;
  };
  return (
    <Svg
      width={box}
      height={box}
      viewBox={`${-frame.reach} ${-frame.reach} ${frame.reach * 2} ${frame.reach * 2}`}
      style={{ position: "absolute", left: (outer - box) / 2, top: (outer - box) / 2 }}
      pointerEvents="none"
    >
      <Defs>
        {frameGradients(frame).map((matter) => (
          <LinearGradient key={matter} id={matter} x1="0" y1="0" x2="0" y2="1">
            {frameMatters[matter].stops.map((color, index, stops) => (
              <Stop key={color} offset={index / (stops.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        ))}
      </Defs>
      {[...(frame.turning ?? []), ...frame.shapes].map((shape) => (
        <Path
          key={shape.d}
          d={shape.d}
          fill={paint(shape.fill)}
          fillRule="evenodd"
          stroke={paint(shape.stroke)}
          strokeWidth={shape.strokeWidth ?? frameOutline}
          strokeOpacity={shape.stroke === "sheen" ? frameSheen.opacity : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  medallion: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.paper,
  },
});
