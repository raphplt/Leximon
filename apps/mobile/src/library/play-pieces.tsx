import {
  lettering,
  room,
  stockToyInks,
  type ToyIconName,
  type ToyMatterName,
  toyMatters,
  toyRadii,
  toy as toyValues,
  welcomeCloth,
} from "@leximon/tokens";
import { type ReactNode, useEffect, useState } from "react";
import {
  type GestureResponderEvent,
  Image,
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Line, Pattern, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import { alpha, colors, fontSizes, fonts } from "@/theme";
import { LevelMedal } from "@/ui/level";
import { Matter } from "@/ui/matter";
import { TOOLING_ROOM, Tooling } from "@/ui/ornaments";
import { Kicker, Lettering, Lettrine, Toy, ToyBody, ToyIcon } from "@/ui/toy";

/**
 * The pieces of the Jouer screen. They know nothing of the game: each
 * screen gives them their words and figures, so that the same pieces serve every state.
 */

const SHELVES = require("../../assets/room/shelves.webp");

/** The corners of the desk, and the width of the leather turned in at its edge. */
export const DESK_RADIUS = toyRadii.large;
export const DESK_RIM = 5;
/** The room what lies on the desk keeps from its edge, clear of the gilt tooling. */
export const DESK_PADDING = Math.ceil(TOOLING_ROOM) + 3;

/**
 * The reading room behind a screen: shelves in the dark, the lamp's light in the middle and the
 * dark closing in at the edges. The shelves are laid tile by tile: on Android, `repeat` draws a
 * tile once in the corner.
 */
export function Room({ children }: { readonly children?: ReactNode }) {
  const [columns, setColumns] = useState(1);
  const measure = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    setColumns(Math.max(1, Math.ceil(layout.width / room.shelves.width)));
  return (
    <View style={styles.room} onLayout={measure}>
      <View style={styles.shelves} pointerEvents="none">
        {Array.from({ length: columns }, (_, column) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical tiles that never move
          <Image key={column} source={SHELVES} style={styles.shelf} />
        ))}
      </View>
      <View style={styles.lamp} pointerEvents="none" />
      <View style={styles.vignette} pointerEvents="none" />
      {children}
    </View>
  );
}

/**
 * The green leather desk under the lamp, tooled in gold as the board of a bound book; `cloth`
 * covers it with the welcome week's night-blue cloth instead. `tooled={false}` leaves the gilt off
 * where the desk only lies under a page that scrolls across it.
 */
export function Desk({
  style,
  cloth = false,
  tooled = true,
}: {
  readonly style?: StyleProp<ViewStyle>;
  readonly cloth?: boolean;
  readonly tooled?: boolean;
}) {
  return (
    <View style={[styles.deskFrame, style]} pointerEvents="none">
      <View style={[styles.desk, cloth && styles.cloth]}>
        <Matter kind={cloth ? "cloth" : "leather"} />
        {/* The leather runs to the edge and turns in there, a shade darker. */}
        <View style={[styles.deskRim, cloth && styles.clothRim]} />
      </View>
      {tooled && <Tooling />}
    </View>
  );
}

/**
 * Full-screen single-hue aged 3D diamond backdrop for the Jouer screen, replacing both the
 * bookshelf room and the framed green leather desk on mobile.
 */
export function DiamondBackdrop() {
  return (
    <View style={styles.diamondBackdrop} pointerEvents="none" accessible={false}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="diamond-pillow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toyValues.sheen} stopOpacity={0.07} />
            <Stop offset="100%" stopColor={toyValues.sheen} stopOpacity={0} />
          </RadialGradient>
          <Pattern id="play-diamonds" width={62} height={66} patternUnits="userSpaceOnUse">
            <Rect width={62} height={66} fill={room.desk.edge} />
            <Polygon points="31,0 62,33 31,66 0,33" fill={room.desk.middle} />
            <Polygon points="31,0 62,33 31,66 0,33" fill="url(#diamond-pillow)" />
            <Line
              x1={0}
              y1={33}
              x2={31}
              y2={0}
              stroke={alpha(toyValues.sheen, 0.14)}
              strokeWidth={1.2}
            />
            <Line
              x1={31}
              y1={0}
              x2={62}
              y2={33}
              stroke={alpha(toyValues.sheen, 0.14)}
              strokeWidth={1.2}
            />
            <Line
              x1={0}
              y1={33}
              x2={31}
              y2={66}
              stroke={alpha(colors.shade, 0.45)}
              strokeWidth={1.4}
            />
            <Line
              x1={62}
              y1={33}
              x2={31}
              y2={66}
              stroke={alpha(colors.shade, 0.45)}
              strokeWidth={1.4}
            />
          </Pattern>
          <RadialGradient id="play-lamp" cx="50%" cy="34%" r="55%">
            <Stop offset="0%" stopColor={room.desk.center} stopOpacity={0.32} />
            <Stop offset="65%" stopColor={room.desk.center} stopOpacity={0.08} />
            <Stop offset="100%" stopColor={room.desk.center} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="play-vignette" cx="50%" cy="50%" r="72%">
            <Stop offset="45%" stopColor={colors.shade} stopOpacity={0} />
            <Stop offset="100%" stopColor={colors.shade} stopOpacity={0.62} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#play-diamonds)" />
        <Rect width="100%" height="100%" fill="url(#play-lamp)" />
        <Rect width="100%" height="100%" fill="url(#play-vignette)" />
      </Svg>
      <Matter kind="leather" />
    </View>
  );
}

/** Repeats a small motion every `period` ms, unless the player asks for reduced motion. */
function useNudge(period: number) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(
      withSequence(
        withDelay(period * 0.75, withTiming(-1, { duration: period * 0.06 })),
        withTiming(1, { duration: period * 0.07 }),
        withTiming(0, { duration: period * 0.06 }),
        withTiming(0, { duration: period * 0.06 }),
      ),
      -1,
    );
  }, [reduced, period, turn]);
  return turn;
}

/** A red count of what waits for the player, which nudges now and then. */
export function CountBadge({
  count,
  style,
}: {
  readonly count: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const turn = useNudge(2600);
  const nudged = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(0, turn.value) * 4 }, { rotate: `${turn.value * 6}deg` }],
  }));
  return (
    <Animated.View style={[style, nudged]} pointerEvents="none">
      <ToyBody matter="alert" shape="tag" style={styles.badge}>
        <Lettering size={13}>{count}</Lettering>
      </ToyBody>
    </Animated.View>
  );
}

/** The player's portrait, which opens their profile. */
export function PortraitButton({
  label,
  compact = false,
  children,
  onPress,
}: {
  readonly label: string;
  readonly compact?: boolean;
  readonly children: ReactNode;
  readonly onPress?: () => void;
}) {
  return (
    <Toy
      matter="paper"
      style={[styles.portrait, compact && styles.portraitCompact]}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <View style={styles.portraitFrame}>{children}</View>
    </Toy>
  );
}

/** Narrower, on a small phone, the XP bar would shrink to a sliver beside the medal: it goes. */
const GAUGE_MIN_WIDTH = 94;

/** The level as its gilt medal, and the experience toward the next one as a gilt bar. */
export function LevelGauge({
  level,
  progress,
  label,
  compact = false,
}: {
  readonly level: number;
  /** From 0 to 1. */
  readonly progress: number;
  readonly label: string;
  readonly compact?: boolean;
}) {
  const filled = Math.min(1, Math.max(0, progress));
  const [roomy, setRoomy] = useState(true);
  return (
    <View
      style={styles.level}
      onLayout={(event) => setRoomy(event.nativeEvent.layout.width >= GAUGE_MIN_WIDTH)}
    >
      <View style={[styles.medal, compact && styles.medalCompact]}>
        <LevelMedal level={level} size={compact ? 42 : 46} />
      </View>
      {roomy && (
        <View style={styles.xp}>
          <View style={[styles.xpFill, { width: `${filled * 100}%` }]} />
          <View style={styles.xpText}>
            <Lettering size={11} font={fonts.ui.extrabold} numberOfLines={1}>
              {label}
            </Lettering>
          </View>
        </View>
      )}
    </View>
  );
}

/** Sachets in stock, which opens their detail. */
export function StockButton({
  label,
  figure,
  compact = false,
  onPress,
}: {
  readonly label: string;
  readonly figure: string;
  readonly compact?: boolean;
  readonly onPress?: () => void;
}) {
  return (
    <Toy
      matter="paper"
      style={[styles.stockToy, compact && styles.stockToyCompact]}
      bodyStyle={[styles.stock, compact && styles.stockCompact]}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <ToyIcon name="sachet" size={compact ? 26 : 30} inks={stockToyInks} />
      <Lettering size={compact ? 15 : 17}>{figure}</Lettering>
    </Toy>
  );
}

/** The player's écus, which opens what they are for. */
export function EcusButton({
  label,
  figure,
  compact = false,
  onPress,
}: {
  readonly label: string;
  readonly figure: string;
  readonly compact?: boolean;
  readonly onPress?: () => void;
}) {
  return (
    <Toy
      matter="paper"
      style={[styles.stockToy, compact && styles.stockToyCompact]}
      bodyStyle={[styles.stock, compact && styles.stockCompact]}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <ToyIcon name="ecu" size={compact ? 26 : 30} />
      <Lettering size={compact ? 15 : 17}>{figure}</Lettering>
    </Toy>
  );
}

/** The mail, with what waits in it. */
export function MailButton({
  label,
  count,
  compact = false,
  onPress,
}: {
  readonly label: string;
  readonly count: number;
  readonly compact?: boolean;
  readonly onPress?: () => void;
}) {
  return (
    <View>
      <Toy
        matter="red"
        style={[styles.mail, compact && styles.mailCompact]}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
      >
        <ToyIcon name="mail" size={compact ? 26 : 30} />
      </Toy>
      {count > 0 && <CountBadge count={String(count)} style={styles.corner} />}
    </View>
  );
}

/** One of the tiles beside the sachet: its leather, its icon, and a lock until its level. */
export function SideTile({
  icon,
  matter,
  label,
  badge,
  lockedAt,
  compact = false,
  onPress,
}: {
  readonly icon: ToyIconName;
  readonly matter: ToyMatterName;
  readonly label: string;
  readonly badge?: string | undefined;
  /** The level that opens it, while it is closed. */
  readonly lockedAt?: string | undefined;
  readonly compact?: boolean;
  readonly onPress?: (event: GestureResponderEvent) => void;
}) {
  const locked = lockedAt !== undefined;
  return (
    <View style={[styles.side, compact && styles.sideCompact]}>
      <View>
        <Toy
          matter={locked ? "locked" : "gold"}
          shape="tile"
          style={[styles.tile, compact && styles.tileCompact]}
          accessibilityRole="button"
          accessibilityLabel={locked ? `${label}, ${lockedAt}` : label}
          onPress={onPress}
        >
          <Lettrine icon={icon} matter={matter} size={compact ? 28 : 34} locked={locked} />
        </Toy>
        {locked && (
          <View style={styles.lockPin} pointerEvents="none">
            <ToyIcon name="lock" size={compact ? 22 : 26} />
          </View>
        )}
        {!locked && badge !== undefined && <CountBadge count={badge} style={styles.corner} />}
      </View>
      {locked && (
        <ToyBody matter="dark" shape="tag" style={styles.levelTag}>
          <Lettering size={compact ? 10 : 11}>{lockedAt}</Lettering>
        </ToyBody>
      )}
      <Lettering size={compact ? 10 : 11} numberOfLines={2} style={styles.sideLabel}>
        {label}
      </Lettering>
    </View>
  );
}

/** The collection on the desk, with arrows to the others and a dot for each. */
export function CollectionTitle({
  kicker,
  name,
  tagline,
  index,
  count,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: {
  readonly kicker: string;
  readonly name: string;
  readonly tagline: string;
  readonly index: number;
  readonly count: number;
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
}) {
  return (
    <View style={styles.collection}>
      <View style={styles.collectionRow}>
        <Toy
          matter="paper"
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel={previousLabel}
          onPress={onPrevious}
        >
          <ToyIcon name="arrow" size={26} />
        </Toy>
        <View style={styles.collectionName}>
          <Kicker>{kicker}</Kicker>
          <Lettering size={24} numberOfLines={2} style={styles.name}>
            {name}
          </Lettering>
          <View style={styles.dots}>
            {Array.from({ length: count }, (_, dot) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one dot per place, which never moves
              <View key={dot} style={[styles.dot, dot === index && styles.dotOn]} />
            ))}
          </View>
        </View>
        <Toy
          matter="paper"
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
          onPress={onNext}
        >
          <View style={styles.flipped}>
            <ToyIcon name="arrow" size={26} />
          </View>
        </Toy>
      </View>
      <Text style={styles.tagline}>{tagline}</Text>
    </View>
  );
}

/** The main action, in old gold, which invites a press every few seconds while it waits. */
export function MainAction({
  label,
  count,
  inviting = true,
  disabled = false,
  onPress,
}: {
  readonly label: string;
  readonly count?: string | undefined;
  readonly inviting?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}) {
  const reduced = useReducedMotion();
  const squash = useSharedValue(0);
  useEffect(() => {
    if (reduced || !inviting || disabled) {
      squash.value = 0;
      return;
    }
    squash.value = withRepeat(
      withSequence(
        withDelay(2400, withTiming(1, { duration: 180 })),
        withTiming(-0.25, { duration: 180 }),
        withTiming(0, { duration: 240 }),
      ),
      -1,
    );
  }, [reduced, inviting, disabled, squash]);
  const invite = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + squash.value * 0.04 }, { scaleY: 1 - squash.value * 0.03 }],
  }));
  return (
    <Animated.View style={[styles.mainWrap, invite]}>
      <Toy
        matter="gold"
        large
        style={styles.main}
        bodyStyle={styles.mainBody}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
      >
        <View style={styles.sheen} pointerEvents="none" />
        <Lettering size={22}>{label}</Lettering>
        {count !== undefined && (
          <ToyBody matter="red" shape="round" style={styles.mainCount}>
            <Lettering size={18}>{count}</Lettering>
          </ToyBody>
        )}
      </Toy>
    </Animated.View>
  );
}

/** A secondary action, in paper. */
export function PaperAction({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress?: () => void;
}) {
  return (
    <Toy
      matter="paper"
      style={styles.paperAction}
      bodyStyle={styles.paperActionBody}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Lettering size={15} style={styles.paperActionLabel}>
        {label}
      </Lettering>
    </Toy>
  );
}

export interface Tab {
  readonly icon: ToyIconName;
  readonly label: string;
  readonly badge?: string | undefined;
  /** Why it is closed, said when it is touched. */
  readonly lockedAt?: string | undefined;
}

/** The shelf of tabs: two on each side and Jouer in the middle, higher than the others, in gold. */
export function TabBar({
  tabs,
  playLabel,
  bottomInset = 0,
  current = null,
  onTab,
  onPlay,
}: {
  readonly tabs: readonly [Tab, Tab, Tab, Tab];
  readonly playLabel: string;
  readonly bottomInset?: number;
  /** The tab of the screen shown, `play` for Jouer. */
  readonly current?: number | "play" | null;
  readonly onTab?: (index: number) => void;
  readonly onPlay?: () => void;
}) {
  const [first, second, third, fourth] = tabs;
  const tab = (item: Tab, index: number) => {
    const locked = item.lockedAt !== undefined;
    const focused = current === index;
    return (
      <Pressable
        key={item.label}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={locked ? `${item.label}, ${item.lockedAt}` : item.label}
        onPress={() => onTab?.(index)}
      >
        <View style={locked ? styles.tabIconLocked : focused ? styles.tabIconFocused : undefined}>
          <ToyIcon name={item.icon} size={28} locked={locked} />
        </View>
        {locked && (
          <View style={styles.tabLock}>
            <ToyIcon name="lock" size={16} />
          </View>
        )}
        {item.badge !== undefined && <CountBadge count={item.badge} style={styles.tabBadge} />}
        <Lettering size={10} numberOfLines={1} {...(focused ? { color: toyMatters.gold.top } : {})}>
          {item.label}
        </Lettering>
      </Pressable>
    );
  };
  return (
    <View style={[styles.tabs, { paddingBottom: bottomInset + 2 }]}>
      <View style={styles.shelfGilt} />
      {tab(first, 0)}
      {tab(second, 1)}
      <View style={styles.tab}>
        <View style={styles.playRing}>
          <Toy
            matter="gold"
            large
            shape="tile"
            style={styles.playDisc}
            accessibilityRole="tab"
            accessibilityState={{ selected: current === "play" }}
            accessibilityLabel={playLabel}
            onPress={onPlay}
          >
            <ToyIcon name="sachet" size={38} />
          </Toy>
        </View>
        <Lettering size={11} color={toyMatters.gold.top}>
          {playLabel}
        </Lettering>
      </View>
      {tab(third, 2)}
      {tab(fourth, 3)}
    </View>
  );
}

/**
 * A short message on a slip of paper, which pops in and leaves on its own. A new `message`
 * object shows it again, even with the same words.
 */
export function InfoBubble({ message }: { readonly message: { readonly text: string } | null }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    if (message === null) return;
    shown.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1.08, { duration: 170 }),
      withTiming(1, { duration: 130 }),
      withDelay(1550, withTiming(0, { duration: 330 })),
    );
  }, [message, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.value * 1.5),
    transform: [{ scale: 0.6 + Math.min(shown.value, 1.08) * 0.4 }],
  }));
  return (
    <Animated.View style={[styles.bubble, style]} pointerEvents="none">
      <Text style={styles.bubbleText} accessibilityLiveRegion="polite">
        {message?.text}
      </Text>
    </Animated.View>
  );
}

const outlined = {
  borderWidth: toyValues.outlineWidth,
  borderColor: toyValues.outline,
} as const;

const styles = StyleSheet.create({
  room: { flex: 1, overflow: "hidden", backgroundColor: room.floor },
  shelves: { ...StyleSheet.absoluteFill, flexDirection: "row" },
  shelf: { width: room.shelves.width, height: room.shelves.height },
  lamp: {
    ...StyleSheet.absoluteFill,
    backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 40%, ${room.lamp}, transparent 70%)`,
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundImage: `radial-gradient(ellipse 90% 80% at 50% 45%, transparent 45%, ${room.vignette} 100%)`,
  },
  deskFrame: {
    borderRadius: DESK_RADIUS,
    boxShadow: `0 0 0 3px ${toyValues.outline}, 0 24px 44px ${toyValues.drop}`,
  },
  desk: {
    flex: 1,
    overflow: "hidden",
    borderRadius: DESK_RADIUS,
    backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 40%, ${room.desk.center} 0%, ${room.desk.middle} 55%, ${room.desk.edge} 100%)`,
    boxShadow: `inset 0 0 50px ${room.desk.hollow}`,
  },
  cloth: {
    backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 40%, ${welcomeCloth.center} 0%, ${welcomeCloth.middle} 55%, ${welcomeCloth.edge} 100%)`,
  },
  // A little light catches the top of the turn, under the rim.
  deskRim: {
    ...StyleSheet.absoluteFill,
    borderRadius: DESK_RADIUS,
    borderWidth: DESK_RIM,
    borderColor: alpha(room.desk.edge, 0.7),
    boxShadow: `inset 0 2px 0 ${alpha(lettering.fill, 0.05)}`,
  },
  clothRim: { borderColor: alpha(welcomeCloth.edge, 0.7) },
  badge: { minWidth: 23, height: 23, paddingHorizontal: 5 },
  corner: { position: "absolute", top: -9, right: -9, zIndex: 2 },
  portrait: { width: 54, height: 54 },
  portraitCompact: { width: 46, height: 46 },
  portraitFrame: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 5,
    overflow: "hidden",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  level: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 },
  medal: { zIndex: 2, width: 46, height: 46 },
  medalCompact: { width: 42, height: 42 },
  xp: {
    ...outlined,
    flex: 1,
    maxWidth: 120,
    height: 20,
    marginLeft: -14,
    overflow: "hidden",
    borderLeftWidth: 0,
    borderTopRightRadius: 11,
    borderBottomRightRadius: 11,
    backgroundColor: colors.well,
    boxShadow: `0 4px 0 ${toyValues.outline}, inset 0 3px 4px ${toyValues.drop}`,
  },
  xpFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundImage: `linear-gradient(180deg, ${colors.xpLight} 0%, ${colors.xpLight} 45%, ${colors.xpDeep} 55%, ${colors.xpDeep} 100%)`,
    boxShadow: `inset 0 -3px 0 ${toyMatters.gold.edge}`,
  },
  xpText: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 14,
    paddingRight: 6,
  },
  stockToy: { height: 42 },
  stockToyCompact: { height: 38 },
  stock: { flexDirection: "row", gap: 4, paddingLeft: 5, paddingRight: 10 },
  stockCompact: { gap: 3, paddingLeft: 4, paddingRight: 8 },
  mail: { width: 46, height: 46 },
  mailCompact: { width: 42, height: 42 },
  side: { alignItems: "center", width: 88 },
  sideCompact: { width: 58 },
  tile: { width: 58, height: 58 },
  tileCompact: { width: 48, height: 48 },
  diamondBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: room.desk.edge },
  lockPin: { position: "absolute", top: -10, right: -10, zIndex: 2 },
  levelTag: { zIndex: 2, marginTop: -9, paddingHorizontal: 7, paddingBottom: 2 },
  sideLabel: { marginTop: 4, textAlign: "center" },
  collection: { alignItems: "center" },
  collectionRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  arrow: { width: 42, height: 42 },
  flipped: { transform: [{ scaleX: -1 }] },
  collectionName: { alignItems: "center", minWidth: 180 },
  name: { maxWidth: 260, marginTop: 3, textAlign: "center" },
  dots: { flexDirection: "row", gap: 7, marginTop: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: room.desk.edge,
  },
  dotOn: {
    backgroundColor: toyMatters.gold.top,
    boxShadow: `inset 0 -2px 0 ${toyMatters.gold.edge}`,
  },
  tagline: {
    marginTop: 3,
    marginHorizontal: 18,
    color: colors.pageInkSoft,
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.body,
    lineHeight: 20,
    textAlign: "center",
    textShadowColor: colors.shade,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mainWrap: { width: "100%", maxWidth: 320 },
  main: { height: 66 },
  mainBody: { flexDirection: "row", gap: 12 },
  sheen: {
    position: "absolute",
    top: 2,
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: toyValues.sheen,
  },
  mainCount: { width: 38, height: 38 },
  paperAction: { minHeight: 46, maxWidth: "100%" },
  paperActionBody: { paddingHorizontal: 20, paddingVertical: 8 },
  paperActionLabel: { textAlign: "center" },
  tabs: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingTop: 5,
    paddingHorizontal: 4,
    backgroundImage: `linear-gradient(180deg, ${room.shelf.top}, ${room.shelf.bottom})`,
    boxShadow: `inset 0 5px 0 ${room.shelf.giltShade}, 0 -8px 20px ${toyValues.drop}`,
  },
  shelfGilt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: room.shelf.gilt,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingBottom: 2 },
  tabIconLocked: { opacity: 0.6 },
  tabIconFocused: { transform: [{ translateY: -3 }] },
  tabLock: { position: "absolute", top: -4, right: 12 },
  tabBadge: { position: "absolute", top: -6, right: 6 },
  playRing: {
    marginTop: -30,
    borderRadius: 22,
    boxShadow: `0 0 0 4px ${room.shelf.bottom}`,
  },
  playDisc: { width: 62, height: 62 },
  bubble: {
    ...outlined,
    position: "absolute",
    alignSelf: "center",
    top: "22%",
    maxWidth: 320,
    marginHorizontal: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.paper,
    boxShadow: `0 4px 0 ${toyValues.outline}, 0 10px 20px ${toyValues.drop}`,
    opacity: 0,
  },
  bubbleText: {
    color: colors.paperInk,
    fontFamily: fonts.text.medium,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 21,
    textAlign: "center",
  },
});
