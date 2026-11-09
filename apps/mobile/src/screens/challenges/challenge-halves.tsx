import { toyRadii, toy as toyValues } from "@leximon/tokens";
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
        emblem={<ToyIcon name="challenges" size={30} />}
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
            <ToyIcon name="jousts" size={30} locked={jousts.lockedAt !== null} />
          ) : (
            <Crest league={jousts.league} size={26} />
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
    <View style={styles.slot}>
      <Toy
        matter={matter}
        bodyStyle={styles.body}
        accessibilityRole="link"
        accessibilityState={{ selected: here }}
        accessibilityLabel={[label, ...lines].join(" ")}
        onPress={() => {
          if (!here) router.navigate(HREFS[id]);
        }}
      >
        {emblem}
        <View style={styles.text}>
          <Lettering size={fontSizes.body}>{label}</Lettering>
          {lines.length > 0 && <Text style={styles.line}>{lines.join(" ")}</Text>}
        </View>
        {/* The other half sits in the shade, never see-through over the shelves. */}
        {!here && <View style={styles.shade} pointerEvents="none" />}
      </Toy>
      {waiting > 0 && <CountBadge count={String(waiting)} style={styles.badge} />}
    </View>
  );
}

const styles = StyleSheet.create({
  halves: { flexDirection: "row", gap: space.s4, paddingTop: space.s3 },
  slot: { flex: 1 },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    paddingLeft: space.s4,
    paddingRight: space.s5,
    paddingVertical: space.s4,
  },
  text: { flex: 1, gap: 1 },
  line: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.micro,
    lineHeight: 14,
    color: colors.inkOnColor,
  },
  shade: {
    ...StyleSheet.absoluteFill,
    borderRadius: toyRadii.small,
    backgroundColor: toyValues.drop,
  },
  badge: { position: "absolute", top: -6, right: -4 },
});
