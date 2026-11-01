import type { CatalogCard } from "@leximon/contract";
import { cardSize, rarityStyles } from "@leximon/tokens";
import {
  cardRelease,
  frequencyLine,
  type RarityStaging,
  speechToggleLabel,
} from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
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
import { CardBack, CardEdge } from "@/cards/card-back";
import { HoloCard } from "@/cards/holo-card";
import { type SpokenWord, useSpokenWord } from "@/cards/spoken-word";
import { play, readPreference, speechOn, vibrate, writePreference } from "@/feedback/feedback";
import { colors, fontSizes, fonts, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";

/** A touch during the first moments of an announcement is ignored: it may be a double tap. */
const TOUCH_GUARD_MS = 350;
const EXIT_MS = 180;
const EDGE_MS = 250;
/** Below this many points, a touch on the card is a tap. */
const TAP_SLOP = 8;
/** The word is said as the face settles, just after the « Nouveau ! » chime when there is one. */
const SPEAK_AFTER_CHIME_MS = 220;

/**
 * One card of the pack: its announcement on the back, then its face, then a touch or a swipe
 * sideways for the next.
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
  /** « Ta première carte Légendaire ! », or `null`. */
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
  /** -1 when the card leaves to the left, +1 to the right. */
  const exitSide = useSharedValue(-1);
  const drag = useSharedValue(0);
  const dim = useSharedValue(0);
  const height = (width * cardSize.height) / cardSize.width;
  const glow = rarityStyles[card.rarity].glow;
  const word = useSpokenWord(card);

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
    play(staging.revealCue);
    vibrate(staging.revealHaptic);
    later(staging.flipMs, () => {
      setSettled(true);
      if (isNew) play("newCard");
      if (!speechOn()) return;
      if (isNew) later(SPEAK_AFTER_CHIME_MS, word.play);
      else word.play();
    });
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
      play(staging.announceCue);
      vibrate(staging.announceHaptic);
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

  const leave = (side: -1 | 1) => {
    if (leaving.current) return;
    leaving.current = true;
    play("cardSlide");
    exitSide.value = side;
    exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
    dim.value = withTiming(0, { duration: EXIT_MS });
    later(EXIT_MS, onNext);
  };

  const press = () => {
    if (!flipped) {
      if (staging.flip === "touch" && touchable) flip();
      return;
    }
    if (settled) leave(-1);
  };

  // The responder is made once: it reads the latest state through this.
  const latest = useRef({ press, leave, settled });
  latest.current = { press, leave, settled };
  const moved = useRef(false);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        moved.current = false;
      },
      onPanResponderMove: (_event, { dx, dy }) => {
        if (Math.hypot(dx, dy) >= TAP_SLOP) moved.current = true;
        // Only a face up card follows the finger: a back keeps its announcement.
        if (latest.current.settled) drag.value = dx;
      },
      onPanResponderRelease: (_event, { dx, dy }) => {
        const { press: tap, leave: away, settled: ready } = latest.current;
        if (!moved.current) {
          tap();
          return;
        }
        if (ready && cardRelease(dx, dy, width) === "next") away(dx < 0 ? -1 : 1);
        else drag.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.back(1.6)) });
      },
      onPanResponderTerminate: () => {
        drag.value = withTiming(0, { duration: 220 });
      },
    }),
  ).current;

  const stage = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [
      { translateX: drag.value + exitSide.value * width * 0.6 * exit.value + shake.value * 3 },
      { translateY: -8 * float.value },
      { rotate: `${shake.value * 1.2 + drag.value / 20 + exitSide.value * exit.value * 8}deg` },
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
        <View
          style={StyleSheet.absoluteFill}
          collapsable={false}
          accessible
          accessibilityRole="button"
          accessibilityLabel={flipped ? `${card.word}, carte suivante` : "Retourner la carte"}
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={press}
          {...responder.panHandlers}
        >
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <CardBack width={width} tone={tone} />
            <Animated.View style={[StyleSheet.absoluteFill, edgeOn]}>
              <CardEdge rarity={card.rarity} width={width} />
            </Animated.View>
            {staging.announce === "crack" && <Cracks width={width} height={height} />}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, face]}>
            <HoloCard
              card={card}
              collectionName={collectionName}
              width={width}
              touchable={settled}
            />
          </Animated.View>
        </View>
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
        {settled && word.available && (
          <Pressable
            onPress={word.play}
            accessibilityRole="button"
            accessibilityLabel={`Écouter ${card.word}`}
            style={[styles.listen, word.playing && styles.listening]}
          >
            <Icon name="play" size={18} color={word.playing ? colors.actionInk : colors.pageInk} />
          </Pressable>
        )}
        {settled && word.available && <SpeechToggle word={word} />}
        {settled && isNew && <Text style={styles.frequency}>{frequencyLine(card.perBillion)}</Text>}
      </View>
    </View>
  );
}

/**
 * Stops the words from being said, this one included, through the setting of the same name.
 * With all sounds off nothing is said anyway: nothing to offer.
 */
function SpeechToggle({ word }: { readonly word: SpokenWord }) {
  const [on, setOn] = useState(() => readPreference("speech"));
  if (!readPreference("sound")) return null;
  const toggle = () => {
    writePreference("speech", !on);
    setOn(!on);
    if (on) word.stop();
  };
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={speechToggleLabel(on)}
      style={styles.listen}
    >
      <Icon name={on ? "sound" : "soundOff"} size={18} color={colors.pageInk} />
    </Pressable>
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
          stroke={colors.giltLight}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  reveal: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.s7 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: colors.dim },
  first: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    color: colors.rubric,
    textAlign: "center",
  },
  glow: { position: "absolute" },
  badge: {
    position: "absolute",
    top: -12,
    right: -10,
    overflow: "hidden",
    paddingHorizontal: space.s6,
    paddingVertical: 5,
    borderRadius: radii.xl,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.label,
    transform: [{ rotate: "6deg" }],
  },
  newBadge: { backgroundColor: colors.sticker, color: colors.inkOnColor },
  copies: { backgroundColor: colors.sheet, color: colors.pageInk },
  under: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s5,
    paddingHorizontal: space.s12,
  },
  listen: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageRaised,
  },
  listening: { backgroundColor: colors.action },
  touchHint: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.pageInkMuted },
  frequency: {
    flexShrink: 1,
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.body,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
});
