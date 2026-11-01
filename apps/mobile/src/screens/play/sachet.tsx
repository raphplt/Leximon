import type { CatalogCollectionFile } from "@leximon/contract";
import { backTone } from "@leximon/tokens";
import { TEAR_COMPLETE_AT, TEAR_STARTED_AT, tearProgress } from "@leximon/view-model";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  PanResponder,
  type PanResponderInstance,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  type DerivedValue,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { steppedLight, useTiltLight } from "@/cards/use-tilt-light";
import { play, playTearGrain, vibrate } from "@/feedback/feedback";
import { colors, cardFonts as fonts } from "@/theme";
import {
  BandLayer,
  BaseLayer,
  BODY_OUTLINE,
  BrandLayer,
  GRID,
  type Light,
  LightLayer,
  PrintLayer,
  type Region,
  RibsLayer,
  STRIP,
  VolumeLayer,
} from "./sachet-face";
import { asIs, cssLinear, dimmed, greyed, mixOklab, type Paint, stopColor } from "./sachet-paint";

/** Below this many points, a touch on the strip is a tap, not a pull. */
const TAP_SLOP = 8;
/** The pouch's perspective, in points, as on the web. */
const PERSPECTIVE = 900;
/** The front face stands this far before the middle of the pouch, the back as far behind. */
const FACE = 9;
/** Depth of the layers between the back and the front: the pouch's thickness. */
const SLICES = [-7, -3.5, 0, 3.5, 7] as const;
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const EASE_IN = Easing.bezier(0.42, 0, 1, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
/** How long the pouch takes to come back to rest when the player returns to it. */
const SETTLE_MS = 400;
/** How long the pouch glows once its wait is over. */
const REFILLED_MS = 900;
/** The level of an empty pouch climbs as slowly as the web's. */
const LEVEL_MS = 15_000;
const BODY_HEIGHT = GRID.height - STRIP;

export type SachetState = "sealed" | "empty" | "opening";

interface Tilt {
  /** The web's `--holo-rx` and `--holo-ry`, in degrees. */
  readonly x: DerivedValue<number>;
  readonly y: DerivedValue<number>;
}

/**
 * The pack as a classic booster, drawn as the web draws it: a foil pouch crimped at both ends,
 * the collection's colours, motif and gold seal, its name on a kraft ribbon. Touching it opens
 * it, and so does tearing its strip along the dotted line: the strip follows the finger, opens
 * past 60 % and sticks back below.
 *
 * The pouch is a small 3D object: a back, a few slices for its thickness and a front, leaning
 * with a slow sway while the light moves across its foil.
 */
export function Sachet({
  collection,
  state,
  active,
  width,
  refill,
  refillLabel,
  onTearStart,
  onOpen,
}: {
  readonly collection: CatalogCollectionFile;
  readonly state: SachetState;
  /** False while another screen covers it: nothing moves, nothing listens to the sensor. */
  readonly active: boolean;
  readonly width: number;
  /** Empty, the share of the wait for the next one already gone; `null` waiting for an account. */
  readonly refill: number | null;
  /** Empty, the time left before the next one (« 12 min »). */
  readonly refillLabel: string | null;
  /** The tear has really begun: time to ask the server for the cards. */
  readonly onTearStart: () => void;
  readonly onOpen: () => void;
}) {
  const u = width / GRID.width;
  const height = GRID.height * u;
  const reduced = useReducedMotion();
  const sway = useSharedValue(0);
  const bob = useSharedValue(0);
  const fly = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    if (!active) {
      cancelAnimation(sway);
      cancelAnimation(bob);
      return;
    }
    const swing = (value: SharedValue<number>, duration: number) => {
      value.value = withSequence(
        withTiming(0, { duration: SETTLE_MS, easing: EASE_IN_OUT }),
        withRepeat(withTiming(1, { duration, easing: EASE_IN_OUT }), -1, true),
      );
    };
    swing(sway, 6000);
    swing(bob, 3500);
  }, [active, reduced, sway, bob]);

  // Once the phone's tilt is read, it moves the light and the sway stops.
  const phone = useTiltLight(state === "sealed" && active);
  const swayed = (swaying: number, tilted: number) => {
    "worklet";
    return swaying + (tilted - swaying) * phone.held.value;
  };
  // Without the sway, the light rests in the middle and the pouch faces the player.
  const light: Light = {
    x: useDerivedValue(() =>
      reduced ? 50 : steppedLight(swayed(35 + 30 * sway.value, phone.x.value)),
    ),
    y: useDerivedValue(() =>
      reduced ? 50 : steppedLight(swayed(30 + 10 * sway.value, phone.y.value)),
    ),
  };
  // A strip torn off no longer catches the moving light: its drawings stay still.
  const stripLight: Light = { x: useSharedValue(50), y: useSharedValue(30) };
  const tilt: Tilt = {
    x: useDerivedValue(() => (reduced ? 0 : swayed(1.5 - 2 * sway.value, phone.rotateX.value))),
    y: useDerivedValue(() => (reduced ? 0 : swayed(-2.5 + 5 * sway.value, phone.rotateY.value))),
  };

  useEffect(() => {
    fly.value =
      state === "opening" && !reduced ? withTiming(1, { duration: 600, easing: EASE_IN }) : 0;
  }, [state, reduced, fly]);

  const refilled = useRefilled(state, refill);
  useEffect(() => {
    if (!refilled) return;
    glow.value = 1;
    glow.value = withTiming(0, { duration: REFILLED_MS, easing: EASE_OUT });
  }, [refilled, glow]);

  const openWithTouch = () => {
    onTearStart();
    play("tearFinish");
    vibrate([40]);
    onOpen();
  };
  const tear = useTear({ enabled: state === "sealed", width, onTearStart, onOpen, openWithTouch });

  const leaning = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { translateY: -4 * u * bob.value },
      // A pouch is lighter than a card: it leans further under the same light.
      { rotateX: `${tilt.x.value * 1.6}deg` },
      { rotateY: `${tilt.y.value * 1.6}deg` },
    ],
  }));
  const front = useAnimatedStyle(() => ({
    transform: [...depth(FACE * u, tilt), { scale: 1 + 0.04 * glow.value }],
  }));

  const empty = state === "empty";
  const edges: Paint = empty ? dimmed : asIs;
  const layered = tear.layered || state === "opening";

  return (
    <Pressable
      onPress={openWithTouch}
      disabled={state !== "sealed"}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le sachet ${collection.name}`}
      accessibilityState={{ disabled: state !== "sealed" }}
      style={{ width, height }}
    >
      <Shadow u={u} tilt={tilt} bob={bob} />
      <Animated.View style={[StyleSheet.absoluteFill, leaning]}>
        <DepthLayer z={-FACE * u} tilt={tilt}>
          <Edge collection={collection} width={width} kind="back" paint={edges} />
        </DepthLayer>
        {SLICES.map((z) => (
          <DepthLayer key={z} z={z * u} tilt={tilt}>
            <Edge collection={collection} width={width} kind="slice" paint={edges} />
          </DepthLayer>
        ))}
        {state === "opening" && !reduced && <Burst u={u} />}
        <Animated.View style={[StyleSheet.absoluteFill, front]} pointerEvents="box-none">
          {/* Torn, the drawing stays mounted and only loses its strip: redrawing a whole pouch
              at that moment would freeze the gesture. */}
          <View collapsable={false} style={[styles.cut, { top: layered ? STRIP * u : 0 }]}>
            <View collapsable={false} style={{ marginTop: layered ? -STRIP * u : 0 }}>
              <FaceStack
                collection={collection}
                width={width}
                light={light}
                region={{ strip: edges, body: asIs }}
                waiting={
                  empty ? (
                    <Waiting
                      collection={collection}
                      width={width}
                      light={light}
                      refill={refill}
                      label={refillLabel}
                      active={active}
                    />
                  ) : null
                }
              />
            </View>
          </View>
          {layered && (
            <Strip u={u} tear={tear} fly={fly} pulled={tear.layered}>
              <FaceStack
                collection={collection}
                width={width}
                light={stripLight}
                region={{ strip: edges, body: null }}
                waiting={null}
              />
            </Strip>
          )}
          <Glow u={u} glow={glow} />
          {state === "sealed" && (
            <View
              // A taller target than the strip itself.
              style={[styles.handle, { top: -16 * u, height: (STRIP + 28) * u }]}
              // Without it, the empty view is flattened away and never receives the finger.
              collapsable={false}
              {...tear.handlers}
              importantForAccessibility="no-hide-descendants"
            />
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Where a layer standing `z` points before the middle of the leaning pouch lands on screen: the
 * web stacks its layers in 3D, the phone shifts and scales flat ones the same way.
 */
function depth(z: number, tilt: Tilt) {
  "worklet";
  const ax = (tilt.x.value * 1.6 * Math.PI) / 180;
  const ay = (tilt.y.value * 1.6 * Math.PI) / 180;
  const toward = z * Math.cos(ax) * Math.cos(ay);
  return [
    { translateX: z * Math.sin(ay) },
    { translateY: -z * Math.sin(ax) * Math.cos(ay) },
    { scale: PERSPECTIVE / (PERSPECTIVE - toward) },
  ];
}

function DepthLayer({
  z,
  tilt,
  children,
}: {
  readonly z: number;
  readonly tilt: Tilt;
  readonly children: ReactNode;
}) {
  const placed = useAnimatedStyle(() => ({ transform: depth(z, tilt) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, placed]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

/** The front face's drawings, in the web's order. */
function FaceStack({
  collection,
  width,
  light,
  region,
  waiting,
}: {
  readonly collection: CatalogCollectionFile;
  readonly width: number;
  readonly light: Light;
  readonly region: Region;
  readonly waiting: ReactNode;
}) {
  const height = (width * GRID.height) / GRID.width;
  return (
    <View style={{ width, height }} pointerEvents="none">
      <BaseLayer collection={collection} width={width} region={region} />
      <BandLayer width={width} light={light} region={region} />
      <PrintLayer collection={collection} width={width} region={region} />
      {region.body !== null && (
        <BrandLayer collection={collection} width={width} light={light} paint={region.body} />
      )}
      {waiting}
      {region.body !== null && <VolumeLayer width={width} />}
      <LightLayer width={width} light={light} region={region} />
      <RibsLayer width={width} region={region} />
    </View>
  );
}

/** The back of the pouch, or one slice of its thickness: the body's outline, in the tone. */
function Edge({
  collection,
  width,
  kind,
  paint,
}: {
  readonly collection: CatalogCollectionFile;
  readonly width: number;
  readonly kind: "back" | "slice";
  readonly paint: Paint;
}) {
  const tone = backTone(collection.back);
  const box = { x: 0, y: STRIP, width: GRID.width, height: BODY_HEIGHT };
  const rim = mixOklab(tone.light, "#ffffff", 0.12);
  // The back is dark; the rim, seen when the pouch leans, is lit in the middle like a seam.
  const list: readonly (readonly [number, string])[] =
    kind === "back"
      ? [
          [0, tone.dark],
          [1, mixOklab(tone.dark, "#000000", 0.4)],
        ]
      : [
          [0, rim],
          [0.12, tone.light],
          [0.88, tone.light],
          [1, rim],
        ];
  const line = cssLinear(kind === "back" ? 180 : 90, box);
  return (
    <Svg
      width={width}
      height={(width * GRID.height) / GRID.width}
      viewBox={`0 0 ${GRID.width} ${GRID.height}`}
    >
      <Defs>
        <LinearGradient id="edge" gradientUnits="userSpaceOnUse" {...line}>
          {list.map(([offset, color]) => {
            const stop = stopColor(paint(color));
            return (
              <Stop
                key={offset}
                offset={offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            );
          })}
        </LinearGradient>
      </Defs>
      <Path d={BODY_OUTLINE} fill="url(#edge)" />
    </Svg>
  );
}

/** On the table, under the pouch: it slides against the tilt and shrinks as the pouch rises. */
function Shadow({
  u,
  tilt,
  bob,
}: {
  readonly u: number;
  readonly tilt: Tilt;
  readonly bob: SharedValue<number>;
}) {
  const box = { width: GRID.width * 0.72, height: 36 };
  const margin = 15;
  const moved = useAnimatedStyle(() => ({
    opacity: 1 - 0.15 * bob.value,
    transform: [
      { translateX: Math.sin((tilt.y.value * Math.PI) / 180) * -120 * u },
      { scale: 1 - 0.06 * bob.value },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.shadow,
        {
          left: (GRID.width * 0.14 - margin) * u,
          top: (GRID.height + 26 - box.height - margin) * u,
          width: (box.width + 2 * margin) * u,
          height: (box.height + 2 * margin) * u,
        },
        moved,
      ]}
      pointerEvents="none"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${box.width + 2 * margin} ${box.height + 2 * margin}`}
      >
        <Defs>
          <RadialGradient id="shade" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <Filter id="soft" x="-30%" y="-60%" width="160%" height="220%">
            <FeGaussianBlur stdDeviation={2.5} />
          </Filter>
        </Defs>
        <Ellipse
          cx={margin + box.width / 2}
          cy={margin + box.height / 2}
          rx={box.width / 2}
          ry={box.height / 2}
          fill="url(#shade)"
          filter="url(#soft)"
        />
      </Svg>
    </Animated.View>
  );
}

/** Two cards rising out of the pouch as its strip flies off, between its back and its front. */
function Burst({ u }: { readonly u: number }) {
  return (
    <>
      <BurstCard u={u} left={34} duration={1100} delay={0} />
      <BurstCard u={u} left={52} duration={1200} delay={80} />
    </>
  );
}

function BurstCard({
  u,
  left,
  duration,
  delay,
}: {
  readonly u: number;
  readonly left: number;
  readonly duration: number;
  readonly delay: number;
}) {
  const rise = useSharedValue(0);
  const shown = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(delay, withTiming(1, { duration, easing: EASE_OUT }));
    shown.value = withDelay(delay, withTiming(1, { duration: duration * 0.3, easing: EASE_OUT }));
  }, [rise, shown, duration, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (40 - 250 * rise.value) * u }, { rotate: `${-5 * rise.value}deg` }],
  }));
  return (
    <Animated.View
      style={[
        styles.burst,
        {
          left: left * u,
          top: 110 * u,
          width: 150 * u,
          height: 210 * u,
          borderRadius: 12 * u,
          borderWidth: 6 * u,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

/** The wait is over: the pouch glows once as it comes back. */
function Glow({ u, glow }: { readonly u: number; readonly glow: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg
        width={GRID.width * u}
        height={GRID.height * u}
        viewBox={`0 0 ${GRID.width} ${GRID.height}`}
      >
        <Path d={BODY_OUTLINE} fill="#fff6dc" opacity={0.22} />
      </Svg>
    </Animated.View>
  );
}

/**
 * True for a moment once a pouch that was filling up becomes sealed: the wait is over. A pouch
 * that arrives sealed, or one waiting for an account rather than for time, does not glow.
 */
function useRefilled(state: SachetState, refill: number | null): boolean {
  const wasFilling = useRef(false);
  const [refilled, setRefilled] = useState(false);
  useEffect(() => {
    if (state === "empty") {
      wasFilling.current = refill !== null;
      return;
    }
    if (state !== "sealed" || !wasFilling.current) return;
    wasFilling.current = false;
    setRefilled(true);
    play("newCard");
    const timer = setTimeout(() => setRefilled(false), REFILLED_MS);
    return () => clearTimeout(timer);
  }, [state, refill]);
  return refilled;
}

/**
 * Empty, the pouch waits in grey, and its colour comes back up from the bottom as the next one
 * nears, with the level marked by a thin gold line and the time left riding above it.
 */
function Waiting({
  collection,
  width,
  light,
  refill,
  label,
  active,
}: {
  readonly collection: CatalogCollectionFile;
  readonly width: number;
  readonly light: Light;
  readonly refill: number | null;
  readonly label: string | null;
  readonly active: boolean;
}) {
  const u = width / GRID.width;
  const level = useSharedValue(refill ?? 0);
  const first = useRef(true);
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    level.value = withTiming(refill ?? 0, { duration: LEVEL_MS, easing: Easing.linear });
  }, [refill, level]);
  useEffect(() => {
    if (!active) {
      cancelAnimation(shimmer);
      return;
    }
    shimmer.value = 0;
    shimmer.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1);
  }, [active, shimmer]);

  const grey: Region = { strip: null, body: greyed };
  const cover = useAnimatedStyle(() => ({
    height: (STRIP + (1 - level.value) * BODY_HEIGHT) * u,
  }));
  const fill = useAnimatedProps(() => ({
    y: GRID.height - level.value * BODY_HEIGHT,
    height: level.value * BODY_HEIGHT,
  }));
  const edge = useAnimatedStyle(() => ({
    top: (GRID.height - level.value * BODY_HEIGHT - 3) * u,
  }));
  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: (-2 + 2 * shimmer.value) * (GRID.width - 8) * u }],
  }));
  const time = useAnimatedStyle(() => ({
    bottom: Math.min(Math.max(14, level.value * BODY_HEIGHT + 10), BODY_HEIGHT - 60) * u,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.cover, cover]}>
        <BaseLayer collection={collection} width={width} region={grey} />
        <BandLayer width={width} light={light} region={grey} />
        <PrintLayer collection={collection} width={width} region={grey} />
        <BrandLayer collection={collection} width={width} light={light} paint={greyed} />
        <Svg
          width={width}
          height={GRID.height * u}
          viewBox={`0 0 ${GRID.width} ${GRID.height}`}
          style={StyleSheet.absoluteFill}
        >
          <Path d={BODY_OUTLINE} fill="rgba(10, 12, 24, 0.55)" />
        </Svg>
      </Animated.View>
      <Svg
        width={width}
        height={GRID.height * u}
        viewBox={`0 0 ${GRID.width} ${GRID.height}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <ClipPath id="body">
            <Path d={BODY_OUTLINE} />
          </ClipPath>
          {/* What has filled glows warm, whatever the pouch's own colours. */}
          <LinearGradient id="filled" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#ffd25a" stopOpacity={0.34} />
            <Stop offset="1" stopColor="#ffd25a" stopOpacity={0.1} />
          </LinearGradient>
        </Defs>
        <AnimatedRect
          animatedProps={fill}
          width={GRID.width}
          fill="url(#filled)"
          clipPath="url(#body)"
        />
      </Svg>
      <View style={[styles.edgeRoom, { top: STRIP * u, height: BODY_HEIGHT * u }]}>
        <Animated.View
          style={[
            styles.edge,
            {
              left: 4 * u,
              width: (GRID.width - 8) * u,
              height: 3 * u,
              borderRadius: 2 * u,
              boxShadow: `0 0 ${10 * u}px rgba(255, 210, 90, 0.7)`,
              marginTop: -STRIP * u,
            },
            edge,
          ]}
        >
          <Animated.View style={[styles.sheen, { width: 4 * (GRID.width - 8) * u }, sheen]}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
                  {[0, 0.5].flatMap((start) =>
                    (
                      [
                        [0, "rgba(255, 224, 138, 0.55)"],
                        [0.2, "#ffe08a"],
                        [0.25, "#fff6d6"],
                        [0.3, "#ffe08a"],
                        [0.5, "rgba(255, 224, 138, 0.55)"],
                      ] as const
                    ).map(([offset, color]) => {
                      const stop = stopColor(color);
                      return (
                        <Stop
                          key={`${start}-${offset}`}
                          offset={start + offset}
                          stopColor={stop.color}
                          stopOpacity={stop.opacity}
                        />
                      );
                    }),
                  )}
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#sheen)" />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>
      {refill !== null && label !== null && (
        <Animated.View style={[styles.time, time]}>
          <Text
            style={[
              styles.timeText,
              {
                paddingVertical: 3 * u,
                paddingHorizontal: 10 * u,
                fontSize: 15 * u,
                lineHeight: 18 * u,
                borderRadius: 99 * u,
                boxShadow: `0 ${3 * u}px ${10 * u}px rgba(0, 0, 0, 0.35)`,
              },
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface Tear {
  readonly layered: boolean;
  readonly progress: SharedValue<number>;
  /** +1 when the strip tears from its left end, -1 from its right end. */
  readonly direction: SharedValue<number>;
  readonly handlers: PanResponderInstance["panHandlers"];
}

/** Pulling the strip: its progress drives the pouch's layers, the request leaves at 5 %. */
function useTear({
  enabled,
  width,
  onTearStart,
  onOpen,
  openWithTouch,
}: {
  readonly enabled: boolean;
  readonly width: number;
  readonly onTearStart: () => void;
  readonly onOpen: () => void;
  readonly openWithTouch: () => void;
}): Tear {
  const progress = useSharedValue(0);
  const direction = useSharedValue(1);
  const [layered, setLayered] = useState(false);
  // The responder is made once: it reads the latest props through this.
  const latest = useRef({ enabled, width, onTearStart, onOpen, openWithTouch });
  latest.current = { enabled, width, onTearStart, onOpen, openWithTouch };
  const started = useRef(false);
  /** Whether the finger went past the tap slop at any point of this touch. */
  const moved = useRef(false);
  /** The last grain of torn paper: when, and how far the strip was torn then. */
  const grain = useRef({ at: 0, progress: 0 });

  useEffect(() => {
    // Sealed again (an opening that failed): a whole strip, ready to pull.
    if (!enabled) return;
    started.current = false;
    progress.value = 0;
    setLayered(false);
  }, [enabled, progress]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.enabled,
      onMoveShouldSetPanResponder: () => latest.current.enabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        started.current = false;
        moved.current = false;
        grain.current = { at: Date.now(), progress: 0 };
        progress.value = 0;
        setLayered(true);
      },
      onPanResponderMove: (_event, gesture) => {
        if (Math.hypot(gesture.dx, gesture.dy) >= TAP_SLOP) moved.current = true;
        const next = tearProgress(gesture.dx, latest.current.width);
        if (!started.current) direction.value = gesture.dx < 0 ? -1 : 1;
        if (!started.current && next >= TEAR_STARTED_AT) {
          started.current = true;
          latest.current.onTearStart();
        }
        const torn = Math.abs(next - grain.current.progress);
        if (torn >= 0.025) {
          const now = Date.now();
          playTearGrain((torn * 1000) / Math.max(1, now - grain.current.at));
          grain.current = { at: now, progress: next };
        }
        progress.value = next;
      },
      onPanResponderRelease: () => {
        const { onTearStart: start, onOpen: open, openWithTouch: touch } = latest.current;
        if (!moved.current) {
          // A tap on the strip opens the pouch like a tap anywhere else.
          setLayered(false);
          touch();
          return;
        }
        if (progress.value >= TEAR_COMPLETE_AT) {
          progress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
          start();
          play("tearFinish");
          vibrate([30]);
          open();
          return;
        }
        // The strip sticks back. A request already sent is kept for the next try.
        progress.value = withTiming(
          0,
          { duration: 250, easing: Easing.out(Easing.quad) },
          (done) => {
            if (done) scheduleOnRN(setLayered, false);
          },
        );
      },
      onPanResponderTerminate: () => {
        progress.value = withTiming(0, { duration: 250 });
        setLayered(false);
      },
    }),
  ).current;

  return { layered, progress, direction, handlers: responder.panHandlers };
}

/**
 * The strip while it is pulled, cut in two: the part still on, and the piece torn off, which
 * lifts from where it still holds. Once the pouch opens, all of it flies off, turning over.
 */
function Strip({
  u,
  tear,
  fly,
  pulled,
  children,
}: {
  readonly u: number;
  readonly tear: Tear;
  readonly fly: SharedValue<number>;
  /** A finger pulled it: a tap opens the pouch whole, with no torn piece to draw. */
  readonly pulled: boolean;
  readonly children: ReactNode;
}) {
  const width = GRID.width * u;
  const { progress, direction } = tear;

  const flying = useAnimatedStyle(() => ({
    opacity: 1 - fly.value,
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: 60 * u * fly.value },
      { translateY: -140 * u * fly.value },
      { scale: PERSPECTIVE / (PERSPECTIVE - 40 * u * fly.value) },
      { rotate: `${14 * fly.value}deg` },
      { rotateX: `${50 * fly.value}deg` },
    ],
  }));
  const kept = useAnimatedStyle(() => {
    const torn = progress.value * width;
    return { left: direction.value === 1 ? torn : 0, width: width - torn };
  });
  const keptInner = useAnimatedStyle(() => ({
    transform: [{ translateX: direction.value === 1 ? -progress.value * width : 0 }],
  }));
  const torn = useAnimatedStyle(() => {
    const share = progress.value;
    return {
      left: direction.value === 1 ? 0 : width * (1 - share),
      width: width * share,
      transformOrigin: direction.value === 1 ? "right bottom" : "left bottom",
      transform: [{ rotate: `${direction.value * share * 14}deg` }, { translateY: -share * 8 }],
    };
  });
  const tornInner = useAnimatedStyle(() => ({
    transform: [{ translateX: direction.value === 1 ? 0 : -width * (1 - progress.value) }],
  }));

  return (
    <Animated.View style={[styles.strip, { height: STRIP * u }, flying]} pointerEvents="none">
      <Animated.View style={[styles.piece, kept]}>
        <Animated.View style={keptInner}>{children}</Animated.View>
      </Animated.View>
      {pulled && (
        <Animated.View
          style={[styles.piece, { boxShadow: `0 ${4 * u}px ${4 * u}px rgba(0, 0, 0, 0.35)` }, torn]}
        >
          <Animated.View style={tornInner}>{children}</Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cut: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden" },
  strip: { position: "absolute", top: 0, left: 0, right: 0 },
  piece: { position: "absolute", top: 0, bottom: 0, overflow: "hidden" },
  handle: { position: "absolute", left: 0, right: 0 },
  shadow: { position: "absolute" },
  burst: {
    position: "absolute",
    backgroundColor: "#1b1f33",
    borderColor: colors.kraft,
  },
  cover: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  edgeRoom: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  edge: { position: "absolute", overflow: "hidden" },
  sheen: { position: "absolute", top: 0, bottom: 0, left: 0 },
  time: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  timeText: {
    overflow: "hidden",
    backgroundColor: "#ffe08a",
    color: "#2a1d05",
    fontFamily: fonts.ui.extrabold,
  },
});
