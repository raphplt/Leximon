import type { CatalogCard } from "@leximon/contract";
import { rarityStyles, solidColor, toyMatters, toy as toyValues } from "@leximon/tokens";
import { FURET } from "@leximon/view-model";
import { type ReactNode, useEffect } from "react";
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { RarityIcon } from "@/ui/rarity-icon";
import { ToyBody, ToyIcon } from "@/ui/toy";

/** What the leaves hold is read on paper. */
export const ink = paperColors;

/** The share of the font size a letter of the word takes, on average, in the bold UI face. */
const LETTER_WIDTH = 0.66;
const SMALLEST_WORD = 9;

/**
 * The size at which the word's longest piece holds on one line of the card: a long word shrinks
 * rather than breaks in the middle. On the narrowest cards it still breaks, hyphenated.
 */
function wordSize(word: string, width: number): number {
  const longest = Math.max(...word.split(" ").map((piece) => piece.length));
  const fits = Math.floor((width - 12) / (longest * LETTER_WIDTH));
  return Math.max(SMALLEST_WORD, Math.min(fontSizes.micro, fits));
}

/** A small card of the deck: the rarity band, its gem, the cost if asked, and the word. */
export function MiniCard({
  card,
  cost,
  width = 76,
  style,
}: {
  readonly card: CatalogCard;
  readonly cost?: number | undefined;
  readonly width?: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const rarity = rarityStyles[card.rarity];
  const size = wordSize(card.word, width);
  return (
    <View style={[pieces.mini, { width }, style]}>
      <View style={[pieces.miniBand, { backgroundColor: solidColor(rarity.band) }]}>
        <RarityIcon rarity={card.rarity} size={11} color={rarity.bandInk} />
        {cost !== undefined && (
          <Text style={[pieces.miniCost, { color: rarity.bandInk }]}>{cost}</Text>
        )}
      </View>
      <Text
        style={[pieces.miniWord, { fontSize: size, lineHeight: Math.round(size * 1.3) }]}
        numberOfLines={2}
        android_hyphenationFrequency="full"
      >
        {card.word}
      </Text>
    </View>
  );
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
  mini: {
    overflow: "hidden",
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.paper.top,
    boxShadow: `0 2px 0 ${toyValues.outline}`,
  },
  miniBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
    height: 16,
  },
  miniCost: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.nano },
  miniWord: {
    minHeight: 34,
    paddingHorizontal: 4,
    paddingVertical: 3,
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.micro,
    lineHeight: 14,
    color: ink.pageInk,
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
