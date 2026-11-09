import type { WeekMove } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { type JoustTournament, tournamentGain } from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { Lettering } from "@/ui/toy";
import { Crest } from "./crest";
import { ink } from "./pieces";

/** What a place gives at the end of the week, in a colour: green going up, red going down. */
export const MOVE_COLORS: Readonly<Record<WeekMove, string>> = {
  up: toyMatters.green.bottom,
  stay: ink.pageInk,
  down: toyMatters.red.bottom,
};

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
        <Crest league={tournament.league} size={28} />
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
