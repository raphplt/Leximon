import type { CatalogCollectionFile } from "@leximon/contract";
import {
  backTone,
  colors,
  motion,
  type PackMotif,
  packLook,
  sealBeads,
  sealBox,
  sealGold,
  sealScallopPath,
} from "@leximon/tokens";
import {
  sachetContents,
  TEAR_COMPLETE_AT,
  TEAR_STARTED_AT,
  tearProgress,
} from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  PanResponder,
  type PanResponderInstance,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { catalogFileUrl } from "@/cards/catalog";
import { fonts } from "@/theme";

/** The pouch is drawn on a 236 × 410 grid, scaled to its width. */
const GRID = { width: 236, height: 410 } as const;
const CRIMP = 22;
const TOOTH = 9;
/** Where the seal sits on the pouch, and how large. */
const SEAL = { x: 43, y: 150, size: 150 } as const;
/** The strip torn off: the top crimp down to the dotted line. */
const STRIP = 62;
/** Below this many points, a touch on the strip is a tap, not a pull. */
const TAP_SLOP = 8;

export type SachetState = "sealed" | "empty" | "opening";

/**
 * The pack as a classic booster: a foil pouch crimped at both ends, the collection's colours,
 * motif and gold seal, its name on a kraft ribbon. Touching it opens it, and so does tearing its
 * strip along the dotted line: the strip follows the finger, opens past 60 % and sticks back
 * below.
 */
export function Sachet({
  collection,
  state,
  width,
  refill,
  refillLabel,
  onTearStart,
  onOpen,
}: {
  readonly collection: CatalogCollectionFile;
  readonly state: SachetState;
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
  const burst = useSharedValue(0);

  useEffect(() => {
    if (state !== "sealed" || reduced) {
      cancelAnimation(sway);
      sway.value = withTiming(0, { duration: 200 });
      return;
    }
    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [state, reduced, sway]);

  useEffect(() => {
    burst.value =
      state === "opening" && !reduced
        ? withTiming(1, { duration: motion.sealBreak, easing: Easing.in(Easing.cubic) })
        : 0;
  }, [state, reduced, burst]);

  const tear = useTear({ enabled: state === "sealed", width, onTearStart, onOpen });

  const animated = useAnimatedStyle(() => {
    const shake = burst.value < 0.4 ? Math.sin(burst.value * 60) * 3 : 0;
    return {
      opacity: 1 - Math.max(0, burst.value - 0.55) / 0.45,
      transform: [
        { translateY: -14 * burst.value },
        { rotate: `${sway.value * 1.6 + shake}deg` },
        { scale: 1 + 0.1 * burst.value },
      ],
    };
  });

  return (
    <Pressable
      onPress={onOpen}
      disabled={state !== "sealed"}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le sachet ${collection.name}`}
      accessibilityState={{ disabled: state !== "sealed" }}
    >
      <Animated.View style={[{ width, height }, animated]}>
        {tear.layered ? (
          <TornPouch collection={collection} u={u} tear={tear} />
        ) : (
          <Pouch collection={collection} u={u} />
        )}
        {collection.engraving !== undefined && (
          <SealEngraving ink={collection.engraving.ink} u={u} />
        )}
        {state === "empty" && <Waiting refill={refill} label={refillLabel} u={u} />}
        {state === "sealed" && (
          <View
            style={[styles.strip, { height: STRIP * u }]}
            // Without it, the empty view is flattened away and never receives the finger.
            collapsable={false}
            {...tear.handlers}
            importantForAccessibility="no-hide-descendants"
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

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
}: {
  readonly enabled: boolean;
  readonly width: number;
  readonly onTearStart: () => void;
  readonly onOpen: () => void;
}): Tear {
  const progress = useSharedValue(0);
  const direction = useSharedValue(1);
  const [layered, setLayered] = useState(false);
  // The responder is made once: it reads the latest props through this.
  const latest = useRef({ enabled, width, onTearStart, onOpen });
  latest.current = { enabled, width, onTearStart, onOpen };
  const started = useRef(false);
  /** Whether the finger went past the tap slop at any point of this touch. */
  const moved = useRef(false);

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
        progress.value = next;
      },
      onPanResponderRelease: () => {
        const { onTearStart: start, onOpen: open } = latest.current;
        if (!moved.current) {
          // A tap on the strip opens the pouch like a tap anywhere else.
          setLayered(false);
          start();
          open();
          return;
        }
        if (progress.value >= TEAR_COMPLETE_AT) {
          progress.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
          start();
          open();
          return;
        }
        // The strip sticks back. A request already sent is kept for the next try.
        progress.value = withTiming(0, { duration: 180 }, (finished) => {
          if (finished) scheduleOnRN(setLayered, false);
        });
      },
      onPanResponderTerminate: () => {
        progress.value = withTiming(0, { duration: 180 });
        setLayered(false);
      },
    }),
  ).current;

  return { layered, progress, direction, handlers: responder.panHandlers };
}

/**
 * The pouch cut in three while its strip is pulled: the body, the strip still on, and the piece
 * torn off, which lifts from where it still holds.
 */
function TornPouch({
  collection,
  u,
  tear,
}: {
  readonly collection: CatalogCollectionFile;
  readonly u: number;
  readonly tear: Tear;
}) {
  const width = GRID.width * u;
  const strip = STRIP * u;
  const { progress, direction } = tear;

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
      opacity: share >= 1 ? 0 : 1,
      transformOrigin: direction.value === 1 ? "right bottom" : "left bottom",
      transform: [
        { translateY: -share * 8 * u },
        { rotate: `${-direction.value * share * 14}deg` },
      ],
    };
  });
  const tornInner = useAnimatedStyle(() => ({
    transform: [{ translateX: direction.value === 1 ? 0 : -width * (1 - progress.value) }],
  }));

  return (
    <>
      <View style={[styles.layer, { top: strip, height: GRID.height * u - strip, width }]}>
        <View style={{ marginTop: -strip }}>
          <Pouch collection={collection} u={u} />
        </View>
      </View>
      <Animated.View style={[styles.layer, { top: 0, height: strip }, kept]}>
        <Animated.View style={keptInner}>
          <Pouch collection={collection} u={u} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.layer, { top: 0, height: strip }, torn]}>
        <Animated.View style={tornInner}>
          <Pouch collection={collection} u={u} />
        </Animated.View>
      </Animated.View>
    </>
  );
}

function Pouch({
  collection,
  u,
}: {
  readonly collection: CatalogCollectionFile;
  readonly u: number;
}) {
  const tone = backTone(collection.back);
  const look = packLook(collection.id);
  const teeth = Math.round(GRID.width / TOOTH);
  const toothWidth = GRID.width / teeth;
  const edge = (y: number, up: boolean) =>
    Array.from({ length: teeth }, (_, k) => {
      const x = k * toothWidth;
      return `L${x + toothWidth / 2} ${up ? y - 4 : y + 4} L${x + toothWidth} ${y}`;
    }).join(" ");
  const topCrimp = `M0 ${CRIMP} L0 4 ${edge(4, true)} L${GRID.width} ${CRIMP} Z`;
  const bottomCrimp = `M0 ${GRID.height - CRIMP} L0 ${GRID.height - 4} ${edge(GRID.height - 4, false)} L${GRID.width} ${GRID.height - CRIMP} Z`;
  return (
    <Svg
      width={GRID.width * u}
      height={GRID.height * u}
      viewBox={`0 0 ${GRID.width} ${GRID.height}`}
    >
      <Defs>
        <RadialGradient id="tone" cx="50%" cy="42%" rx="75%" ry="60%">
          <Stop offset="0" stopColor={tone.light} />
          <Stop offset="1" stopColor={tone.dark} />
        </RadialGradient>
        <LinearGradient id="volume" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity={0.45} />
          <Stop offset="0.18" stopColor="#000" stopOpacity={0.05} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0.07} />
          <Stop offset="0.82" stopColor="#000" stopOpacity={0.05} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </LinearGradient>
        <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          {sealGold.map(([color, offset]) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
        <Pattern id="ridges" patternUnits="userSpaceOnUse" width={3} height={10}>
          <Rect width={1.4} height={10} fill="#000" opacity={0.45} />
        </Pattern>
        <Motif motif={look.motif} />
      </Defs>
      <Rect
        y={CRIMP - 4}
        width={GRID.width}
        height={GRID.height - 2 * CRIMP + 8}
        fill="url(#tone)"
      />
      <Rect
        y={CRIMP - 4}
        width={GRID.width}
        height={GRID.height - 2 * CRIMP + 8}
        fill="url(#motif)"
      />
      <Path d={topCrimp} fill={tone.dark} />
      <Path d={topCrimp} fill="url(#ridges)" />
      <Path d={bottomCrimp} fill={tone.dark} />
      <Path d={bottomCrimp} fill="url(#ridges)" />
      <Line
        x1={0}
        y1={62}
        x2={GRID.width}
        y2={62}
        stroke={colors.kraft}
        strokeOpacity={0.7}
        strokeWidth={1.2}
        strokeDasharray="5 4"
      />
      <SvgText
        x={GRID.width - 18}
        y={50}
        fill={colors.kraft}
        fillOpacity={0.75}
        fontFamily={fonts.ui.bold}
        fontSize={10}
        textAnchor="end"
      >
        déchirer ici ▸
      </SvgText>
      <SvgText
        x={GRID.width / 2}
        y={128}
        fill="url(#gold)"
        fontFamily={fonts.text.medium}
        fontSize={17}
        letterSpacing={5}
        textAnchor="middle"
      >
        LEXIMON
      </SvgText>
      <G transform={`translate(${SEAL.x} ${SEAL.y}) scale(${SEAL.size / sealBox})`}>
        <Seal
          collectionId={collection.id}
          engraved={collection.engraving !== undefined}
          tone={tone}
        />
      </G>
      <Polygon points="30,300 206,292 214,326 22,334" fill={colors.kraft} />
      <Polygon points="30,300 206,292 207,297 31,305" fill="#fff" opacity={0.25} />
      <SvgText
        x={GRID.width / 2}
        y={319}
        fill={colors.kraftTitle}
        fontFamily={fonts.display}
        fontSize={collection.name.length > 18 ? 13 : 16}
        textAnchor="middle"
        rotation={-2.5}
        origin={`${GRID.width / 2}, 315`}
      >
        {collection.name}
      </SvgText>
      <SvgText
        x={GRID.width / 2}
        y={356}
        fill={colors.kraft}
        fillOpacity={0.8}
        fontFamily={fonts.ui.bold}
        fontSize={9}
        letterSpacing={2.5}
        textAnchor="middle"
      >
        {sachetContents(Date.now()).toUpperCase()}
      </SvgText>
      <Circle cx={196} cy={360} r={15} fill={colors.seal} />
      <Circle cx={196} cy={360} r={15} fill="none" stroke={colors.sealDark} strokeWidth={2.5} />
      <SvgText
        x={196}
        y={366}
        fill={colors.sealLight}
        fontFamily={fonts.display}
        fontSize={17}
        textAnchor="middle"
      >
        L
      </SvgText>
      <Rect
        y={CRIMP - 4}
        width={GRID.width}
        height={GRID.height - 2 * CRIMP + 8}
        fill="url(#volume)"
      />
    </Svg>
  );
}

/** The foil's faint pattern, in kraft. */
function Motif({ motif }: { readonly motif: PackMotif }) {
  if (motif === "dots") {
    return (
      <Pattern id="motif" patternUnits="userSpaceOnUse" width={22} height={22}>
        <Circle cx={11} cy={11} r={1.4} fill={colors.kraft} opacity={0.22} />
      </Pattern>
    );
  }
  if (motif === "hatch") {
    return (
      <Pattern
        id="motif"
        patternUnits="userSpaceOnUse"
        width={11}
        height={11}
        patternTransform="rotate(45)"
      >
        <Rect width={1} height={11} fill={colors.kraft} opacity={0.16} />
      </Pattern>
    );
  }
  return (
    <Pattern id="motif" patternUnits="userSpaceOnUse" width={24} height={24}>
      <Rect width={24} height={1} fill={colors.kraft} opacity={0.14} />
      <Rect width={1} height={24} fill={colors.kraft} opacity={0.14} />
    </Pattern>
  );
}

/** The scalloped gold rosette, its ring of beads and its field; the emblem when not engraved. */
function Seal({
  collectionId,
  engraved,
  tone,
}: {
  readonly collectionId: string;
  readonly engraved: boolean;
  readonly tone: { readonly light: string; readonly dark: string };
}) {
  const look = packLook(collectionId);
  return (
    <G>
      <Defs>
        <RadialGradient id="field" cx="50%" cy="38%" r="65%">
          <Stop offset="0" stopColor={tone.light} />
          <Stop offset="1" stopColor={tone.dark} />
        </RadialGradient>
      </Defs>
      <Path d={sealScallopPath} fill="url(#gold)" />
      <Path d={sealScallopPath} fill="none" stroke="#5a3a0c" strokeOpacity={0.45} strokeWidth={1} />
      <Circle cx={60} cy={60} r={49} fill="none" stroke="#6b4510" strokeOpacity={0.5} />
      {sealBeads.map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill="#6b4510" fillOpacity={0.55} />
      ))}
      <Circle cx={60} cy={60} r={42} fill="url(#field)" />
      <Circle
        cx={60}
        cy={60}
        r={42}
        fill="none"
        stroke="#2a1a04"
        strokeOpacity={0.6}
        strokeWidth={2}
      />
      {!engraved && (
        <G
          transform="translate(32 32) scale(0.875)"
          stroke="#f3d58a"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {look.emblem.map((d, index) => (
            <Path
              key={d}
              d={d}
              fill={index < look.solid ? "url(#gold)" : "none"}
              fillOpacity={index < look.solid ? 0.28 : 1}
            />
          ))}
        </G>
      )}
    </G>
  );
}

/** The collection's engraving in the seal's field, tinted gold: the ink file is an alpha mask. */
function SealEngraving({ ink, u }: { readonly ink: string; readonly u: number }) {
  const scale = (SEAL.size / sealBox) * u;
  const field = 40 * scale;
  return (
    <View
      style={[
        styles.field,
        {
          left: (SEAL.x + 60 * (SEAL.size / sealBox)) * u - field,
          top: (SEAL.y + 60 * (SEAL.size / sealBox)) * u - field,
          width: field * 2,
          height: field * 2,
          borderRadius: field,
        },
      ]}
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={{ uri: catalogFileUrl(ink) }}
        resizeMode="contain"
        style={{
          position: "absolute",
          left: (22 - 20) * scale,
          top: (21 - 20) * scale,
          width: 76 * scale,
          height: 78 * scale,
          tintColor: "#EBC66E",
        }}
      />
    </View>
  );
}

/** An empty pouch, greyed down to where the next one has filled, with when it comes. */
function Waiting({
  refill,
  label,
  u,
}: {
  readonly refill: number | null;
  readonly label: string | null;
  readonly u: number;
}) {
  const body = GRID.height - 2 * CRIMP;
  const grey = body * (1 - (refill ?? 0));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width={GRID.width * u}
        height={GRID.height * u}
        viewBox={`0 0 ${GRID.width} ${GRID.height}`}
      >
        <Rect width={GRID.width} height={CRIMP + grey} fill="#14172A" opacity={0.62} />
        <Rect
          y={GRID.height - CRIMP}
          width={GRID.width}
          height={CRIMP}
          fill="#14172A"
          opacity={0.62}
        />
        {refill !== null && (
          <Line
            x1={0}
            y1={CRIMP + grey}
            x2={GRID.width}
            y2={CRIMP + grey}
            stroke={colors.accent}
            strokeWidth={2}
          />
        )}
        {refill !== null && label !== null && (
          <G>
            <Rect
              x={GRID.width / 2 - 44}
              y={190}
              width={88}
              height={30}
              rx={15}
              fill="#14172A"
              opacity={0.85}
            />
            <SvgText
              x={GRID.width / 2}
              y={210}
              fill={colors.text}
              fontFamily={fonts.ui.extrabold}
              fontSize={15}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { position: "absolute", overflow: "hidden" },
  layer: { position: "absolute", left: 0, overflow: "hidden" },
  strip: { position: "absolute", top: 0, left: 0, right: 0 },
});
