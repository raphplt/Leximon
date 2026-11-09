import type { JoustView, Progress } from "@leximon/contract";
import { lettering, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  BACK_TO_JOUSTS,
  NEW_JOUST,
  RUN_DONE,
  runSeconds,
  TRAPS_TITLE,
  trapsLine,
  waitingLine,
  xpGainText,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useCatalog } from "@/cards/use-catalog";
import { play, vibrate } from "@/feedback/feedback";
import { DESK_PADDING, Desk, MainAction, PaperAction } from "@/library/play-pieces";
import { catalogCard } from "@/screens/trades/card-row";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { Lettering } from "@/ui/toy";
import {
  AnswerCards,
  type Duelist,
  DuelistFace,
  ink,
  Looping,
  MiniCard,
  Notice,
  pieces,
  useRowFit,
} from "./pieces";

/** Counts up to `target`, one step at a time, after `startMs`. */
function useTicker(target: number, startMs: number, stepMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    const timers = Array.from({ length: target }, (_, index) =>
      setTimeout(
        () => {
          setValue(index + 1);
          play("cardSlide");
        },
        startMs + index * stepMs,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [target, startMs, stepMs]);
  return value;
}

/** The score is struck on its plaque once the cards have turned; the XP flows in after. */
const STRIKE_MS = 1_500;
const XP_MS = 1_900;

/**
 * The player's run is played, the other's not yet, as a scene on the green desk: the answers
 * turn one by one, the score is struck on a gold plaque and counts, the XP fills the bar with the
 * sound of coins; then the words the other has to find, and how long they have. As on the web.
 */
export function RunSummary({
  view,
  them,
  kicker,
  progress,
  busy,
  refusal,
  onNew,
  onBack,
}: {
  readonly view: JoustView;
  readonly them: Duelist;
  readonly kicker: string;
  readonly progress: Progress | null;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onNew: () => void;
  readonly onBack: () => void;
}) {
  const catalog = useCatalog();
  const reduced = useReducedMotion();
  const answers = view.run?.answers ?? [];
  const xp = view.run?.xp ?? 0;
  const found = answers.filter((answer) => answer.correct).length;
  const counted = useTicker(found, STRIKE_MS + 200, 220);
  const traps = view.traps ?? [];
  const trapFit = useRowFit(traps.length, space.s3, 60);
  const strike = useSharedValue(reduced ? 1 : 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: plays once, when the scene appears
  useEffect(() => {
    play("recap");
    strike.value = withDelay(
      STRIKE_MS,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.back(2.4)) }),
    );
    const struck = setTimeout(() => {
      play("crack");
      vibrate([20]);
    }, STRIKE_MS);
    const coins = xp > 0 ? setTimeout(() => play("coins"), XP_MS) : undefined;
    return () => {
      clearTimeout(struck);
      clearTimeout(coins);
    };
  }, []);

  const struckIn = useAnimatedStyle(() => ({
    opacity: strike.value === 0 ? 0 : 1,
    transform: [{ scale: 2.2 - 1.2 * strike.value }],
  }));

  return (
    <View style={styles.arena}>
      <Desk style={StyleSheet.absoluteFill} />
      <Text style={styles.kicker}>{kicker}</Text>
      <View style={styles.title}>
        <Lettering size={fontSizes.titleLarge}>{RUN_DONE}</Lettering>
      </View>
      <AnswerCards answers={answers} width={64} onDesk />
      <Animated.View style={[styles.plaque, struckIn]}>
        <Lettering size={fontSizes.headingLarge} color={toyValues.outline}>
          {`${counted} / ${answers.length}`}
        </Lettering>
        <View style={styles.scoreTime}>
          <Icon name="clock" size={16} color={toyValues.outline} />
          <Text style={styles.scoreTimeText}>{runSeconds(answers)}</Text>
        </View>
      </Animated.View>
      {xp > 0 && progress !== null && <XpBar key={progress.xp} progress={progress} xp={xp} />}

      <Animated.View entering={FadeInUp.delay(XP_MS).duration(320)} style={styles.wait}>
        <View style={styles.waiting}>
          <DuelistFace duelist={them} size={48} />
          <Looping kind="turn">
            <Icon name="clock" size={22} color={lettering.kicker} />
          </Looping>
          <Text style={styles.waitingText}>
            {waitingLine(view.summary.opponent, view.summary.replyBy, Date.now())}
          </Text>
        </View>
        <Text style={styles.trapsText}>
          <Text style={styles.trapsTitle}>{`${TRAPS_TITLE}. `}</Text>
          {trapsLine(traps.length, view.summary.opponent)}
        </Text>
        {catalog !== null && (
          <View style={styles.traps} onLayout={trapFit.onLayout}>
            {traps.map((cardId, index) => (
              <Animated.View
                key={cardId}
                entering={FadeInUp.delay(XP_MS + 200 + index * 90).duration(260)}
                style={{ transform: [{ rotate: `${(index % 2 === 0 ? -1 : 1) * 3}deg` }] }}
              >
                <MiniCard card={catalogCard(catalog, cardId)} width={trapFit.width} />
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>
      <Notice>{refusal}</Notice>
      <View style={pieces.actions}>
        <MainAction label={NEW_JOUST} disabled={busy} onPress={onNew} />
        <PaperAction label={BACK_TO_JOUSTS} onPress={onBack} />
      </View>
    </View>
  );
}

/** The level's bar, filling with what the run gave. */
function XpBar({ progress, xp }: { readonly progress: Progress; readonly xp: number }) {
  const total = Math.max(1, progress.xpForNextLevel);
  const to = Math.min(1, progress.xpIntoLevel / total);
  const from = Math.max(0, (progress.xpIntoLevel - xp) / total);
  const fill = useSharedValue(from);
  useEffect(() => {
    fill.value = withDelay(
      900,
      withTiming(to, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
  }, [fill, to]);
  const width = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={styles.xp}>
      <Text style={styles.xpLabel}>Niveau {progress.level}</Text>
      <View style={styles.xpBar}>
        <Animated.View style={[styles.xpFill, width]} />
      </View>
      <Lettering size={fontSizes.body}>{xpGainText(xp)}</Lettering>
    </View>
  );
}

const styles = StyleSheet.create({
  arena: { padding: DESK_PADDING, gap: space.s6, overflow: "hidden" },
  kicker: {
    fontFamily: fonts.displayBold,
    textAlign: "center",
    fontSize: fontSizes.body,
    color: lettering.kicker,
  },
  title: { alignItems: "center" },
  plaque: {
    alignSelf: "center",
    alignItems: "center",
    gap: space.s1,
    minWidth: 160,
    paddingHorizontal: space.s8,
    paddingVertical: space.s3,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: toyValues.outline,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.gold.top}, ${toyMatters.gold.bottom})`,
    boxShadow: `0 5px 0 ${toyValues.outline}`,
  },
  scoreTime: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  scoreTimeText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: toyValues.outline },
  xp: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  xpLabel: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: lettering.fill },
  xpBar: {
    flex: 1,
    height: 14,
    overflow: "hidden",
    borderRadius: 7,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: ink.track,
  },
  xpFill: { height: "100%", backgroundColor: toyMatters.gold.top },
  wait: {
    gap: space.s4,
    padding: space.s5,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: alpha(toyMatters.gold.top, 0.45),
    backgroundColor: alpha(toyValues.outline, 0.35),
  },
  traps: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s3 },
  trapsText: {
    textAlign: "center",
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: lettering.fill,
  },
  trapsTitle: { fontFamily: fonts.ui.extrabold },
  waiting: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  waitingText: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: lettering.fill,
  },
});
