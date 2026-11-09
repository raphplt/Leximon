import { effects, lettering, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  CLIMB_KICKER,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  type LeagueClimb,
} from "@leximon/view-model";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { play, vibrate } from "@/feedback/feedback";
import { MainAction } from "@/library/play-pieces";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { useStage } from "@/ui/stage";
import { Lettering, ToyIcon } from "@/ui/toy";
import { Crest } from "./crest";
import { LeatherStage } from "./hall";
import { ink, Notice } from "./pieces";

/** The old crest trembles this long, then breaks; the new one falls once the halves are gone. */
const TREMBLE_MS = 900;
const BREAK_MS = 600;
const FALL_MS = 380;
const OLD = 150;
const NEW = 170;

/**
 * A league climbed, played like a level reached: the old crest trembles and breaks, the new one
 * falls in a rain of gold, then what the week gives and the button that claims it. As on the web.
 */
export function ClimbScene({
  climb,
  busy,
  refusal,
  onClaim,
}: {
  readonly climb: LeagueClimb;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onClaim: () => void;
}) {
  const stage = useStage();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<"old" | "break" | "new">("old");
  const crest = useRef<ViewInstance>(null);
  const tremble = useSharedValue(0);
  const split = useSharedValue(0);
  const fall = useSharedValue(reduced ? 0 : -260);

  // biome-ignore lint/correctness/useExhaustiveDependencies: plays once, when the scene appears
  useEffect(() => {
    play("rumble");
    if (!reduced) {
      tremble.value = withRepeat(withTiming(2, { duration: 60 }), -1, true);
    }
    const crack = setTimeout(() => {
      setPhase("break");
      play("crack");
      vibrate([30]);
      tremble.value = 0;
      split.value = withTiming(1, { duration: BREAK_MS, easing: Easing.in(Easing.quad) });
    }, TREMBLE_MS);
    const land = setTimeout(() => {
      setPhase("new");
      fall.value = withSequence(
        withTiming(12, { duration: 420, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 260 }),
      );
    }, TREMBLE_MS + BREAK_MS);
    return () => {
      clearTimeout(crack);
      clearTimeout(land);
    };
  }, []);

  useEffect(() => {
    if (phase !== "new") return;
    const gold = setTimeout(() => {
      crest.current?.measureInWindow((x, y, width, height) => {
        stage.burst(x + width / 2, y + height / 2, effects.reward);
      });
      stage.rain(40);
      play("fanfareEpic");
      vibrate([20, 60, 40]);
    }, FALL_MS);
    return () => clearTimeout(gold);
  }, [phase, stage]);

  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: tremble.value }] }));
  const left = useAnimatedStyle(() => ({
    opacity: 1 - split.value,
    transform: [
      { translateX: -80 * split.value },
      { translateY: 120 * split.value },
      { rotate: `${-28 * split.value}deg` },
    ],
  }));
  const right = useAnimatedStyle(() => ({
    opacity: 1 - split.value,
    transform: [
      { translateX: 80 * split.value },
      { translateY: 120 * split.value },
      { rotate: `${28 * split.value}deg` },
    ],
  }));
  const falling = useAnimatedStyle(() => ({ transform: [{ translateY: fall.value }] }));

  return (
    <LeatherStage style={styles.arena}>
      <Text style={styles.kicker}>{CLIMB_KICKER}</Text>
      <View ref={crest} collapsable={false} style={styles.stage}>
        {phase !== "new" ? (
          <Animated.View style={[styles.old, shaking]}>
            <Animated.View style={[styles.half, left]}>
              <Crest league={climb.from} size={OLD} />
            </Animated.View>
            <Animated.View style={[styles.half, styles.halfRight, right]}>
              <View style={styles.shifted}>
                <Crest league={climb.from} size={OLD} />
              </View>
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.new, falling]}>
            <View style={styles.glow} />
            <Crest league={climb.to} size={NEW} />
          </Animated.View>
        )}
      </View>
      {phase === "new" && (
        <Animated.View entering={FadeInUp.delay(500).duration(420)} style={styles.text}>
          <Lettering size={fontSizes.title} style={styles.centered}>
            {climb.title}
          </Lettering>
          <Text style={styles.line}>{climb.line}</Text>
          <View style={styles.gains}>
            {climb.gains.map((gain) => (
              <View key={gain.text} style={styles.gain}>
                <ToyIcon name={gain.icon} size={24} />
                <Text style={styles.gainText}>{gain.text}</Text>
              </View>
            ))}
          </View>
          <MainAction
            label={busy ? LEAGUE_CLAIM_BUSY : LEAGUE_CLAIM}
            disabled={busy}
            onPress={onClaim}
          />
          <Notice>{refusal}</Notice>
        </Animated.View>
      )}
    </LeatherStage>
  );
}

const styles = StyleSheet.create({
  arena: { minHeight: 440, alignItems: "center", justifyContent: "center", gap: space.s6 },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: lettering.kicker,
  },
  stage: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  old: { width: OLD, height: OLD * 1.16, flexDirection: "row" },
  // Each half shows its side of the same crest: the crack runs down the middle.
  half: { width: OLD / 2, height: "100%", overflow: "hidden" },
  halfRight: { alignItems: "flex-start" },
  shifted: { marginLeft: -OLD / 2 },
  new: { alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute",
    width: NEW + 60,
    height: NEW + 60,
    borderRadius: (NEW + 60) / 2,
    backgroundImage: `radial-gradient(circle, ${alpha(toyMatters.gold.top, 0.55)} 0%, transparent 65%)`,
  },
  text: { alignSelf: "stretch", alignItems: "center", gap: space.s5 },
  centered: { textAlign: "center" },
  line: {
    textAlign: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: lettering.fill,
  },
  gains: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s4 },
  gain: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingHorizontal: space.s5,
    paddingVertical: space.s3,
    borderRadius: radii.lg,
    borderWidth: 2.5,
    borderColor: toyValues.outline,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.paper.top}, ${toyMatters.paper.bottom})`,
    boxShadow: `0 3px 0 ${toyValues.outline}`,
  },
  gainText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
});
