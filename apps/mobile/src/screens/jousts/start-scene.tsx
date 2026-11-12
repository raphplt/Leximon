import type { DuelistSide, JoustView } from "@leximon/contract";
import { lettering, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  duelistMeta,
  joustKindName,
  OPPONENT_FOUND,
  runSize,
  SEARCHING,
  START_JOUST,
  START_LATER,
  searchLine,
  startByLine,
  startLine,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { CardBack } from "@/cards/card-back";
import { play, vibrate } from "@/feedback/feedback";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { alpha, fontSizes, fonts, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Lettering } from "@/ui/toy";
import { Crest } from "./crest";
import { LeatherStage } from "./hall";
import type { Duelist } from "./pieces";

/** The reel turns this long before it stops on the opponent: the server already chose them. */
const SEARCH_MS = 2_200;
const FOUND_MS = 1_100;
const COUNT_MS = 800;
const FACE = 96;
const ROW = FACE + 10;
// Faces turning in the reel before the opponent's: the portraits players pick from.
const REEL = ["grimelin", "cassandre", "preopinant", "ricanerie", "metaphraste", "bachelette"];

/**
 * Before the run: the search for an opponent when the game picked them, then both players face to
 * face. Nothing starts before « Commencer »: then 3, 2, 1, and the run's clock with its first word.
 * As on the web.
 */
export function StartScene({
  view,
  me,
  them,
  search,
  onStart,
  onLater,
}: {
  readonly view: JoustView;
  readonly me: Duelist;
  readonly them: Duelist;
  /** Play the search first: the joust was just launched here. */
  readonly search: boolean;
  readonly onStart: () => void;
  readonly onLater: () => void;
}) {
  const [moment, setMoment] = useState<"search" | "face">(search ? "search" : "face");
  const duel = view.duel;
  if (duel === null) return null;
  return (
    <LeatherStage style={styles.arena}>
      <Text style={styles.kicker}>{joustKindName(view.summary.kind)}</Text>
      {moment === "search" ? (
        <Search
          view={view}
          me={me}
          them={them}
          side={duel.theirs}
          onFound={() => setMoment("face")}
        />
      ) : (
        <FaceToFace
          view={view}
          me={me}
          them={them}
          duel={duel}
          onStart={onStart}
          onLater={onLater}
        />
      )}
    </LeatherStage>
  );
}

function Search({
  view,
  me,
  them,
  side,
  onFound,
}: {
  readonly view: JoustView;
  readonly me: Duelist;
  readonly them: Duelist;
  readonly side: DuelistSide;
  readonly onFound: () => void;
}) {
  const reduced = useReducedMotion();
  const [found, setFound] = useState(false);
  const turn = useSharedValue(0);
  const pop = useSharedValue(1);
  const faces = [...REEL, ...REEL, them.avatar];
  const last = faces.length - 1;
  // biome-ignore lint/correctness/useExhaustiveDependencies: turns once, when the search appears
  useEffect(() => {
    turn.value = reduced
      ? last
      : withTiming(last, { duration: SEARCH_MS, easing: Easing.bezier(0.3, 0, 0.2, 1) });
    const stop = setTimeout(() => {
      setFound(true);
      play("cardSlide");
      vibrate([20]);
      pop.value = withSequence(
        withTiming(1.18, { duration: 220 }),
        withTiming(1, { duration: 380 }),
      );
    }, SEARCH_MS);
    const go = setTimeout(onFound, SEARCH_MS + FOUND_MS);
    return () => {
      clearTimeout(stop);
      clearTimeout(go);
    };
  }, []);
  const reel = useAnimatedStyle(() => ({ transform: [{ translateY: -turn.value * ROW }] }));
  const slot = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const kind = view.summary.kind;
  return (
    <>
      <Lettering size={fontSizes.title}>{found ? OPPONENT_FOUND : SEARCHING}</Lettering>
      <View style={styles.searchRow}>
        <View style={styles.searchMe}>
          <Avatar avatar={me.avatar} frame={me.frame} size={FACE} />
          <Text style={styles.searchName} numberOfLines={1}>
            {me.name}
          </Text>
        </View>
        <Lettering size={fontSizes.heading}>VS</Lettering>
        <Animated.View style={[styles.slot, slot]}>
          <Animated.View style={[styles.reel, reel]}>
            {faces.map((avatar, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a reel of faces, in order
              <Avatar key={index} avatar={avatar} frame={null} size={FACE} />
            ))}
          </Animated.View>
        </Animated.View>
      </View>
      <Text style={styles.line} accessibilityLiveRegion="polite">
        {searchLine(kind, found ? { name: them.name, side } : null)}
      </Text>
    </>
  );
}

function FaceToFace({
  view,
  me,
  them,
  duel,
  onStart,
  onLater,
}: {
  readonly view: JoustView;
  readonly me: Duelist;
  readonly them: Duelist;
  readonly duel: NonNullable<JoustView["duel"]>;
  readonly onStart: () => void;
  readonly onLater: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      onStart();
      return;
    }
    play("cardSlide");
    vibrate([12]);
    const next = setTimeout(() => setCount(count - 1), COUNT_MS);
    return () => clearTimeout(next);
  }, [count, onStart]);
  const later = startByLine(view.startBy, them.name, Date.now());
  return (
    <>
      <View style={styles.faceRow}>
        <Animated.View entering={FadeInLeft.duration(480)} style={styles.side}>
          <Side duelist={me} side={duel.mine} tone="night" />
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(300).springify()} style={styles.vs}>
          <Lettering size={fontSizes.title}>VS</Lettering>
        </Animated.View>
        <Animated.View entering={FadeInRight.duration(480)} style={styles.side}>
          <Side duelist={them} side={duel.theirs} tone="burgundy" />
        </Animated.View>
      </View>
      {count === null ? (
        <Animated.View entering={FadeInUp.delay(600).duration(360)} style={styles.go}>
          <MainAction
            label={START_JOUST}
            onPress={() => {
              vibrate([20]);
              setCount(3);
            }}
          />
          <Text style={styles.line}>{startLine(runSize(Date.now()))}</Text>
          <PaperAction label={START_LATER} onPress={onLater} />
          {later !== null && <Text style={styles.small}>{later}</Text>}
        </Animated.View>
      ) : (
        <Animated.View key={count} entering={ZoomIn.duration(260)} style={styles.countdown}>
          <Lettering size={96}>{String(count)}</Lettering>
        </Animated.View>
      )}
    </>
  );
}

function Side({
  duelist,
  side,
  tone,
}: {
  readonly duelist: Duelist;
  readonly side: DuelistSide;
  readonly tone: "night" | "burgundy";
}) {
  const middle = (side.rarities.length - 1) / 2;
  return (
    <>
      <Avatar avatar={duelist.avatar} frame={duelist.frame} size={84} />
      <View style={styles.crest}>
        <Crest league={side.league} size={40} />
      </View>
      <Lettering size={fontSizes.lead} numberOfLines={1}>
        {duelist.name}
      </Lettering>
      <Text style={styles.meta} numberOfLines={2}>
        {duelistMeta(side)}
      </Text>
      <View style={styles.backs} importantForAccessibility="no-hide-descendants">
        {side.rarities.map((_, index) => {
          const many = side.rarities.length > 5;
          return (
            <Animated.View
              // biome-ignore lint/suspicious/noArrayIndexKey: the run's cards, in order
              key={index}
              entering={FadeIn.delay(400 + index * 70)}
              style={[
                styles.back,
                many && styles.backTight,
                { transform: [{ rotate: `${(index - middle) * 6}deg` }] },
              ]}
            >
              <CardBack width={many ? 22 : 28} tone={tone} />
            </Animated.View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  arena: { minHeight: 480, justifyContent: "center", gap: space.s8 },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: lettering.kicker,
  },
  line: {
    textAlign: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: lettering.fill,
  },
  small: {
    textAlign: "center",
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: alpha(lettering.fill, 0.8),
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.s8 },
  searchMe: { alignItems: "center", gap: space.s3, maxWidth: FACE + 20 },
  searchName: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: lettering.fill },
  slot: {
    width: FACE + 8,
    height: FACE + 8,
    overflow: "hidden",
    alignItems: "center",
    borderRadius: (FACE + 8) / 2,
    borderWidth: 4,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.dark.bottom,
    boxShadow: `0 0 0 4px ${toyMatters.gold.bottom}, 0 0 30px ${alpha(toyMatters.gold.top, 0.5)}`,
  },
  reel: { gap: ROW - FACE, paddingTop: 2 },
  faceRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: space.s2 },
  side: { flex: 1, alignItems: "center", gap: space.s2 },
  crest: { marginTop: -26, filter: `drop-shadow(0 3px 0 ${toyValues.drop})` },
  meta: {
    textAlign: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.caption,
    color: alpha(lettering.fill, 0.85),
  },
  backs: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: space.s3 },
  back: { marginHorizontal: -3 },
  backTight: { marginHorizontal: -6 },
  vs: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    borderWidth: 3,
    borderColor: toyValues.outline,
    backgroundImage: `radial-gradient(circle at 40% 30%, ${toyMatters.gold.top}, ${toyMatters.gold.edge})`,
    boxShadow: `0 4px 0 ${toyValues.outline}, 0 0 30px ${alpha(toyMatters.gold.top, 0.6)}`,
  },
  go: { alignSelf: "stretch", alignItems: "center", gap: space.s5 },
  countdown: { height: 140, alignItems: "center", justifyContent: "center" },
});
