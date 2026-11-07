import type { JoustStanding, LeagueId } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  divisionName,
  divisionNumeral,
  divisionShare,
  laurelsDelta,
  standingHeader,
} from "@leximon/view-model";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { Lettering } from "@/ui/toy";
import { ink } from "./pieces";

/** Each league in its matter, from paper to gold. */
export const LEAGUE_MATTERS: Readonly<Record<LeagueId, keyof typeof toyMatters>> = {
  page: "paper",
  ecuyer: "green",
  chevalier: "blue",
  banneret: "red",
  champion: "gold",
};

/** A league's shield, in its matter, with the division's numeral; Champion wears a crown. */
export function Shield({
  league,
  numeral,
  size,
}: {
  readonly league: LeagueId;
  readonly numeral: string | null;
  readonly size: number;
}) {
  const matter = toyMatters[LEAGUE_MATTERS[league]];
  const gradient = `shield-${league}`;
  const numeralSize = numeral === "III" ? 12 : 14;
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 40 46" accessible={false}>
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={matter.top} />
          <Stop offset="1" stopColor={matter.bottom} />
        </LinearGradient>
      </Defs>
      <Path
        d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8 Z"
        fill={matter.edge}
        stroke={toyValues.outline}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Path
        d="M20 4.5 L34.5 9.6 V21.5 C34.5 31 27.6 37 20 40.6 C12.4 37 5.5 31 5.5 21.5 V9.6 Z"
        fill={`url(#${gradient})`}
      />
      <Path d="M8 11 L20 7 L32 11" fill="none" stroke={toyMatters.paper.top} strokeOpacity={0.55} />
      {numeral === null ? (
        <Path
          d="M12 26 L14 17 L18 22 L20 15 L22 22 L26 17 L28 26 Z"
          fill={toyMatters.paper.top}
          stroke={toyValues.outline}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      ) : (
        // The outline first, then the numeral over it: react-native-svg has no paint order.
        [toyValues.outline, toyMatters.paper.top].map((color, layer) => (
          <SvgText
            key={color}
            x="20"
            y="28"
            textAnchor="middle"
            fontFamily={fonts.displayBold}
            fontSize={numeralSize}
            fill={color}
            stroke={layer === 0 ? toyValues.outline : "none"}
            strokeWidth={layer === 0 ? 2.2 : 0}
          >
            {numeral}
          </SvgText>
        ))
      )}
    </Svg>
  );
}

/** The player's league at the top of the jousts' home: shield, laurels, the way to the next. */
export function LeagueHeader({
  standing,
  today,
}: {
  readonly standing: JoustStanding;
  readonly today: string;
}) {
  const header = standingHeader(standing, today);
  return (
    <View style={styles.head}>
      <View style={styles.headTop}>
        <Shield
          league={standing.division.league}
          numeral={divisionNumeral(standing.division)}
          size={52}
        />
        <View style={styles.headText}>
          <Lettering size={fontSizes.subtitle}>{header.name}</Lettering>
          <View style={styles.laurels}>
            <Icon name="star" size={15} color={ink.pageInk} />
            <Text style={styles.laurelsText}>{header.laurels}</Text>
            {header.champion !== null && <Emblem>{header.champion}</Emblem>}
          </View>
        </View>
      </View>
      <Bar from={header.share} to={header.share} />
      <Text style={styles.next}>{header.next}</Text>
      {header.streak !== null && <Text style={styles.streak}>{header.streak}</Text>}
      <View style={styles.season}>
        <Icon name="clock" size={13} color={toyMatters.paper.top} />
        <Text style={styles.seasonText}>{header.season}</Text>
      </View>
    </View>
  );
}

/** The Champion emblem, a small gold tag. */
export function Emblem({ children }: { readonly children: string }) {
  return (
    <View style={styles.emblem}>
      <Text style={styles.emblemText}>{children}</Text>
    </View>
  );
}

/** A bar of gold that fills from one share to another. */
function Bar({
  from,
  to,
  delay = 0,
}: {
  readonly from: number;
  readonly to: number;
  readonly delay?: number;
}) {
  const reduced = useReducedMotion();
  const share = useSharedValue(reduced ? to : from);
  useEffect(() => {
    share.value = reduced ? to : withDelay(delay, withTiming(to, { duration: 1100 }));
  }, [share, to, delay, reduced]);
  const fill = useAnimatedStyle(() => ({ width: `${share.value * 100}%` }));
  return (
    <View style={styles.bar} accessible={false}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

/** Under a ranked joust's result: the laurels won or lost, the bar filling to where they stand. */
export function LaurelsGain({
  laurels,
}: {
  readonly laurels: {
    readonly before: number;
    readonly after: number;
    readonly division: JoustStanding["division"];
    readonly nextDivision: JoustStanding["nextDivision"];
  };
}) {
  const { division, nextDivision } = laurels;
  const from =
    laurels.before < division.from ? 0 : divisionShare(laurels.before, division, nextDivision);
  const to = divisionShare(laurels.after, division, nextDivision);
  return (
    <View style={styles.gain}>
      <View style={styles.gainLabels}>
        <View style={styles.gainLabel}>
          <Shield league={division.league} numeral={divisionNumeral(division)} size={22} />
          <Text style={styles.gainText}>{divisionName(division)}</Text>
        </View>
        <Text style={styles.gainText}>
          {nextDivision === null
            ? laurelsDelta(laurels)
            : `${divisionName(nextDivision)} à ${nextDivision.from}`}
        </Text>
      </View>
      <Bar from={from} to={to} delay={700} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: space.s3,
    paddingHorizontal: space.s6,
    paddingVertical: space.s5,
    borderRadius: radii.lg,
    backgroundColor: alpha(toyMatters.blue.top, 0.16),
  },
  headTop: { flexDirection: "row", alignItems: "center", gap: space.s5 },
  headText: { flex: 1, gap: space.s1 },
  laurels: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s3 },
  laurelsText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  next: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  streak: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.rubric },
  season: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.s2,
    paddingHorizontal: space.s4,
    paddingVertical: space.s1,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.dark.top,
  },
  seasonText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: toyMatters.paper.top },
  emblem: {
    paddingHorizontal: space.s3,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.gold.top,
  },
  emblemText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    color: toyValues.outline,
  },
  bar: {
    height: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundColor: alpha(ink.pageInk, 0.14),
  },
  barFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: toyMatters.gold.bottom,
    boxShadow: `inset 0 3px 0 ${toyMatters.gold.top}`,
  },
  gain: { alignSelf: "stretch", gap: space.s2 },
  gainLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gainLabel: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  gainText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
});
