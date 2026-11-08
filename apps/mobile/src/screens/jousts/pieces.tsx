import type { CatalogCard } from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { answerTimeText, FURET, formatCount, plural, trappedText } from "@leximon/view-model";
import { type ReactNode, useEffect, useState } from "react";
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Card } from "@/cards/card";
import { useCatalog } from "@/cards/use-catalog";
import { catalogCard } from "@/screens/trades/card-row";
import { colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Icon } from "@/ui/icon";
import { ToyBody, ToyIcon } from "@/ui/toy";

/** What the leaves hold is read on paper. */
export const ink = paperColors;

/**
 * A card of the deck as the real card, small: the cost of its rarity as a coin on its corner if
 * asked, and the opponents it trapped as a seal.
 */
export function MiniCard({
  card,
  cost,
  trapped = 0,
  sealLeft = false,
  width = 76,
  style,
}: {
  readonly card: CatalogCard;
  readonly cost?: number | undefined;
  /** Opponents the card trapped, shown as a seal on its corner. */
  readonly trapped?: number;
  /** The seal on the left corner, which stays in view when the next card of a fan covers the right. */
  readonly sealLeft?: boolean;
  readonly width?: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const catalog = useCatalog();
  const coin = width < 70 ? 20 : 24;
  return (
    <View style={[{ width }, style]}>
      <Card
        card={card}
        collectionName={catalog === null ? "" : collectionName(catalog, card.collectionId)}
        width={width}
      />
      {cost !== undefined && (
        <View
          style={[pieces.miniCost, { width: coin, height: coin, borderRadius: coin / 2 }]}
          accessibilityLabel={plural(cost, "point", "points")}
        >
          <Text style={pieces.miniCostText}>{cost}</Text>
        </View>
      )}
      {trapped > 0 && (
        <View
          style={[pieces.trapSeal, sealLeft && pieces.trapSealLeft]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={trappedText(trapped)}
        >
          <Text style={pieces.trapCount}>{formatCount(trapped)}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The width of a card so that `count` of them hold on one row of the measured width, `max` at most:
 * five cards of a run fit even on a narrow phone.
 */
export function useRowFit(count: number, gap: number, max: number) {
  const [rowWidth, setRowWidth] = useState(0);
  const width =
    rowWidth === 0 ? max : Math.min(max, Math.floor((rowWidth - (count - 1) * gap) / count));
  const onLayout = (event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width);
  return { width, onLayout };
}

/** A run's answers as the cards asked, each turning over, a mark of found or missed, the time. */
export function AnswerCards({
  answers,
  width,
}: {
  readonly answers: readonly {
    readonly cardId: string;
    readonly correct: boolean;
    readonly ms: number;
  }[];
  /** The widest a card may be. */
  readonly width: number;
}) {
  const catalog = useCatalog();
  const fit = useRowFit(answers.length, space.s3, width);
  if (catalog === null) return null;
  return (
    <View style={pieces.answers} onLayout={fit.onLayout}>
      {answers.map((answer, index) => {
        const tone = answer.correct ? toyMatters.green : toyMatters.red;
        return (
          <Animated.View
            key={answer.cardId}
            entering={answerIn(index)}
            style={[pieces.answer, { width: fit.width }]}
          >
            <MiniCard
              card={catalogCard(catalog, answer.cardId)}
              width={fit.width}
              style={answer.correct ? undefined : pieces.missed}
            />
            <View style={[pieces.answerIcon, { backgroundColor: tone.top }]}>
              <Icon
                name={answer.correct ? "check" : "close"}
                size={12}
                color={toyMatters.paper.top}
              />
            </View>
            <Text style={pieces.answerTime} numberOfLines={1} adjustsFontSizeToFit>
              {answerTimeText(answer)}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** How far apart two answers turn over. */
export const ANSWER_MS = 260;

/** An answer turns over like a card. */
function answerIn(index: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ perspective: 600 }, { rotateY: "-90deg" }] },
    100: { opacity: 1, transform: [{ perspective: 600 }, { rotateY: "0deg" }] },
  })
    .delay(200 + index * ANSWER_MS)
    .duration(280);
}

/** Maître Furet in a medallion, and what he says in a bubble beside him. */
export function Furet({ children }: { readonly children: string }) {
  return (
    <View style={pieces.furet}>
      <ToyBody matter="gold" shape="round" style={pieces.furetFace}>
        <ToyIcon name="books" size={30} />
      </ToyBody>
      <View style={pieces.furetBubble}>
        <Text style={pieces.furetName}>{FURET}</Text>
        <Text style={pieces.furetText}>{children}</Text>
      </View>
    </View>
  );
}

/** One side of a joust: a player, or Maître Furet in training. */
export interface Duelist {
  readonly name: string;
  readonly avatar: string | null;
  readonly frame: string | null;
  /** Maître Furet: his medallion stands for the avatar. */
  readonly furet?: boolean;
}

export function DuelistFace({
  duelist,
  size,
}: {
  readonly duelist: Duelist;
  readonly size: number;
}) {
  if (duelist.furet === true) {
    return (
      <ToyBody matter="gold" shape="round" style={{ width: size, height: size }}>
        <ToyIcon name="books" size={Math.round(size * 0.62)} />
      </ToyBody>
    );
  }
  return <Avatar avatar={duelist.avatar} frame={duelist.frame} size={size} />;
}

type LoopKind = "wobble" | "beat" | "turn";

/**
 * A small motion repeated while shown, to draw the eye: a seal that wobbles, a row that beats, an
 * hourglass turned over. Still for a player who asks for reduced motion.
 */
export function Looping({
  kind,
  style,
  children,
}: {
  readonly kind: LoopKind;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const value = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      value.value = 0;
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    value.value =
      kind === "wobble"
        ? withRepeat(
            withSequence(
              withDelay(1_900, withTiming(-1, { duration: 120, easing: ease })),
              withTiming(1, { duration: 160, easing: ease }),
              withTiming(-0.5, { duration: 120, easing: ease }),
              withTiming(0, { duration: 100, easing: ease }),
            ),
            -1,
          )
        : kind === "beat"
          ? withRepeat(withTiming(1, { duration: 800, easing: ease }), -1, true)
          : withRepeat(
              withSequence(
                withDelay(1_400, withTiming(1, { duration: 600, easing: ease })),
                withTiming(0, { duration: 0 }),
              ),
              -1,
            );
    return () => {
      value.value = 0;
    };
  }, [kind, reduced, value]);
  const moving = useAnimatedStyle(() => {
    if (kind === "wobble") return { transform: [{ rotate: `${value.value * 10}deg` }] };
    if (kind === "beat") return { transform: [{ scale: 1 + value.value * 0.025 }] };
    return { transform: [{ rotate: `${value.value * 180}deg` }] };
  });
  return <Animated.View style={[style, moving]}>{children}</Animated.View>;
}

/** A line the player has to read: a refusal, a server that does not answer. */
export function Notice({ children }: { readonly children: string | null }) {
  if (children === null) return null;
  return (
    <Text style={pieces.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

/** Small capitals above a leaf's content, in the paper's muted ink. */
export function LeafKicker({ children }: { readonly children: string }) {
  return <Text style={pieces.kicker}>{children.toUpperCase()}</Text>;
}

export const pieces = StyleSheet.create({
  miniCost: {
    position: "absolute",
    top: -6,
    right: -6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.gold.top,
  },
  miniCostText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.nano,
    color: toyValues.outline,
    includeFontPadding: false,
  },
  missed: { opacity: 0.6 },
  answers: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s3 },
  answer: { alignItems: "center", gap: space.s2 },
  answerIcon: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: toyValues.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  answerTime: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    color: ink.pageInkMuted,
  },
  trapSeal: {
    position: "absolute",
    right: -6,
    bottom: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.red.top,
  },
  trapSealLeft: { right: undefined, left: -6 },
  trapCount: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.nano,
    color: colors.inkOnColor,
    includeFontPadding: false,
  },
  furet: { flexDirection: "row", alignItems: "flex-start", gap: space.s4 },
  furetFace: { width: 52, height: 52 },
  furetBubble: {
    flex: 1,
    gap: space.s1,
    padding: space.s4,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: ink.rule,
    backgroundColor: ink.pageRaised,
  },
  furetName: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 1,
    color: ink.rubric,
  },
  furetText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
  notice: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.danger,
    textAlign: "center",
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  line: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  leaf: { padding: space.s6, gap: space.s6 },
  actions: { alignSelf: "stretch", alignItems: "center", gap: space.s4 },
});
