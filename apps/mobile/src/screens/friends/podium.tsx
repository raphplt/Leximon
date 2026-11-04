import type { PodiumResponse } from "@leximon/contract";
import {
  answersLabel,
  goalTimeLeft,
  PODIUM_ALONE,
  PODIUM_EMPTY,
  playerName,
  podiumView,
  rankLabel,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { alpha, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";

/** Height of each step of the podium, first place first. */
const STEP_HEIGHTS = [64, 46, 32] as const;
/** The steps read second, first, third, from left to right. */
const STEP_ORDER = [1, 0, 2] as const;

/** The week's podium among friends, on correct challenge answers. No reward. */
export function Podium({ alone, now }: { readonly alone: boolean; readonly now: number }) {
  const [podium, setPodium] = useState<PodiumResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [unfolded, setUnfolded] = useState(false);

  useEffect(() => {
    api
      .fetchPodium()
      .then(setPodium)
      .catch(() => setFailed(true));
  }, []);

  const view = podium === null ? null : podiumView(podium.entries);
  return (
    <Panel paper>
      <View style={styles.head}>
        <Text style={styles.kicker}>PODIUM DE LA SEMAINE</Text>
        {podium !== null && <Text style={styles.small}>{goalTimeLeft(podium.weekEnd, now)}</Text>}
      </View>
      {view === null ? (
        <Text style={styles.small}>{failed ? "Le podium ne répond pas." : "Un instant…"}</Text>
      ) : alone ? (
        <Text style={styles.empty}>{PODIUM_ALONE}</Text>
      ) : view.empty ? (
        <Text style={styles.empty}>{PODIUM_EMPTY}</Text>
      ) : (
        <>
          <View style={styles.steps}>
            {STEP_ORDER.map((place) => {
              const entry = view.steps[place];
              if (entry === undefined) return <View key={place} style={styles.step} />;
              return (
                <View key={entry.player.code} style={styles.step}>
                  <Avatar avatar={entry.player.avatar} frame={null} size={place === 0 ? 56 : 44} />
                  <Text style={styles.stepName} numberOfLines={1}>
                    {entry.self ? "Toi" : playerName(entry.player)}
                  </Text>
                  <Text style={styles.stepAnswers}>{entry.answers}</Text>
                  <View
                    style={[
                      styles.block,
                      { height: STEP_HEIGHTS[place] },
                      entry.self && styles.blockSelf,
                    ]}
                  >
                    <Text style={styles.blockText}>{rankLabel(entry.rank)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          {view.mine !== null && <Text style={styles.mine}>Toi : {view.mine}</Text>}
          {view.all.length > 3 &&
            (unfolded ? (
              view.all.map((entry) => (
                <View key={entry.player.code} style={styles.rank}>
                  <Text style={styles.rankNumber}>{rankLabel(entry.rank)}</Text>
                  <Text style={[styles.rankName, entry.self && styles.rankSelf]} numberOfLines={1}>
                    {entry.self ? "Toi" : playerName(entry.player)}
                  </Text>
                  <Text style={styles.small}>{answersLabel(entry.answers)}</Text>
                </View>
              ))
            ) : (
              <TextButton label="Tout le classement" onPress={() => setUnfolded(true)} />
            ))}
        </>
      )}
    </Panel>
  );
}

/** What the panels hold is read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s4,
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  small: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInkMuted,
  },
  steps: { flexDirection: "row", alignItems: "flex-end", gap: space.s4, marginTop: space.s3 },
  step: { flex: 1, alignItems: "center", gap: space.s2 },
  stepName: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
  stepAnswers: { fontFamily: fonts.display, fontSize: fontSizes.subtitle, color: ink.rubric },
  block: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    backgroundColor: ink.pageRaised,
  },
  blockSelf: { backgroundColor: alpha(ink.gilt, 0.22) },
  blockText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: ink.pageInk },
  mine: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: ink.pageInk,
    textAlign: "center",
  },
  rank: { flexDirection: "row", alignItems: "center", gap: space.s5, minHeight: 30 },
  rankNumber: {
    width: 36,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  rankName: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: ink.pageInk,
  },
  rankSelf: { color: ink.rubric },
});
