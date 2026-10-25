import type { CatalogCard } from "@leximon/contract";
import { cardSize, colors, rarityStyles } from "@leximon/tokens";
import { frequencyLine, type RarityStaging } from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, Polyline, RadialGradient, Stop } from "react-native-svg";
import { Card } from "@/cards/card";
import { CardBack } from "@/cards/card-back";
import { fonts } from "@/theme";

/** A touch during the first moments of an announcement is ignored: it may be a double tap. */
const TOUCH_GUARD_MS = 350;
const EXIT_MS = 180;
const EDGE_MS = 250;

/**
 * One card of the pack: its announcement on the back, then its face, then a touch for the next.
 * Each rarity gets its own staging: the rarer the card, the longer the wait for its face.
 */
export function RevealCard({
  card,
  collectionName,
  staging,
  width,
  isNew,
  copies,
  firstLabel,
  tone,
  onNext,
}: {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly staging: RarityStaging;
  readonly width: number;
  readonly isNew: boolean;
  /** Copies owned once this one is added. */
  readonly copies: number;
  /** « Ta première Légendaire ! », or `null`. */
  readonly firstLabel: string | null;
  /** The `back` of the pack's collection. */
  readonly tone: string | undefined;
  readonly onNext: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [settled, setSettled] = useState(false);
  const [touchable, setTouchable] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flippedRef = useRef(false);
  const leaving = useRef(false);
  const turn = useSharedValue(0);
  const edge = useSharedValue(0);
  const shake = useSharedValue(0);
  const float = useSharedValue(0);
  const exit = useSharedValue(0);
  const dim = useSharedValue(0);
  const height = (width * cardSize.height) / cardSize.width;
  const glow = rarityStyles[card.rarity].glow;

  const later = (ms: number, action: () => void) => {
    timers.current.push(setTimeout(action, ms));
  };

  const flip = () => {
    if (flippedRef.current) return;
    flippedRef.current = true;
    setFlipped(true);
    shake.value = withTiming(0, { duration: 80 });
    float.value = withTiming(0, { duration: 200 });
    turn.value = withTiming(1, {
      duration: staging.flipMs,
      easing: Easing.inOut(Easing.cubic),
    });
    later(staging.flipMs, () => setSettled(true));
  };

  // The staging is read once: a card keeps the one it started with.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per card.
  useEffect(() => {
    if (staging.dim) dim.value = withTiming(1, { duration: 400 });
    if (staging.flip === "instant") {
      flip();
    } else {
      edge.value = withTiming(1, { duration: EDGE_MS });
      announce(staging.announce);
      if (staging.flip === "auto") later(staging.announceMs, flip);
      else later(Math.min(staging.announceMs, TOUCH_GUARD_MS), () => setTouchable(true));
    }
    return () => {
      for (const timer of timers.current) clearTimeout(timer);
    };
  }, []);

  function announce(kind: RarityStaging["announce"]) {
    const amplitude = kind === "tremble" ? 1 : kind === "crack" ? 2.2 : 0;
    if (amplitude > 0) {
      shake.value = withRepeat(
        withSequence(
          withTiming(amplitude, { duration: 45 }),
          withTiming(-amplitude, { duration: 90 }),
          withTiming(0, { duration: 45 }),
          withTiming(0, { duration: kind === "crack" ? 220 : 380 }),
        ),
        -1,
      );
    }
    if (kind === "eclipse") {
      float.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }
  }

  const press = () => {
    if (!flipped) {
      if (staging.flip === "touch" && touchable) flip();
      return;
    }
    if (!settled || leaving.current) return;
    leaving.current = true;
    exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
    dim.value = withTiming(0, { duration: EXIT_MS });
    later(EXIT_MS, onNext);
  };

  const stage = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [
      { translateX: -width * 0.6 * exit.value + shake.value * 3 },
      { translateY: -8 * float.value },
      { rotate: `${shake.value * 1.2 - exit.value * 8}deg` },
      { scale: staging.spotlight ? 1 + 0.06 * turn.value : 1 },
    ],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: turn.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${turn.value * 180}deg` }],
  }));
  const face = useAnimatedStyle(() => ({
    opacity: turn.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${(turn.value - 1) * 180}deg` }],
  }));
  const edgeOn = useAnimatedStyle(() => ({ opacity: edge.value }));
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(turn.value, [0.5, 1], [0, 1], "clamp"),
  }));
  const shade = useAnimatedStyle(() => ({
    opacity: dim.value * (staging.announce === "eclipse" ? 0.8 : 0.6),
  }));

  return (
    <View style={styles.reveal}>
      {staging.dim && <Animated.View style={[styles.dim, shade]} pointerEvents="none" />}
      <Text
        style={[
          styles.first,
          // A card in the spotlight grows: the banner keeps clear of it.
          {
            opacity: firstLabel !== null && settled ? 1 : 0,
            marginBottom: staging.spotlight ? 14 : 0,
          },
        ]}
      >
        {firstLabel ?? " "}
      </Text>
      <Animated.View style={[{ width, height }, stage]}>
        {glow !== null && (
          <Animated.View
            style={[
              styles.glow,
              { left: -width * 0.4, top: -height * 0.25, width: width * 1.8, height: height * 1.5 },
              halo,
            ]}
            pointerEvents="none"
          >
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={glow} stopOpacity={1} />
                  <Stop offset="0.65" stopColor={glow} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#glow)" />
            </Svg>
          </Animated.View>
        )}
        <Pressable
          onPress={press}
          accessibilityRole="button"
          accessibilityLabel={flipped ? `${card.word}, carte suivante` : "Retourner la carte"}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <CardBack rarity={card.rarity} width={width} tone={tone} />
            <Animated.View style={[StyleSheet.absoluteFill, edgeOn]}>
              <CardBack rarity={card.rarity} width={width} edge={1} tone={tone} />
            </Animated.View>
            {staging.announce === "crack" && <Cracks width={width} height={height} />}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, face]}>
            <Card card={card} collectionName={collectionName} width={width} />
          </Animated.View>
        </Pressable>
        {settled && (
          <Text style={[styles.badge, isNew ? styles.newBadge : styles.copies]}>
            {isNew ? "Nouveau !" : `×${copies}`}
          </Text>
        )}
      </Animated.View>
      <View style={styles.under}>
        {!flipped && staging.flip === "touch" && touchable && (
          <Text style={styles.touchHint}>Touche la carte</Text>
        )}
        {settled && isNew && <Text style={styles.frequency}>{frequencyLine(card.perBillion)}</Text>}
      </View>
    </View>
  );
}

/** Gold cracks drawn on the back of an Épique before it turns. */
function Cracks({ width, height }: { readonly width: number; readonly height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 300 420" style={StyleSheet.absoluteFill}>
      {[
        "150,210 128,168 136,130 112,92 118,40",
        "150,210 184,188 206,150 246,138 280,96",
        "150,210 170,252 160,296 188,340 180,392",
        "150,210 110,236 82,232 52,270 20,282",
        "136,130 168,112",
        "170,252 214,262",
      ].map((points) => (
        <Polyline
          key={points}
          points={points}
          fill="none"
          stroke="#FFE08A"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  reveal: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "#06070D" },
  first: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.accent,
    textAlign: "center",
  },
  glow: { position: "absolute" },
  badge: {
    position: "absolute",
    top: -12,
    right: -10,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    fontFamily: fonts.ui.extrabold,
    fontSize: 14,
    transform: [{ rotate: "6deg" }],
  },
  newBadge: { backgroundColor: colors.sticker, color: "#fff" },
  copies: { backgroundColor: colors.sheet, color: colors.text },
  under: { minHeight: 24, alignItems: "center", paddingHorizontal: 24 },
  touchHint: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.textMuted },
  frequency: {
    fontFamily: fonts.text.italic,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
});
