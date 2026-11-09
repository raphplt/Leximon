import { toyMatters } from "@leximon/tokens";
import {
  CHALLENGE_HALVES,
  type ChallengeHalf,
  joustsHalf,
  trainingHalfLine,
} from "@leximon/view-model";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CountBadge } from "@/library/play-pieces";
import { reviewSummary } from "@/player/collection";
import { useShared } from "@/player/shared";
import { joustsOverview } from "@/player/state";
import { Crest } from "@/screens/jousts/crest";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Lettering, Toy, ToyIcon } from "@/ui/toy";

const HREFS: Readonly<Record<ChallengeHalf, "/defis" | "/joutes">> = {
  training: "/defis",
  jousts: "/joutes",
};

/**
 * The two halves of Défis, side by side at the top of each: the training on the player's words,
 * and the jousts with their league, their place and what waits there. As on the web.
 */
export function ChallengeHalves({ current }: { readonly current: ChallengeHalf }) {
  const summary = useShared(reviewSummary);
  const jousts = joustsHalf(useShared(joustsOverview));
  const training = trainingHalfLine(summary?.due ?? null);
  const [trainingLabel, joustsLabel] = CHALLENGE_HALVES.map((half) => half.label) as [
    string,
    string,
  ];
  return (
    <View style={styles.halves}>
      <Half
        id="training"
        current={current}
        label={trainingLabel}
        matter="blue"
        emblem={<ToyIcon name="challenges" size={44} />}
        lines={training === null ? [] : [training]}
        waiting={0}
      />
      <Half
        id="jousts"
        current={current}
        label={joustsLabel}
        matter={jousts.lockedAt === null ? "red" : "locked"}
        emblem={
          jousts.league === null ? (
            <ToyIcon name="jousts" size={44} locked={jousts.lockedAt !== null} />
          ) : (
            <Crest league={jousts.league} size={40} />
          )
        }
        lines={jousts.lines}
        waiting={jousts.waiting}
      />
    </View>
  );
}

function Half({
  id,
  current,
  label,
  matter,
  emblem,
  lines,
  waiting,
}: {
  readonly id: ChallengeHalf;
  readonly current: ChallengeHalf;
  readonly label: string;
  readonly matter: "blue" | "red" | "locked";
  readonly emblem: ReactNode;
  readonly lines: readonly string[];
  readonly waiting: number;
}) {
  const here = id === current;
  return (
    <View style={[styles.slot, !here && styles.away]}>
      <View style={[styles.ring, here && styles.here]}>
        <Toy
          matter={matter}
          shape="tile"
          large
          bodyStyle={styles.body}
          accessibilityRole="link"
          accessibilityState={{ selected: here }}
          accessibilityLabel={[label, ...lines].join(" ")}
          onPress={() => {
            if (!here) router.navigate(HREFS[id]);
          }}
        >
          {emblem}
          <Lettering size={fontSizes.bodyLarge}>{label}</Lettering>
          {lines.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
        </Toy>
      </View>
      {here && <View style={styles.notch} />}
      {waiting > 0 && <CountBadge count={String(waiting)} style={styles.badge} />}
    </View>
  );
}

const styles = StyleSheet.create({
  halves: { flexDirection: "row", gap: space.s8, paddingTop: space.s6 },
  slot: { flex: 1 },
  // The other half waits a little in the shade.
  away: { opacity: 0.8 },
  ring: { flex: 1, padding: 3, borderRadius: 24, borderWidth: 3, borderColor: "transparent" },
  here: { borderColor: toyMatters.gold.top },
  body: {
    flex: 1,
    alignItems: "center",
    gap: space.s2,
    paddingHorizontal: space.s6,
    paddingVertical: space.s8,
  },
  line: {
    textAlign: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.micro,
    lineHeight: 15,
    color: colors.inkOnColor,
  },
  notch: {
    alignSelf: "center",
    width: 12,
    height: 12,
    marginTop: -2,
    backgroundColor: toyMatters.gold.top,
    borderRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  badge: { position: "absolute", top: -6, right: -4 },
});
