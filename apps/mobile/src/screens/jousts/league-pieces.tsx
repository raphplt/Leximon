import type { JoustStanding, LeagueId, WeekMove } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  type JoustTournament,
  leagueNumeral,
  standingHeader,
  tournamentGain,
} from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
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
  marechal: "dark",
  connetable: "locked",
  champion: "gold",
};

/** What a place gives at the end of the week, in a colour: green going up, red going down. */
export const MOVE_COLORS: Readonly<Record<WeekMove, string>> = {
  up: toyMatters.green.bottom,
  stay: ink.pageInk,
  down: toyMatters.red.bottom,
};

/** A league's shield, in its matter, with the league's numeral; Champion wears a crown. */
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
  const numeralSize = numeral !== null && numeral.length > 2 ? 12 : 14;
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

/** The player's league at the top of the jousts' home: shield, place in the week's tournament. */
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
        <Shield league={standing.league} numeral={leagueNumeral(standing.league)} size={52} />
        <View style={styles.headText}>
          <View style={styles.headName}>
            <Lettering size={fontSizes.subtitle}>{header.name}</Lettering>
            {header.champion !== null && <Emblem>{header.champion}</Emblem>}
          </View>
          {header.place !== null && header.points !== null && (
            <Text style={styles.place}>{`${header.place} · ${header.points}`}</Text>
          )}
        </View>
      </View>
      <Text
        style={[
          styles.line,
          header.move !== null && header.move !== "stay" && { color: MOVE_COLORS[header.move] },
        ]}
      >
        {header.line}
      </Text>
      <View style={styles.ranked}>
        <Icon name="bolt" size={14} color={ink.pageInk} />
        <Text style={styles.rankedText}>{header.ranked}</Text>
      </View>
      <View style={styles.week}>
        <Icon name="clock" size={13} color={toyMatters.paper.top} />
        <Text style={styles.weekText}>{header.week}</Text>
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

/** Under a ranked joust's result: the points it gave, and the place in the group now. */
export function TournamentGain({ tournament }: { readonly tournament: JoustTournament }) {
  const gain = tournamentGain(tournament);
  return (
    <View style={styles.gain}>
      <View style={styles.gainTop}>
        <Shield league={tournament.league} numeral={leagueNumeral(tournament.league)} size={28} />
        <Lettering size={fontSizes.subtitle}>{gain.points}</Lettering>
      </View>
      {gain.place !== null && (
        <Text
          style={[
            styles.gainPlace,
            gain.move !== null && gain.move !== "stay" && { color: MOVE_COLORS[gain.move] },
          ]}
        >
          {gain.place}
        </Text>
      )}
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
  headName: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s3 },
  place: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  line: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.small, color: ink.pageInk },
  ranked: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  rankedText: {
    flex: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  week: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.s2,
    paddingHorizontal: space.s4,
    paddingVertical: space.s1,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.dark.top,
  },
  weekText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: toyMatters.paper.top },
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
  gain: { alignSelf: "stretch", alignItems: "center", gap: space.s2 },
  gainTop: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  gainPlace: {
    textAlign: "center",
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    color: ink.pageInk,
  },
});
