import { lettering, oldGold, sachetCloths, toy, toyMatters } from "@leximon/tokens";
import { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { fonts } from "@/theme";
import { LogoMarkShapes } from "@/ui/logo-mark";
import { Lettering } from "@/ui/toy";

const WIDTH = 176;
const HEIGHT = 256;
const STRIP = 30;
const TOOTH = 12;
const CRIMP = 7;

function clothOf(back: string | undefined): readonly [string, string, string] {
  return back !== undefined && Object.hasOwn(sachetCloths, back)
    ? sachetCloths[back as keyof typeof sachetCloths]
    : sachetCloths.night;
}

/** A crimped edge along `y`, drawn from right to left, its teeth pointing down. */
function crimp(y: number): string {
  let path = "";
  for (let x = WIDTH; x > 0; x -= TOOTH) {
    path += ` L ${x - TOOTH / 2} ${y + CRIMP} L ${Math.max(0, x - TOOTH)} ${y}`;
  }
  return path;
}

/** The strip that tears off, with its teeth along its bottom. */
const STRIP_PATH = `M 0 0 L ${WIDTH} 0 L ${WIDTH} ${STRIP - CRIMP}${crimp(STRIP - CRIMP)} Z`;

/** The pouch under it, crimped at the bottom, rounded only where the cloth folds. */
const BODY_PATH = `M 0 ${STRIP} L ${WIDTH} ${STRIP} L ${WIDTH} ${HEIGHT - CRIMP}${crimp(HEIGHT - CRIMP)} Z`;

/**
 * The sachet of « La Bibliothèque »: cloth in the collection's color under a gilt frame, an
 * engraved medallion, a red ribbon with the collection's name and the house's wax seal. It floats
 * on the desk while it waits, and light leaks from its seam while it charges.
 */
export function LibrarySachet({
  name,
  back,
  engraving,
  label,
  countLabel,
  charging = false,
  onOpen,
}: {
  readonly name: string;
  /** The `back` tone of the collection; night when absent. */
  readonly back: string | undefined;
  /** The engraving's ink, as an address; the house seal when absent. */
  readonly engraving?: string | undefined;
  /** What touching it does, for a screen reader. */
  readonly label: string;
  readonly countLabel: string;
  readonly charging?: boolean;
  readonly onOpen?: () => void;
}) {
  const [light, middle, dark] = clothOf(back);
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const seam = useSharedValue(0);
  useEffect(() => {
    if (reduced || charging) {
      bob.value = withTiming(0, { duration: 200 });
      return;
    }
    bob.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduced, charging, bob]);
  useEffect(() => {
    seam.value = withTiming(charging ? 1 : 0, { duration: charging ? 1100 : 200 });
  }, [charging, seam]);
  const floating = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 * bob.value }, { rotate: `${-1.2 + 2.4 * bob.value}deg` }],
  }));
  const shadow = useAnimatedStyle(() => ({
    opacity: 1 - 0.4 * bob.value,
    transform: [{ scaleX: 1 - 0.18 * bob.value }],
  }));
  const aura = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.25 * bob.value,
    transform: [{ scale: 0.92 + 0.13 * bob.value }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: seam.value }));
  return (
    <View style={styles.zone}>
      <Animated.View style={[styles.aura, aura]} pointerEvents="none" />
      <Animated.View style={[styles.shadow, shadow]} pointerEvents="none" />
      <Animated.View style={[styles.sachet, floating]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onOpen}
        >
          <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="cloth" x1="0.2" y1="0" x2="0.8" y2="1">
                <Stop offset="0" stopColor={light} />
                <Stop offset="0.6" stopColor={middle} />
                <Stop offset="1" stopColor={dark} />
              </LinearGradient>
              <LinearGradient id="strip" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={middle} />
                <Stop offset="1" stopColor={dark} />
              </LinearGradient>
            </Defs>
            <Path
              d={BODY_PATH}
              fill="url(#cloth)"
              stroke={toy.outline}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <Path d={BODY_PATH} fill="url(#cloth)" />
            <Path
              d={STRIP_PATH}
              fill="url(#strip)"
              stroke={toy.outline}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <Path d={STRIP_PATH} fill="url(#strip)" />
            <Path
              d={`M 6 ${STRIP - 2} L ${WIDTH - 6} ${STRIP - 2}`}
              stroke={lettering.kicker}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          </Svg>
          <Animated.View style={[styles.seam, glow]} pointerEvents="none" />
          <View style={styles.frame} pointerEvents="none" />
          <Text style={styles.brand}>LEXIMON</Text>
          <View style={styles.medallion}>
            {engraving === undefined ? (
              <Svg width={80} height={80} viewBox="0 0 100 100">
                <LogoMarkShapes id="library-sachet-seal" />
              </Svg>
            ) : (
              <Image source={{ uri: engraving }} style={styles.engraving} resizeMode="contain" />
            )}
          </View>
          <View style={styles.ribbon}>
            <Lettering size={13} numberOfLines={2} style={styles.ribbonText}>
              {name}
            </Lettering>
          </View>
          <Text style={styles.count}>{countLabel.toUpperCase()}</Text>
          <View style={styles.wax}>
            <Svg width={32} height={32} viewBox="0 0 100 100">
              <LogoMarkShapes id="library-sachet-wax" />
            </Svg>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { width: WIDTH, height: HEIGHT },
  aura: {
    position: "absolute",
    top: -HEIGHT * 0.4,
    bottom: -HEIGHT * 0.4,
    left: -WIDTH * 0.4,
    right: -WIDTH * 0.4,
    backgroundImage:
      "radial-gradient(closest-side, rgba(255, 200, 110, 0.4), rgba(255, 160, 60, 0.1) 60%, transparent)",
  },
  shadow: {
    position: "absolute",
    left: WIDTH * 0.18,
    right: WIDTH * 0.18,
    bottom: -26,
    height: 18,
    backgroundImage: "radial-gradient(closest-side, rgba(0, 0, 0, 0.55), transparent)",
  },
  sachet: {
    ...StyleSheet.absoluteFill,
    filter: "drop-shadow(0px 14px 7px rgba(0, 0, 0, 0.55))",
  },
  seam: {
    position: "absolute",
    top: STRIP - 3,
    left: 6,
    right: 6,
    height: 3,
    backgroundColor: "#FFFBE8",
    boxShadow: "0 0 10px 3px #FFF2B8, 0 0 30px 12px rgba(255, 196, 80, 0.8)",
  },
  frame: {
    position: "absolute",
    top: STRIP + 8,
    left: 10,
    right: 10,
    bottom: 16,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: oldGold.stops[1]?.[0] ?? lettering.kicker,
  },
  brand: {
    position: "absolute",
    top: STRIP + 18,
    left: 0,
    right: 0,
    color: lettering.kicker,
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 3.8,
    textAlign: "center",
  },
  medallion: {
    position: "absolute",
    top: STRIP + 40,
    left: WIDTH / 2 - 48,
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 48,
    borderWidth: 4,
    borderColor: oldGold.stops[1]?.[0] ?? lettering.kicker,
    backgroundImage: "radial-gradient(circle at 50% 40%, #FBF0D4, #DCC08A)",
    boxShadow: `0 0 0 2px ${toy.outline}, 0 4px 0 rgba(0, 0, 0, 0.35)`,
  },
  engraving: { width: 78, height: 78, tintColor: "#3B2414" },
  ribbon: {
    position: "absolute",
    top: STRIP + 148,
    left: 4,
    right: 4,
    paddingTop: 6,
    paddingBottom: 7,
    paddingHorizontal: 4,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: toy.outline,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.red.top} 0%, ${toyMatters.red.top} 50%, ${toyMatters.red.bottom} 50%, ${toyMatters.red.bottom} 100%)`,
    boxShadow: `inset 0 -4px 0 ${toyMatters.red.edge}, 0 3px 0 ${toy.outline}`,
  },
  ribbonText: { textAlign: "center" },
  count: {
    position: "absolute",
    top: STRIP + 196,
    left: 0,
    right: 0,
    color: lettering.kicker,
    fontFamily: fonts.ui.extrabold,
    fontSize: 10,
    letterSpacing: 2.5,
    textAlign: "center",
  },
  wax: { position: "absolute", right: 12, bottom: 16, transform: [{ rotate: "-12deg" }] },
});
