import { type Catalog, cardOrPlaceholder } from "@leximon/contract/client";
import { cardSize, rarityStyles } from "@leximon/tokens";
import {
  BACK_HOME_LABEL,
  canOpenAgain,
  collectionProgress,
  keepsAnnouncementWhenHurried,
  levelRatio,
  levelUpLabel,
  nextSachetLine,
  openAgainLabel,
  rarityCompletedLabel,
  recap,
  recapCascade,
  recapOrder,
  xpGainLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  FadeInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Card } from "@/cards/card";
import { play } from "@/feedback/feedback";
import { openCoffret } from "@/levels/coffret";
import { Desk, MainAction, PaperAction } from "@/library/play-pieces";
import { useNow, useShared } from "@/player/shared";
import { progress as progressResource, wallet as walletResource } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fontSizes, fonts, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { XpBar } from "@/ui/level";
import { RarityName } from "@/ui/rarity-icon";
import { isNewAt, type Pack } from "./pack";
import { cssLinearInShape } from "./sachet-paint";

const GAP = 14;
/** Room left at the edge for the next card to show. */
const PEEK = 96;
const CARD_MAX = 260;
const CARD_MIN = 160;
/** The desk's buttons leave less room: a small phone takes smaller cards rather than overflow. */
const LIBRARY_CARD_MIN = 136;
/** Height kept around the cards: the recap's lines and buttons. */
const CHROME = 300;
/** More of it in « La Bibliothèque », where the buttons are thicker and the tabs rise higher. */
const LIBRARY_CHROME = 540;
const STEP_MS = 80;
/** A card's chime rings once it has slid in. */
const CHIME_AT_MS = 220;
/** Its shine crosses it just before. */
const GLINT_AT_MS = 200;
const GLINT_MS = 950;
const EASE_OUT = Easing.bezierFn(0, 0, 0.58, 1);

/** What the sachet gave, one card after the other, and the level it raised. */
export function Recap({
  catalog,
  pack,
  hurriedFrom,
  mustSignUp,
  library = false,
  onOpenAnother,
  onHome,
}: {
  readonly catalog: Catalog;
  readonly pack: Pack;
  /** Where the player asked to reveal everything; null when every card was turned. */
  readonly hurriedFrom: number | null;
  readonly mustSignUp: boolean;
  /** In « La Bibliothèque », the cards lie on the desk and the buttons are its objects. */
  readonly library?: boolean;
  readonly onOpenAnother: () => void;
  readonly onHome: () => void;
}) {
  const window = useWindowDimensions();
  const [room, setRoom] = useState(window.height);
  const now = useNow(15_000);
  const progressNow = useShared(progressResource);
  const wallet = useShared(walletResource);
  // The sachet raised the level: its coffret comes before the next sachet.
  const coffretWaits = usePlayerView().coffrets.length > 0;
  const width = Math.floor(
    Math.max(
      library ? LIBRARY_CARD_MIN : CARD_MIN,
      Math.min(
        CARD_MAX,
        window.width - PEEK,
        ((room - (library ? LIBRARY_CHROME : CHROME)) * cardSize.width) / cardSize.height,
      ),
    ),
  );
  const [active, setActive] = useState(0);
  const reducedMotion = useReducedMotion();
  const shown = recapOrder(pack.cards);
  // Computed once: the cascade plays when the recap appears.
  const [steps] = useState(() =>
    recapCascade(
      shown.map((entry) => entry.card),
      (position) => {
        const entry = shown[position];
        return (
          hurriedFrom === null ||
          (entry !== undefined &&
            (entry.index < hurriedFrom || keepsAnnouncementWhenHurried(entry.card.rarity)))
        );
      },
      { reducedMotion },
    ),
  );
  useEffect(() => {
    const timers = steps.flatMap((step) =>
      step.cue === null ? [] : [setTimeout(() => play(step.cue), step.delayMs + CHIME_AT_MS)],
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [steps]);
  const { best, fresh } = recap(pack.cards, pack.quantitiesBefore);
  const progress = collectionProgress(pack.collectionCardIds, pack.quantitiesBefore, pack.cards);
  const xp = xpGainLabel(pack.progress);
  const levelUp = levelUpLabel(pack.progress);
  const nextSachet = wallet === null ? null : nextSachetLine(wallet, now);
  const another = !mustSignUp && !coffretWaits && wallet !== null && canOpenAgain(wallet);
  return (
    <View style={styles.recap} onLayout={(event) => setRoom(event.nativeEvent.layout.height)}>
      {library && <Desk style={styles.desk} />}
      <Text style={styles.kicker}>TON SACHET</Text>
      <View style={styles.line}>
        {best !== null && (
          <RarityName rarity={best.rarity} text={best.label} color={colors.pageInk} />
        )}
        {best !== null && <Text style={styles.lineText}>·</Text>}
        <Text style={styles.lineText}>{fresh}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: GAP, paddingHorizontal: (window.width - width) / 2 }}
        onScroll={(event) =>
          setActive(Math.round(event.nativeEvent.contentOffset.x / (width + GAP)))
        }
        scrollEventThrottle={32}
        style={styles.carousel}
      >
        {shown.map(({ card: drawn, index }, position) => (
          <Animated.View key={index} entering={FadeInRight.delay(position * STEP_MS).duration(260)}>
            <Card
              card={cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity)}
              collectionName={pack.collectionName}
              width={width}
            />
            {steps[position]?.glint === true && (
              <Glint
                color={rarityStyles[drawn.rarity].glow ?? rarityStyles[drawn.rarity].spot}
                width={width}
                delayMs={(steps[position]?.delayMs ?? 0) + GLINT_AT_MS}
              />
            )}
            {isNewAt(pack, index) && <Text style={styles.new}>Nouveau</Text>}
          </Animated.View>
        ))}
      </ScrollView>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {pack.cards.map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one dot per card of the pack.
          <View key={index} style={[styles.dot, index === active && styles.dotOn]} />
        ))}
      </View>
      {xp !== null && <Text style={styles.xp}>{xp}</Text>}
      {progressNow !== null && (
        <View style={styles.bar}>
          <XpBar ratio={levelRatio(progressNow)} thin />
        </View>
      )}
      {pack.completions.map((completion) => (
        <Text key={completion.rarity} style={styles.completed}>
          {rarityCompletedLabel(completion)}
        </Text>
      ))}
      {levelUp !== null && <Text style={styles.levelUp}>{levelUp}</Text>}
      <Text style={styles.progress}>
        {pack.collectionName} · {progress.owned} / {progress.total}
        {progress.gained > 0 && <Text style={styles.gained}> (+{progress.gained})</Text>}
      </Text>
      {!mustSignUp && !coffretWaits && nextSachet !== null && (
        <Text style={styles.progress}>{nextSachet}</Text>
      )}
      {library ? (
        <View style={[styles.actions, styles.libraryActions]}>
          {coffretWaits ? (
            <MainAction label="Ouvrir le coffret" onPress={() => openCoffret()} />
          ) : mustSignUp ? (
            <MainAction label="Créer mon compte" onPress={() => router.push("/compte")} />
          ) : (
            <MainAction
              label={wallet === null ? BACK_HOME_LABEL : openAgainLabel(wallet)}
              onPress={another ? onOpenAnother : onHome}
            />
          )}
          {another ? (
            <PaperAction label={BACK_HOME_LABEL} onPress={onHome} />
          ) : (
            <PaperAction label="Voir mon album" onPress={() => router.navigate("/album")} />
          )}
        </View>
      ) : (
        <View style={styles.actions}>
          {coffretWaits ? (
            <Button label="Ouvrir le coffret" onPress={() => openCoffret()} />
          ) : mustSignUp ? (
            <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
          ) : (
            <Button
              label={wallet === null ? BACK_HOME_LABEL : openAgainLabel(wallet)}
              onPress={another ? onOpenAnother : onHome}
            />
          )}
          {another ? (
            <Button label={BACK_HOME_LABEL} secondary onPress={onHome} />
          ) : (
            <Button label="Voir mon album" secondary onPress={() => router.navigate("/album")} />
          )}
        </View>
      )}
    </View>
  );
}

/** A sweep of light and a halo of the rarity's colour, once, as the card lands. */
function Glint({
  color,
  width,
  delayMs,
}: {
  readonly color: string;
  readonly width: number;
  readonly delayMs: number;
}) {
  const u = width / cardSize.width;
  const height = cardSize.height * u;
  const time = useSharedValue(0);
  useEffect(() => {
    time.value = 0;
    time.value = withDelay(delayMs, withTiming(1, { duration: GLINT_MS, easing: Easing.linear }));
  }, [delayMs, time]);
  // Bright within the first quarter, then fading: each stretch eases out on its own.
  const shown = useAnimatedStyle(() => ({
    opacity:
      time.value < 0.25 ? EASE_OUT(time.value / 0.25) : 1 - EASE_OUT((time.value - 0.25) / 0.75),
  }));
  // A light 2.5 times the card's width, crossing from 120 % to -40 %.
  const crossing = useAnimatedStyle(() => ({
    transform: [{ translateX: -1.5 * width * (1.2 - 1.6 * EASE_OUT(time.value)) }],
  }));
  const line = cssLinearInShape(115, 2.5 * width, height);
  return (
    <Animated.View
      style={[
        styles.glint,
        {
          borderRadius: 16 * u,
          boxShadow: `0 0 0 2px ${color}, 0 0 30px 6px ${color}`,
        },
        shown,
      ]}
      pointerEvents="none"
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: 16 * u, overflow: "hidden" }]}>
        <Animated.View style={[{ width: 2.5 * width, height }, crossing]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient
                id="glint"
                gradientUnits="objectBoundingBox"
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
              >
                <Stop offset={0.3} stopColor={colors.glint} stopOpacity={0} />
                <Stop offset={0.48} stopColor={colors.glint} stopOpacity={0.55} />
                <Stop offset={0.66} stopColor={colors.glint} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#glint)" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glint: { ...StyleSheet.absoluteFill, opacity: 0 },
  recap: { flex: 1, alignItems: "center", paddingTop: space.s6, gap: space.s4 },
  desk: { position: "absolute", top: 4, left: 8, right: 8, bottom: 96 + TAB_BAR_RISE },
  libraryActions: { alignItems: "center", paddingBottom: TAB_BAR_RISE + 24 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: colors.pageInkMuted,
  },
  line: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  lineText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.pageInk },
  carousel: { flexGrow: 0, flexShrink: 0, paddingVertical: space.s7 },
  new: {
    position: "absolute",
    top: -10,
    right: -6,
    overflow: "hidden",
    paddingHorizontal: space.s5,
    paddingVertical: 3,
    borderRadius: radii.lg,
    backgroundColor: colors.sticker,
    color: colors.inkOnColor,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
  },
  dots: { flexDirection: "row", gap: space.s3 },
  dot: { width: 7, height: 7, borderRadius: radii.xxs, backgroundColor: colors.rule },
  dotOn: { backgroundColor: colors.action },
  xp: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    color: colors.rubric,
    marginTop: space.s2,
  },
  bar: { width: 200 },
  levelUp: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.bodyLarge, color: colors.pageInk },
  completed: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: colors.pageInk,
    paddingHorizontal: space.s5,
    paddingVertical: space.s2,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.badge,
    borderRadius: radii.md,
  },
  progress: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.label,
    color: colors.pageInkMuted,
  },
  gained: { color: colors.success },
  actions: {
    alignSelf: "stretch",
    paddingHorizontal: space.s12,
    paddingBottom: TAB_BAR_RISE,
    gap: space.s5,
    marginTop: space.s3,
  },
});
