import type { JoustView, Progress } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
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
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useCatalog } from "@/cards/use-catalog";
import { play } from "@/feedback/feedback";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { catalogCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { Leaf, Lettering } from "@/ui/toy";
import {
  ANSWER_MS,
  AnswerCards,
  type Duelist,
  DuelistFace,
  ink,
  LeafKicker,
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

/**
 * The player's run is played, the other's not yet: the answers turn one by one, the score counts,
 * the XP fills the bar; then the words the other has to find, and how long they have.
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
  const answers = view.run?.answers ?? [];
  const xp = view.run?.xp ?? 0;
  const found = answers.filter((answer) => answer.correct).length;
  const counted = useTicker(found, answers.length * ANSWER_MS + 300, 220);
  const traps = view.traps ?? [];
  const trapFit = useRowFit(traps.length, space.s3, 64);

  return (
    <View style={styles.run}>
      <Leaf style={pieces.leaf}>
        <LeafKicker>{kicker}</LeafKicker>
        <View style={styles.title}>
          <Lettering size={fontSizes.titleLarge}>{RUN_DONE}</Lettering>
        </View>
        <AnswerCards answers={answers} width={64} />
        <View style={styles.score}>
          <Lettering size={fontSizes.headingLarge}>{`${counted} / ${answers.length}`}</Lettering>
          <View style={styles.scoreTime}>
            <Icon name="clock" size={16} color={ink.pageInkMuted} />
            <Text style={styles.scoreTimeText}>{runSeconds(answers)}</Text>
          </View>
        </View>
        {xp > 0 && progress !== null && <XpBar key={progress.xp} progress={progress} xp={xp} />}
      </Leaf>

      <Animated.View entering={FadeInUp.delay(400).duration(320)}>
        <Leaf style={pieces.leaf}>
          <LeafKicker>{TRAPS_TITLE}</LeafKicker>
          <Text style={pieces.line}>{trapsLine(traps.length, view.summary.opponent)}</Text>
          {catalog !== null && (
            <View style={styles.traps} onLayout={trapFit.onLayout}>
              {traps.map((cardId, index) => (
                <Animated.View
                  key={cardId}
                  entering={FadeInUp.delay(600 + index * 90).duration(260)}
                  style={{ transform: [{ rotate: `${(index % 2 === 0 ? -1 : 1) * 3}deg` }] }}
                >
                  <MiniCard card={catalogCard(catalog, cardId)} width={trapFit.width} />
                </Animated.View>
              ))}
            </View>
          )}
          <View style={styles.waiting}>
            <DuelistFace duelist={them} size={48} />
            <Looping kind="turn">
              <Icon name="clock" size={22} color={ink.rubric} />
            </Looping>
            <Text style={styles.waitingText}>
              {waitingLine(view.summary.opponent, view.summary.replyBy, Date.now())}
            </Text>
          </View>
          <Notice>{refusal}</Notice>
          <View style={pieces.actions}>
            <MainAction label={NEW_JOUST} disabled={busy} onPress={onNew} />
            <PaperAction label={BACK_TO_JOUSTS} onPress={onBack} />
          </View>
        </Leaf>
      </Animated.View>
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
  run: { gap: space.s8 },
  title: { alignItems: "center" },
  score: { alignItems: "center", gap: space.s2 },
  scoreTime: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  scoreTimeText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInkMuted },
  xp: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  xpLabel: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
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
  traps: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s3 },
  waiting: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  waitingText: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
});
