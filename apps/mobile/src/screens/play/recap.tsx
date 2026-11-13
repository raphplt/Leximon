import { type Catalog, cardOrPlaceholder } from "@leximon/contract/client";
import { cardSize, rarityStyles, toy, toyMatters } from "@leximon/tokens";
import {
  BACK_HOME_LABEL,
  CASCADE_STEP_MS,
  canOpenAgain,
  collectionProgress,
  collectionTally,
  keepsAnnouncementWhenHurried,
  levelLabel,
  levelRatio,
  levelUpGain,
  nextSachetLine,
  openAgainLabel,
  rarityCompletedGain,
  recap,
  recapCascade,
  recapOrder,
  xpGainLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Card } from "@/cards/card";
import { RecycleButton } from "@/ecus/recycle-button";
import { play } from "@/feedback/feedback";
import { openCoffret } from "@/levels/coffret";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { useNow, useShared } from "@/player/shared";
import { progress as progressResource, wallet as walletResource } from "@/player/state";
import { usePlayerView } from "@/player/use-player-view";
import { openCard } from "@/screens/trades/card-row";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fontSizes, fonts, radii, space } from "@/theme";
import { GainBanner } from "@/ui/gain-banner";
import { XpBar } from "@/ui/level";
import { RarityIcon, RarityName } from "@/ui/rarity-icon";
import { Lettering } from "@/ui/toy";
import { isNewAt, type Pack } from "./pack";
import { cssLinearInShape } from "./sachet-paint";

const GAP = 14;
/** Room left at the edge for the next card to show. */
const PEEK = 96;
const CARD_MAX = 260;
/** Narrower, a card no longer reads: a short phone scrolls the recap rather than shrink it more. */
const CARD_MIN = 156;
/** Below this height the recap closes up its lines; below what even that leaves, it scrolls. */
const TIGHT_ROOM = 600;
/** Height kept around the cards until it is measured: the recap's lines, the buttons and the tabs. */
const CHROME = 540;
/** The main button's height, in the play pieces: the desk's edge runs through its middle. */
const MAIN_ACTION_HEIGHT = 66;
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
  onOpenAnother,
  onHome,
}: {
  readonly catalog: Catalog;
  readonly pack: Pack;
  /** Where the player asked to reveal everything; null when every card was turned. */
  readonly hurriedFrom: number | null;
  readonly mustSignUp: boolean;
  readonly onOpenAnother: () => void;
  readonly onHome: () => void;
}) {
  const window = useWindowDimensions();
  const [room, setRoom] = useState(window.height);
  const tight = room < TIGHT_ROOM;
  // Everything but the cards, measured: lines come and go (a level, a completed rarity), and a
  // long phone or a large font takes more than any estimate.
  const [carouselHeight, setCarouselHeight] = useState(0);
  const [actionsBottom, setActionsBottom] = useState(0);
  const chrome = carouselHeight > 0 && actionsBottom > 0 ? actionsBottom - carouselHeight : CHROME;
  const measureActions = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setActionsBottom(Math.ceil(y + height));
  };
  const now = useNow(15_000);
  const progressNow = useShared(progressResource);
  const wallet = useShared(walletResource);
  // The sachet raised the level: its coffret comes before the next sachet.
  const player = usePlayerView();
  const coffretWaits = player.coffrets.length > 0;
  const width = Math.floor(
    Math.max(
      CARD_MIN,
      Math.min(
        CARD_MAX,
        window.width - PEEK,
        ((room - chrome - 2 * space.s7) * cardSize.width) / cardSize.height,
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
  const levelGain = levelUpGain(pack.progress, coffretWaits);
  const tally = collectionTally(progress);
  const nextSachet = wallet === null ? null : nextSachetLine(wallet, now);
  const another = !mustSignUp && !coffretWaits && wallet !== null && canOpenAgain(wallet);
  // The gains come once the cards have landed, one after the other.
  const after = (index: number) =>
    FadeInUp.delay(pack.cards.length * CASCADE_STEP_MS + 260 + index * 140).duration(320);
  return (
    <View style={styles.recap} onLayout={(event) => setRoom(event.nativeEvent.layout.height)}>
      <ScrollView
        scrollEnabled={actionsBottom > room + 1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* The cards lie on the desk, as long as what it holds; the main button sits on its edge. */}
        <View style={[styles.column, tight && styles.columnTight]}>
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
            onLayout={(event) => setCarouselHeight(Math.floor(event.nativeEvent.layout.height))}
            style={styles.carousel}
          >
            {shown.map(({ card: drawn, index }, position) => (
              <Animated.View
                key={index}
                entering={FadeInRight.delay(position * STEP_MS).duration(260)}
              >
                <Pressable
                  onPress={() =>
                    openCard(
                      drawn.cardId,
                      shown.map((entry) => entry.card.cardId),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Lire ${cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity).word}`}
                >
                  <Card
                    card={cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity)}
                    collectionName={pack.collectionName}
                    width={width}
                  />
                </Pressable>
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
          {levelGain !== null && (
            <Animated.View entering={after(0)} style={styles.banner}>
              <GainBanner icon="chest" title={levelGain.title} note={levelGain.note} />
            </Animated.View>
          )}
          {pack.completions.map((completion, index) => {
            const gain = rarityCompletedGain(completion);
            return (
              <Animated.View
                key={completion.rarity}
                entering={after(index + 1)}
                style={styles.banner}
              >
                <GainBanner
                  icon={
                    <RarityIcon
                      rarity={completion.rarity}
                      size={28}
                      color={rarityStyles[completion.rarity].spot}
                    />
                  }
                  title={gain.title}
                  note={gain.note}
                />
              </Animated.View>
            );
          })}
          <View style={styles.tallies}>
            {xp !== null && (
              <Animated.View entering={after(0)} style={styles.tally}>
                <Text
                  style={styles.tallyName}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {progressNow === null
                    ? "EXPÉRIENCE"
                    : levelLabel(progressNow.level).toUpperCase()}
                </Text>
                <Lettering size={fontSizes.titleSmall}>{xp}</Lettering>
                {progressNow !== null && (
                  <View style={styles.tallyBar}>
                    <XpBar ratio={levelRatio(progressNow)} />
                  </View>
                )}
              </Animated.View>
            )}
            <Animated.View entering={after(1)} style={styles.tally}>
              <Text
                style={styles.tallyName}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {pack.collectionName.toUpperCase()}
              </Text>
              <View style={styles.tallyFigure}>
                <Lettering size={fontSizes.titleSmall}>{tally.figure}</Lettering>
                {tally.gained !== null && <Text style={styles.tallyGained}>{tally.gained}</Text>}
              </View>
              <View style={[styles.tallyBar, styles.collectionBar]}>
                <View
                  style={[
                    styles.collectionOwned,
                    tally.gained !== null && styles.collectionOwnedBeforeGain,
                    { width: `${tally.before * 100}%` },
                  ]}
                />
                {tally.gained !== null && (
                  <View
                    style={[
                      styles.collectionGained,
                      { width: `${(tally.after - tally.before) * 100}%` },
                    ]}
                  />
                )}
              </View>
            </Animated.View>
          </View>
          {!mustSignUp && !coffretWaits && nextSachet !== null && (
            <Text style={styles.note}>{nextSachet}</Text>
          )}
          <RecycleButton />
        </View>
        <View style={styles.actions} onLayout={measureActions}>
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
      </ScrollView>
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
  // Clear of the desk's gilt frame.
  recap: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: space.s12,
    paddingBottom: space.s10,
    gap: space.s4,
  },
  columnTight: { gap: space.s2 },
  desk: { position: "absolute", top: 4, left: 8, right: 8, bottom: -MAIN_ACTION_HEIGHT / 2 },
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
  banner: { alignSelf: "stretch", paddingHorizontal: space.s8 },
  tallies: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: space.s8,
    paddingHorizontal: space.s12,
    marginTop: space.s2,
  },
  tally: { flex: 1, alignItems: "center", gap: space.s2 },
  tallyName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: colors.pageInkMuted,
  },
  tallyFigure: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  tallyGained: {
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: toy.outline,
    borderRadius: radii.pill,
    backgroundColor: colors.successDeep,
    color: colors.inkOnColor,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
  },
  tallyBar: { alignSelf: "stretch", marginTop: space.s1 },
  // What was owned before in cream, what this sachet added in green right after it, the two
  // meeting edge to edge; the bar's own rounding closes the left end.
  collectionBar: {
    flexDirection: "row",
    height: 16,
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.well,
  },
  collectionOwned: {
    borderTopRightRadius: radii.pill,
    borderBottomRightRadius: radii.pill,
    backgroundColor: toyMatters.paper.top,
  },
  collectionOwnedBeforeGain: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  // A few words out of five hundred: drawn a little wider than their share, so that they show.
  collectionGained: {
    minWidth: 14,
    borderTopRightRadius: radii.pill,
    borderBottomRightRadius: radii.pill,
    backgroundColor: colors.successLight,
  },
  note: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.label,
    color: colors.pageInkMuted,
    marginTop: space.s3,
  },
  actions: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingHorizontal: space.s12,
    paddingBottom: TAB_BAR_RISE + 24,
    gap: space.s6,
  },
});
