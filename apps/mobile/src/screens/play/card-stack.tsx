import { cardSize } from "@leximon/tokens";
import { type DrawnCard, peekAmount, stackRelease } from "@leximon/view-model";
import { useEffect, useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { CardBack } from "@/cards/card-back";

/** How far apart two cards of the stack drift at a full peek. */
const FAN_STEP = 22;
const DEAL_MS = 500;
const DEAL_STAGGER_MS = 60;
/** Below this many points, a touch on the stack is a tap. */
const TAP_SLOP = 8;

interface Fan {
  readonly dx: SharedValue<number>;
  readonly dy: SharedValue<number>;
  readonly peek: SharedValue<number>;
  /** The drag's direction, as a unit vector. */
  readonly ux: SharedValue<number>;
  readonly uy: SharedValue<number>;
}

/**
 * The cards just out of the pack, face down. Dragging the stack diagonally fans it out and
 * shows the edges, coloured by rarity: a bonus gesture nothing on screen explains. The draw is
 * already made; this only shows it early. A tap or a swipe up reveals the first card.
 */
export function CardStack({
  cards,
  width,
  tone,
  onReveal,
}: {
  /** In reveal order: the first card is on top, the rarest at the bottom. */
  readonly cards: readonly DrawnCard[];
  readonly width: number;
  /** The `back` of the pack's collection. */
  readonly tone: string | undefined;
  readonly onReveal: () => void;
}) {
  const height = (width * cardSize.height) / cardSize.width;
  const fan: Fan = {
    dx: useSharedValue(0),
    dy: useSharedValue(0),
    peek: useSharedValue(0),
    ux: useSharedValue(0),
    uy: useSharedValue(0),
  };
  // The responder is made once: it reads the latest callback through this.
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  const moved = useRef(false);

  const springBack = () => {
    const settle = { duration: 300, easing: Easing.out(Easing.back(1.4)) };
    fan.dx.value = withTiming(0, settle);
    fan.dy.value = withTiming(0, settle);
    fan.peek.value = withTiming(0, settle);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        moved.current = false;
      },
      onPanResponderMove: (_event, { dx, dy }) => {
        const length = Math.hypot(dx, dy);
        if (length >= TAP_SLOP) moved.current = true;
        fan.dx.value = dx;
        fan.dy.value = dy;
        fan.peek.value = peekAmount(dx, dy);
        fan.ux.value = dx / (length || 1);
        fan.uy.value = dy / (length || 1);
      },
      onPanResponderRelease: (_event, { dx, dy }) => {
        springBack();
        if (!moved.current || stackRelease(dx, dy) === "reveal") reveal.current();
      },
      onPanResponderTerminate: springBack,
    }),
  ).current;

  return (
    <View
      style={{ width, height }}
      collapsable={false}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Révéler la première carte"
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={() => reveal.current()}
      {...responder.panHandlers}
    >
      {/* Drawn from the bottom of the stack up: the first card ends on top. */}
      {cards
        .map((card, index) => ({ card, index }))
        .reverse()
        .map(({ card, index }) => (
          <StackCard
            // A pack can hold the same card twice: its place is its key.
            key={index}
            card={card}
            index={index}
            count={cards.length}
            width={width}
            tone={tone}
            fan={fan}
          />
        ))}
    </View>
  );
}

function StackCard({
  card,
  index,
  count,
  width,
  tone,
  fan,
}: {
  readonly card: DrawnCard;
  readonly index: number;
  readonly count: number;
  readonly width: number;
  readonly tone: string | undefined;
  readonly fan: Fan;
}) {
  const dealt = useSharedValue(0);

  useEffect(() => {
    dealt.value = withDelay(
      index * DEAL_STAGGER_MS,
      withTiming(1, { duration: DEAL_MS, easing: Easing.out(Easing.back(1.2)) }),
    );
  }, [dealt, index]);

  const placed = useAnimatedStyle(() => {
    const deal = { opacity: dealt.value, scale: 0.8 + 0.2 * dealt.value };
    const rise = (1 - dealt.value) * 120;
    if (index === 0) {
      return {
        opacity: deal.opacity,
        transform: [
          { translateX: fan.dx.value * 0.12 },
          { translateY: fan.dy.value * 0.12 + rise },
          { scale: deal.scale },
        ],
      };
    }
    const offset = index * FAN_STEP * fan.peek.value;
    const settle = count - 1 - index;
    return {
      opacity: deal.opacity,
      transform: [
        { translateX: fan.ux.value * offset + settle * 0.5 },
        { translateY: fan.uy.value * offset - settle * 1.5 + rise },
        { rotate: `${index * fan.ux.value * fan.peek.value * 2.5}deg` },
        { scale: deal.scale },
      ],
    };
  });
  // The top card never shows its edge: it would give its rarity away before the reveal.
  const edge = useAnimatedStyle(() => ({ opacity: index === 0 ? 0 : fan.peek.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, placed]} pointerEvents="none">
      <CardBack rarity={card.rarity} width={width} tone={tone} />
      <Animated.View style={[StyleSheet.absoluteFill, edge]}>
        <CardBack rarity={card.rarity} width={width} edge={1} tone={tone} />
      </Animated.View>
    </Animated.View>
  );
}
