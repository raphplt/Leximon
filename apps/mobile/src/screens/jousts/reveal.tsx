import type { JoustOutcome, JoustView } from "@leximon/contract";
import { rarityLights, revealEffects, type ToyMatterName, toyMatters } from "@leximon/tokens";
import {
  answerTimeText,
  OPEN_SEALED,
  outcomeWord,
  REPLAY_REVEAL,
  SEALED_RESULT,
  sachetGainText,
  xpGainText,
} from "@leximon/view-model";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewInstance } from "react-native";
import Animated, { FadeInUp, Keyframe } from "react-native-reanimated";
import { useCatalog } from "@/cards/use-catalog";
import { play, vibrate } from "@/feedback/feedback";
import { catalogCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { useStage } from "@/ui/stage";
import { Leaf, Lettering, ToyBody, ToyIcon } from "@/ui/toy";
import { TournamentGain } from "./league-pieces";
import { type Duelist, DuelistFace, ink, LeafKicker, Looping, pieces } from "./pieces";

export interface RevealAnswer {
  readonly cardId: string;
  readonly correct: boolean;
  readonly ms: number;
}

export interface RevealData {
  readonly me: Duelist;
  readonly them: Duelist;
  readonly mine: readonly RevealAnswer[];
  /** `null` when the other never played. */
  readonly theirs: readonly RevealAnswer[] | null;
  readonly outcome: JoustOutcome | null;
  /** What the joust gave; `null` in training. */
  readonly gains: {
    readonly xp: number;
    readonly boosters: number;
    /** A ranked joust's points in the week's tournament. */
    readonly tournament: NonNullable<JoustView["result"]>["tournament"];
  } | null;
  /** The last line: the words that trapped the other, or why the joust ended without them. */
  readonly closing: string | null;
}

const ROW_MS = 650;
const FIRST_ROW_MS = 900;

/** A row of the board turns over like a card. */
const rowIn = new Keyframe({
  0: { opacity: 0, transform: [{ perspective: 600 }, { rotateX: "90deg" }] },
  100: { opacity: 1, transform: [{ perspective: 600 }, { rotateX: "0deg" }] },
}).duration(300);

/** The banner lands like a seal pressed on the page. */
const bannerIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 2.2 }, { rotate: "-4deg" }] },
  60: { opacity: 1, transform: [{ scale: 0.94 }, { rotate: "-4deg" }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "-4deg" }] },
}).duration(460);

const BANNER_MATTERS: Readonly<Record<JoustOutcome, ToyMatterName>> = {
  won: "gold",
  lost: "red",
  draw: "paper",
};

/** A result not watched yet: a sealed letter to break. */
export function SealedResult({
  kicker,
  onOpen,
}: {
  readonly kicker: string;
  readonly onOpen: () => void;
}) {
  return (
    <Leaf style={pieces.leaf}>
      <LeafKicker>{kicker}</LeafKicker>
      <Pressable
        style={styles.pli}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${SEALED_RESULT}. ${OPEN_SEALED}`}
      >
        <Looping kind="wobble">
          <ToyIcon name="mail" size={96} />
        </Looping>
        <Lettering size={fontSizes.title}>{SEALED_RESULT}</Lettering>
        <Text style={pieces.line}>{OPEN_SEALED}</Text>
      </Pressable>
    </Leaf>
  );
}

/**
 * The result: the two players face to face, the questions turned row by row with the scores
 * climbing, the banner with its fanfare, then what the joust gave. Played once when `playing`;
 * otherwise shown whole, with « Revoir ».
 */
export function Reveal({
  data,
  kicker,
  playing,
  children,
}: {
  readonly data: RevealData;
  readonly kicker: string;
  readonly playing: boolean;
  /** The actions under the gains. */
  readonly children?: ReactNode;
}) {
  const stage = useStage();
  const catalog = useCatalog();
  const rows = data.mine.length;
  const [shown, setShown] = useState(playing ? 0 : rows);
  const [verdict, setVerdict] = useState(!playing);
  const [gains, setGains] = useState(!playing);
  // Each replay draws the rows afresh, so that they turn again.
  const [round, setRound] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const banner = useRef<ViewInstance>(null);
  const won = data.outcome === "won";

  const later = (ms: number, action: () => void) => {
    timers.current.push(setTimeout(action, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the sequence reads the data it starts with
  const start = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRound((value) => value + 1);
    setShown(0);
    setVerdict(false);
    setGains(false);
    play("sealBreak");
    for (let index = 0; index < rows; index += 1) {
      later(FIRST_ROW_MS + index * ROW_MS, () => {
        setShown(index + 1);
        play("flip");
      });
    }
    const verdictAt = FIRST_ROW_MS + rows * ROW_MS + 300;
    later(verdictAt, () => {
      setVerdict(true);
      play(won ? "fanfareEpic" : "recap");
      vibrate(won ? [30, 40, 60] : [30]);
      // The banner is laid out once it shows: measured on the next frame.
      if (won) {
        requestAnimationFrame(() =>
          banner.current?.measureInWindow((x, y, width, height) =>
            stage.reveal(
              x + width / 2,
              y + height / 2,
              revealEffects.epic,
              rarityLights.epic[0] ?? toyMatters.gold.top,
            ),
          ),
        );
      }
    });
    later(verdictAt + 1_200, () => {
      setGains(true);
      const gained = (data.gains?.tournament?.won ?? 0) > 0;
      if (data.gains !== null && (data.gains.xp > 0 || data.gains.boosters > 0 || gained)) {
        play("coins");
      }
    });
  }, [rows, won]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: plays once, when asked at the start
  useEffect(() => {
    if (playing) start();
  }, []);

  const word = (cardId: string) => (catalog === null ? "…" : catalogCard(catalog, cardId).word);
  const score = (answers: readonly RevealAnswer[] | null) =>
    (answers ?? []).slice(0, shown).filter((answer) => answer.correct).length;
  return (
    <Leaf style={pieces.leaf}>
      <View style={styles.head}>
        <View style={styles.headKicker}>
          <LeafKicker>{kicker}</LeafKicker>
        </View>
        <Pressable
          onPress={start}
          hitSlop={8}
          style={styles.replay}
          accessibilityRole="button"
          accessibilityLabel={REPLAY_REVEAL}
        >
          <Icon name="play" size={14} color={ink.rubric} />
          <Text style={styles.replayText}>{REPLAY_REVEAL}</Text>
        </Pressable>
      </View>

      <View style={styles.faces}>
        <Side duelist={data.me} score={score(data.mine)} />
        <Lettering size={fontSizes.body}>contre</Lettering>
        <Side duelist={data.them} score={score(data.theirs)} />
      </View>

      <View style={styles.rows}>
        {data.mine.map((answer, index) => {
          const theirs = data.theirs?.[index];
          if (index >= shown) return <View key={answer.cardId} style={styles.rowSpace} />;
          return (
            <Animated.View
              key={`${round}-${answer.cardId}`}
              {...(playing || round > 0 ? { entering: rowIn } : {})}
              style={styles.row}
            >
              <Cell answer={answer} word={word(answer.cardId)} />
              <Text style={styles.number}>{index + 1}</Text>
              {theirs !== undefined ? (
                <Cell answer={theirs} word={word(theirs.cardId)} />
              ) : (
                <View style={styles.cellEmpty} />
              )}
            </Animated.View>
          );
        })}
      </View>

      <View ref={banner} collapsable={false} style={styles.banner}>
        {verdict && (
          <Animated.View {...(playing || round > 0 ? { entering: bannerIn } : {})}>
            <ToyBody
              matter={data.outcome === null ? "paper" : BANNER_MATTERS[data.outcome]}
              large
              style={styles.bannerBody}
            >
              <Lettering size={fontSizes.heading}>{outcomeWord(data.outcome, true)}</Lettering>
            </ToyBody>
          </Animated.View>
        )}
      </View>

      {gains && (
        <View style={styles.gains}>
          {data.gains !== null && data.gains.xp > 0 && (
            <Animated.View entering={FadeInUp.duration(300)} style={styles.gain}>
              <ToyIcon name="challenge" size={34} />
              <Lettering size={fontSizes.subtitle}>{xpGainText(data.gains.xp)}</Lettering>
            </Animated.View>
          )}
          {data.gains !== null && data.gains.boosters > 0 && (
            <Animated.View entering={FadeInUp.delay(160).duration(300)} style={styles.gain}>
              <ToyIcon name="sachet" size={34} />
              <Lettering size={fontSizes.subtitle}>{sachetGainText(data.gains.boosters)}</Lettering>
            </Animated.View>
          )}
          {data.gains?.tournament != null && (
            <Animated.View entering={FadeInUp.delay(320).duration(300)} style={styles.tournament}>
              <TournamentGain tournament={data.gains.tournament} />
            </Animated.View>
          )}
          {data.closing !== null && (
            <Animated.View entering={FadeInUp.delay(480).duration(300)} style={styles.closing}>
              <ToyIcon name="jousts" size={24} />
              <Text style={styles.closingText}>{data.closing}</Text>
            </Animated.View>
          )}
          {children !== undefined && <View style={pieces.actions}>{children}</View>}
        </View>
      )}
    </Leaf>
  );
}

function Side({ duelist, score }: { readonly duelist: Duelist; readonly score: number }) {
  return (
    <View style={styles.side}>
      <DuelistFace duelist={duelist} size={56} />
      <Text style={styles.sideName} numberOfLines={1}>
        {duelist.name}
      </Text>
      <Lettering key={score} size={fontSizes.heading}>
        {score}
      </Lettering>
    </View>
  );
}

function Cell({ answer, word }: { readonly answer: RevealAnswer; readonly word: string }) {
  const tone = answer.correct ? toyMatters.green : toyMatters.red;
  return (
    <View style={[styles.cell, { borderColor: tone.bottom }]}>
      <View style={[styles.cellIcon, { backgroundColor: tone.top }]}>
        <Icon name={answer.correct ? "check" : "close"} size={11} color={toyMatters.paper.top} />
      </View>
      <View style={styles.cellText}>
        <Text style={styles.cellWord} numberOfLines={1}>
          {word}
        </Text>
        <Text style={styles.cellTime}>{answer.correct ? answerTimeText(answer) : "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  headKicker: { flex: 1 },
  replay: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  replayText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.rubric },
  pli: { alignItems: "center", gap: space.s6, paddingVertical: space.s12 },
  faces: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { flex: 1, alignItems: "center", gap: space.s2 },
  sideName: {
    maxWidth: "100%",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: ink.pageInk,
  },
  rows: { gap: space.s3 },
  row: { flexDirection: "row", alignItems: "center", gap: space.s3, minHeight: 44 },
  rowSpace: { minHeight: 44 },
  number: {
    width: 18,
    textAlign: "center",
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  cell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radii.sm,
    borderWidth: 2,
    backgroundColor: ink.pageRaised,
  },
  cellEmpty: { flex: 1 },
  cellIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { flex: 1 },
  cellWord: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInk },
  cellTime: { fontFamily: fonts.ui.medium, fontSize: fontSizes.micro, color: ink.pageInkMuted },
  banner: { minHeight: 76, alignItems: "center", justifyContent: "center" },
  bannerBody: { paddingHorizontal: space.s16, paddingVertical: space.s5 },
  gains: { alignItems: "center", gap: space.s6 },
  gain: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  tournament: { alignSelf: "stretch", alignItems: "center" },
  closing: { flexDirection: "row", alignItems: "center", gap: space.s4, alignSelf: "stretch" },
  closingText: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
});
