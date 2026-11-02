import {
  lettering,
  lockedToyInks,
  press,
  type ToyIconName,
  type ToyInk,
  type ToyInks,
  type ToyMatterName,
  type ToyShape,
  toyIconGrid,
  toyIconInks,
  toyIconOutline,
  toyIcons,
  toyLights,
  toyMatters,
  toyRadii,
  toy as toyValues,
} from "@leximon/tokens";
import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { vibrate } from "@/feedback/feedback";
import { colors, fonts } from "@/theme";
import { Matter } from "./matter";

export type ToyShapeName = "box" | "tile" | "round" | "tag";

const RADII: Readonly<Record<ToyShapeName, number>> = {
  box: toyRadii.small,
  tile: toyRadii.tile,
  round: 999,
  tag: toyRadii.tag,
};

function depthOf(shape: ToyShapeName, large: boolean): number {
  if (shape === "tag") return 2;
  return large ? toyValues.edge.large : toyValues.edge.small;
}

/**
 * The body of a toy: a lit top, a darker bottom and a lip inside, under its dark outline. Its
 * thickness is drawn apart, so that pressing only moves the body.
 */
function bodyStyle(matter: ToyMatterName, radius: number, large: boolean): ViewStyle {
  const { top, bottom, edge } = toyMatters[matter];
  const lip = large ? toyValues.lip.large : toyValues.lip.small;
  return {
    borderRadius: radius,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundImage: `linear-gradient(180deg, ${top} 0%, ${top} 47%, ${bottom} 53%, ${bottom} 100%)`,
    boxShadow: `inset 0 ${-lip}px 0 ${edge}, inset 0 2px 0 ${toyValues.sheen}`,
  };
}

function Thickness({ radius, depth }: { readonly radius: number; readonly depth: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          top: depth,
          bottom: -depth,
          borderRadius: radius,
          backgroundColor: toyValues.outline,
          boxShadow: `0 3px 10px ${toyValues.drop}`,
        },
      ]}
    />
  );
}

/**
 * Something to press, cut from leather, old gold or paper: it sinks by its thickness under the
 * finger and springs back as it is released.
 */
export function Toy({
  matter,
  shape = "box",
  large = false,
  style,
  bodyStyle: inner,
  children,
  onPressIn,
  onPressOut,
  ...pressable
}: Omit<PressableProps, "style" | "children"> & {
  readonly matter: ToyMatterName;
  readonly shape?: ToyShapeName;
  readonly large?: boolean;
  /** Size and place of the toy, thickness included. */
  readonly style?: StyleProp<ViewStyle>;
  /** Layout inside the body. */
  readonly bodyStyle?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const sink = useSharedValue(0);
  const scale = useSharedValue(1);
  const depth = depthOf(shape, large);
  const radius = large && shape === "box" ? toyRadii.large : RADII[shape];
  const pressed = useAnimatedStyle(() => ({ transform: [{ translateY: sink.value * depth }] }));
  const popped = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const [first, ...rest] = press.scales;
  const step = press.springMs / press.scales.length;
  return (
    <Pressable
      {...pressable}
      onPressIn={(event) => {
        sink.value = withTiming(1, { duration: press.sinkMs });
        vibrate([press.vibration]);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        sink.value = withTiming(0, { duration: press.sinkMs });
        if (!reduced && first !== undefined) {
          scale.value = withSequence(
            withTiming(first, { duration: 0 }),
            ...rest.map((value) => withTiming(value, { duration: step })),
          );
        }
        onPressOut?.(event);
      }}
      style={[
        styles.toy,
        { marginBottom: depth },
        pressable.disabled === true && styles.off,
        style,
      ]}
    >
      <Animated.View style={[styles.fill, popped]}>
        <Thickness radius={radius} depth={depth} />
        <Animated.View style={[styles.body, bodyStyle(matter, radius, large), inner, pressed]}>
          {children}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** The same body, to show and not to press: a count, a level, a medal. */
export function ToyBody({
  matter,
  shape = "box",
  large = false,
  style,
  children,
}: {
  readonly matter: ToyMatterName;
  readonly shape?: ToyShapeName;
  readonly large?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}) {
  return <View style={[styles.shown, toyFace(matter, shape, large), style]}>{children}</View>;
}

/**
 * The look of a toy's body with its thickness under it, for a piece that already handles its own
 * press: a tab, a chip.
 */
export function toyFace(
  matter: ToyMatterName,
  shape: ToyShapeName = "box",
  large = false,
): ViewStyle {
  const radius = large && shape === "box" ? toyRadii.large : RADII[shape];
  const body = bodyStyle(matter, radius, large);
  const thickness = `0 ${depthOf(shape, large)}px 0 ${toyValues.outline}`;
  return { ...body, boxShadow: `${body.boxShadow}, ${thickness}` };
}

/** Directions of the outline's copies: a ring of eight is round enough at these sizes. */
const RING = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

/**
 * Cream letters outlined in dark, for titles, buttons, figures and short labels. React Native
 * draws no outline around text: the same words are laid eight times behind, shifted all around,
 * and once more below for the drop.
 */
export function Lettering({
  children,
  size,
  font = fonts.display,
  color = lettering.fill,
  style,
  numberOfLines,
}: {
  readonly children: string | number;
  readonly size: number;
  readonly font?: string;
  readonly color?: string;
  readonly style?: StyleProp<TextStyle>;
  readonly numberOfLines?: number;
}) {
  const reach = Math.max(lettering.minOutline / 2, (lettering.outlineRatio * size) / 2);
  const text: TextStyle = { fontFamily: font, fontSize: size, lineHeight: Math.round(size * 1.15) };
  const copy = (key: string, dx: number, dy: number) => (
    <Text
      key={key}
      numberOfLines={numberOfLines}
      accessible={false}
      importantForAccessibility="no"
      style={[text, style, styles.outline, { transform: [{ translateX: dx }, { translateY: dy }] }]}
    >
      {children}
    </Text>
  );
  return (
    <View>
      {/* A drop deeper than the outline would part from it and read as a second line of text. */}
      {copy("drop", 0, reach + Math.min(lettering.drop, reach))}
      {RING.map(([x, y]) => copy(`${x}${y}`, x * reach, y * reach))}
      <Text numberOfLines={numberOfLines} style={[text, style, { color }]}>
        {children}
      </Text>
    </View>
  );
}

/** Small capitals in gilt, above a title. */
export function Kicker({ children }: { readonly children: string }) {
  return <Text style={styles.kicker}>{children.toUpperCase()}</Text>;
}

/** A leaf of cream paper, for what is read. */
export function Leaf({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.leaf, style]}>
      <Matter kind="paper" />
      {children}
    </View>
  );
}

function paint(ink: ToyInk | undefined, inks: ToyInks): string | undefined {
  if (ink === undefined) return undefined;
  if (ink === "outline") return toyValues.outline;
  if (ink === "gloss" || ink === "sheen") return toyLights[ink].color;
  return inks[ink];
}

function ShapePath({ shape, inks }: { readonly shape: ToyShape; readonly inks: ToyInks }) {
  const fill = paint(shape.fill, inks) ?? "none";
  const stroke = paint(shape.stroke, inks);
  const light = shape.fill === "gloss" || shape.fill === "sheen" ? shape.fill : shape.stroke;
  const opacity = light === "gloss" || light === "sheen" ? toyLights[light].opacity : 1;
  return (
    <Path
      d={shape.d}
      fill={fill}
      stroke={stroke ?? "none"}
      strokeWidth={stroke === undefined ? 0 : (shape.strokeWidth ?? toyIconOutline)}
      strokeLinejoin="round"
      strokeLinecap={shape.dash === undefined ? "round" : "butt"}
      opacity={opacity}
      {...(shape.dash === undefined ? {} : { strokeDasharray: shape.dash })}
      {...(shape.rotate === undefined ? {} : { transform: `rotate(${shape.rotate.join(" ")})` })}
    />
  );
}

/** A filled icon of the toys. Decorative: the toy that holds it carries the name. */
export function ToyIcon({
  name,
  size,
  locked = false,
  inks,
}: {
  readonly name: ToyIconName;
  readonly size: number;
  readonly locked?: boolean;
  readonly inks?: ToyInks;
}) {
  const used = locked ? lockedToyInks : (inks ?? toyIconInks[name]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${toyIconGrid} ${toyIconGrid}`}>
      {toyIcons[name].map((shape, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, painted in order
        <ShapePath key={index} shape={shape} inks={used} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  off: { opacity: 0.6 },
  toy: { position: "relative" },
  fill: { flexGrow: 1 },
  body: { flexGrow: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  /** A shown body keeps its own size, where a pressed one fills its toy. */
  shown: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  outline: {
    ...StyleSheet.absoluteFill,
    color: lettering.outline,
  },
  kicker: {
    color: lettering.kicker,
    fontFamily: fonts.ui.extrabold,
    fontSize: 11,
    letterSpacing: 3,
    textShadowColor: colors.shade,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  leaf: {
    overflow: "hidden",
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: toyRadii.tile,
    backgroundColor: colors.paper,
    boxShadow: `inset 0 -4px 0 ${toyMatters.paper.bottom}, 0 4px 0 ${toyValues.outline}, 0 10px 20px ${toyValues.drop}`,
  },
});
