import type { CatalogCard } from "@leximon/contract";
import { cardSize } from "@leximon/tokens";
import { type HoloLayers, holoFromPointer, holoLayers } from "@leximon/view-model";
import { type ReactNode, useEffect } from "react";
import { type GestureResponderEvent, Platform, StyleSheet, View } from "react-native";
import Animated, {
  type DerivedValue,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { cssLinearInShape, stopColor } from "@/screens/play/sachet-paint";
import { Card } from "./card";

/*
 * The web's holographic card, layer for layer: same gradients, same blend modes, same light.
 * Everything is drawn on the 300 × 420 reference card, whose geometry it copies (frame of 7,
 * corners of 16 and 10, gem chip of 32 at 21 × 17).
 */

const W = cardSize.width;
const H = cardSize.height;
const FRAME = 7;
const GEM = { x: 21, y: 17, size: 32 } as const;
const PERSPECTIVE = 900;
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
/** Half the web's idle drift: there and back takes 7 s. */
const DRIFT_MS = 3500;
const SWEEP = { wait: 2750, cross: 2250 } as const;
/** Before Android 10, views cannot blend: the foils would print as flat colour patches. */
const CAN_BLEND = Platform.OS !== "android" || Platform.Version >= 29;

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Where the light falls, in % of the card. */
interface Light {
  readonly x: DerivedValue<number>;
  readonly y: DerivedValue<number>;
}

type StopList = readonly (readonly [offset: number, color: string])[];

/*
 * SVG blends a gradient's colour and opacity apart where CSS blends them together: a fade to
 * transparent keeps the colour it fades from, or it would grey on the way.
 */

const GLARE: StopList = [
  [0, "rgba(255, 255, 255, 0.85)"],
  [0.2, "rgba(255, 255, 255, 0.3)"],
  [0.45, "rgba(255, 255, 255, 0)"],
  [0.45, "rgba(0, 0, 0, 0)"],
  [0.9, "rgba(0, 0, 0, 0.28)"],
  [1, "rgba(0, 0, 0, 0.28)"],
];

const GEM_GLINT: StopList = [
  [0.3, "rgba(255, 255, 255, 0)"],
  [0.48, "rgba(255, 255, 255, 0.95)"],
  [0.55, "rgba(255, 255, 255, 0.2)"],
  [0.7, "rgba(255, 255, 255, 0)"],
];

/** The web's `repeating-linear-gradient`, one stripe every 9 % of the line. */
const COBALT: StopList = Array.from(
  { length: 12 },
  (_, i): StopList => [
    [i * 0.09, "rgba(255, 255, 255, 0)"],
    [i * 0.09 + 0.04, "rgba(225, 235, 255, 1)"],
    [i * 0.09 + 0.09, "rgba(255, 255, 255, 0)"],
  ],
)
  .flat()
  .filter(([offset]) => offset <= 1);

const GOLD: StopList = [
  [0.3, "rgba(255, 246, 208, 0)"],
  [0.45, "rgba(255, 246, 208, 1)"],
  [0.52, "rgba(255, 210, 77, 0.6)"],
  [0.66, "rgba(255, 210, 77, 0)"],
];

const IRIDESCENT: StopList = [
  "#ff6fb5",
  "#ffd24d",
  "#7cf08a",
  "#4fd8ff",
  "#a77bff",
  "#ff6fb5",
  "#ffd24d",
  "#7cf08a",
].map((color, i) => [i / 7, color] as const);

const RAINBOW: StopList = [
  [0.1, "rgba(255, 111, 181, 0)"],
  [0.25, "rgba(255, 111, 181, 0.7)"],
  [0.33, "rgba(255, 210, 77, 0.7)"],
  [0.41, "rgba(124, 240, 138, 0.7)"],
  [0.49, "rgba(79, 216, 255, 0.7)"],
  [0.57, "rgba(167, 123, 255, 0.7)"],
  [0.65, "rgba(255, 111, 181, 0.7)"],
  [0.8, "rgba(255, 111, 181, 0)"],
];

const SWEEP_LINE: StopList = [
  [0.42, "rgba(255, 255, 255, 0)"],
  [0.5, "rgba(255, 255, 255, 0.7)"],
  [0.58, "rgba(255, 255, 255, 0)"],
];

const FRAMES = {
  cobalt: { list: COBALT, opacity: 0.8 },
  gold: { list: GOLD, opacity: 0.85 },
  iridescent: { list: IRIDESCENT, opacity: 0.7 },
} as const;

/** The two dots of each glitter, as red, green, blue. */
const GLITTER = {
  gold: ["255, 233, 168", "255, 210, 77"],
  rainbow: ["255, 255, 255", "191, 239, 255"],
} as const;

/**
 * `opacity` stands for the layer's own: Android blends a translucent view as if it were fainter
 * still, so the layer stays opaque and its colours carry the opacity.
 */
function stops(list: StopList, opacity = 1) {
  // Two stops can share an offset (a hard edge): their place in the list is their key.
  return list.map(([offset, color], index) => {
    const stop = stopColor(color);
    return (
      <Stop
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of stops
        key={index}
        offset={offset}
        stopColor={stop.color}
        stopOpacity={stop.opacity * opacity}
      />
    );
  });
}

/** A CSS gradient at 115°, stretched over whatever shape it fills. */
function Sheen({ id, list, width, height, opacity = 1 }: SheenProps) {
  const line = cssLinearInShape(115, width, height);
  return (
    <LinearGradient
      id={id}
      gradientUnits="objectBoundingBox"
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
    >
      {stops(list, opacity)}
    </LinearGradient>
  );
}

interface SheenProps {
  readonly id: string;
  readonly list: StopList;
  readonly width: number;
  readonly height: number;
  readonly opacity?: number;
}

type Blend = "overlay" | "hard-light" | "screen" | "color-dodge";

function Layer({
  width,
  blend,
  children,
}: {
  readonly width: number;
  readonly blend: Blend;
  readonly children: ReactNode;
}) {
  return (
    <Svg
      width={width}
      height={(width * H) / W}
      viewBox={`0 0 ${W} ${H}`}
      style={[StyleSheet.absoluteFill, { mixBlendMode: blend }]}
      pointerEvents="none"
    >
      <Defs>
        <ClipPath id="card">
          <Rect width={W} height={H} rx={16} />
        </ClipPath>
      </Defs>
      {children}
    </Svg>
  );
}

/**
 * A CSS background `size` times its box, moved by `background-position: x% y%`: at 0 % its corner
 * sits on the box's corner, at 100 % its far corner does.
 */
function useMovedBackground(light: Light, box: Box, size: number) {
  return useAnimatedProps(() => ({
    x: box.x - ((size - 1) * box.width * light.x.value) / 100,
    y: box.y - ((size - 1) * box.height * light.y.value) / 100,
  }));
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const CARD_BOX: Box = { x: 0, y: 0, width: W, height: H };
const PAPER_BOX: Box = { x: FRAME, y: FRAME, width: W - 2 * FRAME, height: H - 2 * FRAME };
const GEM_BOX: Box = { x: GEM.x, y: GEM.y, width: GEM.size, height: GEM.size };

/** A circle around the light reaching the farthest corner of `box`, times `reach`. */
function useLightCircle(light: Light, box: Box, reach: number) {
  return useAnimatedProps(() => {
    const x = (light.x.value / 100) * box.width;
    const y = (light.y.value / 100) * box.height;
    const far = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
    return { cx: box.x + x, cy: box.y + y, r: far * reach };
  });
}

function Glare({ width, light, soft }: LayerProps & { readonly soft: boolean }) {
  const spot = useLightCircle(light, CARD_BOX, 1);
  return (
    <Layer width={width} blend="overlay">
      <Defs>
        <RadialGradient id="glare" cx="0.5" cy="0.5" r="0.5">
          {stops(GLARE, soft ? 0.5 : 1)}
        </RadialGradient>
      </Defs>
      <G clipPath="url(#card)">
        <AnimatedCircle animatedProps={spot} fill="url(#glare)" />
      </G>
    </Layer>
  );
}

function GemGlint({ width, light }: LayerProps) {
  const moved = useMovedBackground(light, GEM_BOX, 3);
  return (
    <Layer width={width} blend="overlay">
      <Defs>
        <ClipPath id="gem">
          <Circle cx={GEM.x + GEM.size / 2} cy={GEM.y + GEM.size / 2} r={GEM.size / 2} />
        </ClipPath>
        <Sheen id="glint" list={GEM_GLINT} width={GEM.size * 3} height={GEM.size * 3} />
      </Defs>
      <G clipPath="url(#gem)">
        <AnimatedRect
          animatedProps={moved}
          width={GEM.size * 3}
          height={GEM.size * 3}
          fill="url(#glint)"
        />
      </G>
    </Layer>
  );
}

/** The frame alone: the card's outline less the paper's, filled even-odd. */
const RING = [
  `M16 0H${W - 16}A16 16 0 0 1 ${W} 16V${H - 16}A16 16 0 0 1 ${W - 16} ${H}H16A16 16 0 0 1 0 ${H - 16}V16A16 16 0 0 1 16 0Z`,
  `M${FRAME + 10} ${FRAME}H${W - FRAME - 10}A10 10 0 0 1 ${W - FRAME} ${FRAME + 10}V${H - FRAME - 10}A10 10 0 0 1 ${W - FRAME - 10} ${H - FRAME}H${FRAME + 10}A10 10 0 0 1 ${FRAME} ${H - FRAME - 10}V${FRAME + 10}A10 10 0 0 1 ${FRAME + 10} ${FRAME}Z`,
].join("");

function FrameFoil({ width, light, foil }: LayerProps & { readonly foil: keyof typeof FRAMES }) {
  const moved = useMovedBackground(light, CARD_BOX, 3);
  const { list, opacity } = FRAMES[foil];
  return (
    <Layer width={width} blend="hard-light">
      <Defs>
        <ClipPath id="ring">
          <Path d={RING} clipRule="evenodd" />
        </ClipPath>
        <Sheen id="foil" list={list} width={W * 3} height={H * 3} opacity={opacity} />
      </Defs>
      <G clipPath="url(#ring)">
        <AnimatedRect animatedProps={moved} width={W * 3} height={H * 3} fill="url(#foil)" />
      </G>
    </Layer>
  );
}

/**
 * Glitter on the paper, lit only near the light. Rather than masking the dots, black closes in
 * around the light over them: blended in `screen`, black changes nothing.
 */
function Glitter({ width, light, tone }: LayerProps & { readonly tone: keyof typeof GLITTER }) {
  const dark = useLightCircle(light, PAPER_BOX, 2);
  const [big, small] = GLITTER[tone];
  return (
    <Layer width={width} blend="screen">
      <Defs>
        <ClipPath id="paper">
          <Rect {...PAPER_BOX} rx={10} />
        </ClipPath>
        <RadialGradient id="big-dot" cx="0.5" cy="0.5" r="0.5">
          {stops([
            [0, `rgba(${big}, 1)`],
            [0.6, `rgba(${big}, 1)`],
            [1, `rgba(${big}, 0)`],
          ])}
        </RadialGradient>
        <RadialGradient id="small-dot" cx="0.5" cy="0.5" r="0.5">
          {stops([
            [0, `rgba(${small}, 1)`],
            [0.55, `rgba(${small}, 1)`],
            [1, `rgba(${small}, 0)`],
          ])}
        </RadialGradient>
        <Pattern id="big" patternUnits="userSpaceOnUse" x={FRAME} y={FRAME} width={23} height={19}>
          <Circle cx={11.5} cy={9.5} r={1.5} fill="url(#big-dot)" />
        </Pattern>
        <Pattern
          id="small"
          patternUnits="userSpaceOnUse"
          x={FRAME + 6}
          y={FRAME + 9}
          width={13}
          height={17}
        >
          <Circle cx={6.5} cy={8.5} r={1.1} fill="url(#small-dot)" />
        </Pattern>
        {/* Clear at the light, black from 42 % of the way to the farthest corner: the circle is
            twice that distance, so the stop sits at 21 %. */}
        <RadialGradient id="dark" cx="0.5" cy="0.5" r="0.5">
          {stops([
            [0, "rgba(0, 0, 0, 0)"],
            [0.21, "rgba(0, 0, 0, 1)"],
            [1, "rgba(0, 0, 0, 1)"],
          ])}
        </RadialGradient>
      </Defs>
      <G clipPath="url(#paper)">
        <Rect {...PAPER_BOX} fill="#000" />
        <Rect {...PAPER_BOX} fill="url(#big)" />
        <Rect {...PAPER_BOX} fill="url(#small)" />
        <AnimatedCircle animatedProps={dark} fill="url(#dark)" />
      </G>
    </Layer>
  );
}

function Rainbow({ width, light }: LayerProps) {
  const moved = useMovedBackground(light, CARD_BOX, 2.6);
  return (
    <Layer width={width} blend="color-dodge">
      <Defs>
        <Sheen id="rainbow" list={RAINBOW} width={W * 2.6} height={H * 2.6} opacity={0.38} />
      </Defs>
      <G clipPath="url(#card)">
        <AnimatedRect animatedProps={moved} width={W * 2.6} height={H * 2.6} fill="url(#rainbow)" />
      </G>
    </Layer>
  );
}

/** A flash crossing the card every 5 s, untouched or not. */
function Sweep({ width }: { readonly width: number }) {
  const reduced = useReducedMotion();
  const along = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    along.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP.wait }),
        withTiming(0, { duration: SWEEP.cross, easing: EASE_IN_OUT }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
    );
  }, [reduced, along]);
  const moved = useAnimatedProps(() => ({ x: -2 * W * along.value }));
  return (
    <Layer width={width} blend="overlay">
      <Defs>
        <Sheen id="sweep" list={SWEEP_LINE} width={W * 3} height={H} />
      </Defs>
      <G clipPath="url(#card)">
        <AnimatedRect animatedProps={moved} width={W * 3} height={H} fill="url(#sweep)" />
      </G>
    </Layer>
  );
}

interface LayerProps {
  readonly width: number;
  readonly light: Light;
}

function Foils({ layers, width, light }: { readonly layers: HoloLayers } & LayerProps) {
  return (
    <>
      {layers.glare !== "none" && (
        <Glare width={width} light={light} soft={layers.glare === "soft"} />
      )}
      {layers.gem && <GemGlint width={width} light={light} />}
      {layers.frame !== "none" && <FrameFoil width={width} light={light} foil={layers.frame} />}
      {layers.glitter !== "none" && <Glitter width={width} light={light} tone={layers.glitter} />}
      {layers.rainbow && <Rainbow width={width} light={light} />}
      {layers.sweep && <Sweep width={width} />}
    </>
  );
}

/**
 * A card that catches the light: it tilts and its foils move under the finger, and drift on
 * their own until then. Meant for the one card the player is looking at (revealed, opened);
 * lists keep the plain `Card`, so that a single card is ever redrawn on every frame.
 */
export function HoloCard({
  card,
  collectionName,
  width = cardSize.width,
  touchable = true,
}: {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly width?: number;
  /** False while the card must not answer the finger yet; its light drifts all the same. */
  readonly touchable?: boolean;
}) {
  const height = (width * H) / W;
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);
  /** 1 while a finger holds the light, easing back to the drift once it lifts. */
  const held = useSharedValue(0);
  const finger = {
    x: useSharedValue(50),
    y: useSharedValue(50),
    rotateX: useSharedValue(0),
    rotateY: useSharedValue(0),
  };

  useEffect(() => {
    if (reduced) return;
    drift.value = withRepeat(withTiming(1, { duration: DRIFT_MS, easing: EASE_IN_OUT }), -1, true);
  }, [reduced, drift]);

  // Without the drift, the light rests in the middle and the card faces the player.
  const between = (idle: number, live: number) => {
    "worklet";
    return idle + (live - idle) * held.value;
  };
  const light: Light = {
    x: useDerivedValue(() => between(reduced ? 50 : 35 + 30 * drift.value, finger.x.value)),
    y: useDerivedValue(() => between(reduced ? 50 : 30 + 35 * drift.value, finger.y.value)),
  };
  const tilt = useAnimatedStyle(() => {
    if (reduced) return { transform: [] };
    const rotateX = between(2.5 - 5 * drift.value, finger.rotateX.value);
    const rotateY = between(-3 + 6 * drift.value, finger.rotateY.value);
    return {
      transform: [
        { perspective: PERSPECTIVE },
        { rotateX: `${rotateX}deg` },
        { rotateY: `${rotateY}deg` },
      ],
    };
  });

  const follow = (event: GestureResponderEvent) => {
    if (!touchable) return;
    const { locationX, locationY } = event.nativeEvent;
    const next = holoFromPointer(locationX, locationY, width, height);
    finger.x.value = next.x;
    finger.y.value = next.y;
    const turn = { duration: 100, easing: Easing.linear };
    finger.rotateX.value = withTiming(next.rotateX, turn);
    finger.rotateY.value = withTiming(next.rotateY, turn);
    if (held.value < 1) held.value = withTiming(1, { duration: 150 });
  };
  const release = () => {
    held.value = withTiming(0, { duration: 450, easing: EASE_IN_OUT });
  };

  return (
    <Animated.View style={[{ width, height, borderRadius: (16 * width) / W }, styles.tilt, tilt]}>
      <Card card={card} collectionName={collectionName} width={width} />
      {CAN_BLEND && <Foils layers={holoLayers(card.rarity)} width={width} light={light} />}
      {/* On top of the layers so that its touches always come in the card's own coordinates;
          they still reach whatever holds the card. */}
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={follow}
        onTouchMove={follow}
        onTouchEnd={release}
        onTouchCancel={release}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The foils blend with the card, never with what lies behind it.
  tilt: { isolation: "isolate" },
});
