import type { Progress } from "@leximon/contract";
import {
  levelDetail,
  type Quarter,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  type RoadNode,
  roadSubtitle,
  waitingCoffrets,
  xpSources,
} from "@leximon/view-model";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { openCoffret } from "@/levels/coffret";
import { REWARD_ICONS } from "@/levels/reward-icons";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { levelRewards, progress as progressResource } from "@/player/state";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Toy } from "@/ui/toy";

/** Quarters the player may look at beyond their own. */
const QUARTERS_AHEAD = 2;

/** The levels, ten at a time: a page of contents, each line a level and what it gives. */
export function LevelRoadScreen({ asked }: { readonly asked: number | null }) {
  const progress = useShared(progressResource);
  const rewards = useShared(levelRewards);
  const progressFailed = useSharedFailed(progressResource);
  const rewardsFailed = useSharedFailed(levelRewards);
  const now = useNow(60_000);
  const [selected, setSelected] = useState<number | null>(asked);
  const [shown, setShown] = useState<number | null>(
    asked === null ? null : quarterOfLevel(asked).index,
  );

  if (progress === null || rewards === null) {
    const failed = (progress === null && progressFailed) || (rewards === null && rewardsFailed);
    return (
      <Page title="Niveaux">
        {failed ? (
          <>
            <Paragraph muted>Les niveaux n'ont pas pu être chargés. Réessaie.</Paragraph>
            <Button
              label="Réessayer"
              secondary
              onPress={() => {
                progressResource.refresh();
                levelRewards.refresh();
              }}
            />
          </>
        ) : (
          <Paragraph muted>Un instant…</Paragraph>
        )}
      </Page>
    );
  }

  const { claimed } = rewards;
  const own = quarterOfLevel(progress.level);
  const last = own.index + QUARTERS_AHEAD;
  const quarter = quarterAt(Math.min(last, shown ?? own.index));
  const nodes = quarterNodes(quarter, progress.level, claimed, now);
  const chosen = selected ?? waitingCoffrets(progress.level, claimed)[0] ?? progress.level + 1;
  const detail = levelDetail(chosen, progress, claimed, now);

  const pick = (node: RoadNode) => {
    setSelected(node.level);
    if (node.state === "claimable") openCoffret(node.level);
  };

  return (
    <Page title="Niveaux">
      <Paragraph muted>{roadSubtitle(progress)}</Paragraph>

      <Panel paper style={styles.folio}>
        <View style={styles.folioHead}>
          <Turn
            icon="back"
            label="Chapitre précédent"
            disabled={quarter.index === 1}
            onPress={() => setShown(quarter.index - 1)}
          />
          <View style={styles.quarterName} accessibilityLiveRegion="polite">
            <Text style={styles.quarterRange} numberOfLines={1} adjustsFontSizeToFit>
              {`${quarter.chapter} · ${quarter.range}`.toUpperCase()}
            </Text>
            <Text style={styles.quarterTitle}>{quarter.name}</Text>
          </View>
          <Turn
            icon="chev"
            label="Chapitre suivant"
            disabled={quarter.index >= last}
            onPress={() => setShown(quarter.index + 1)}
          />
        </View>
        <View>
          {nodes.map((node) => (
            <Line
              key={node.level}
              node={node}
              progress={progress}
              chosen={node.level === chosen}
              onPick={() => pick(node)}
            />
          ))}
        </View>
      </Panel>

      <Panel paper accessibilityLiveRegion="polite">
        <Text style={styles.kicker}>NIVEAU {detail.level}</Text>
        <Text style={styles.detailTitle}>{detail.title}</Text>
        <View style={styles.items}>
          {detail.items.map((item) => (
            <View key={item.title} style={styles.item}>
              <View style={styles.itemIcon}>
                <Icon name={REWARD_ICONS[item.icon]} size={22} color={ink.rubric} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
        {detail.opens !== null && (
          <View style={styles.opensBox}>
            <Text style={[styles.kicker, styles.opensKicker]}>DÉBLOQUE</Text>
            <Text style={styles.opensText}>{detail.opens}</Text>
          </View>
        )}
        {detail.state === "claimable" && (
          <Button label="Ouvrir le coffret" onPress={() => openCoffret(detail.level)} />
        )}
        {detail.state === "claimed" && (
          <View style={styles.done}>
            <Icon name="check" size={18} color={ink.success} />
            <Text style={styles.doneText}>Coffret ouvert</Text>
          </View>
        )}
        {detail.xpLeft !== null && <Text style={styles.left}>{detail.xpLeft}</Text>}
      </Panel>

      <Quarters own={own} last={last} shown={quarter} onShow={setShown} />

      <Panel paper>
        <Text style={styles.kicker}>D'OÙ VIENT L'XP</Text>
        {xpSources(now).map((source) => (
          <View key={source.action} style={styles.source}>
            <Text style={styles.sourceAction}>{source.action}</Text>
            <Text style={styles.sourceXp}>{source.xp}</Text>
          </View>
        ))}
      </Panel>
    </Page>
  );
}

/** Turns the page of contents to the chapter before or after. */
function Turn({
  icon,
  label,
  disabled,
  onPress,
}: {
  readonly icon: "back" | "chev";
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Toy
      matter="paper"
      shape="round"
      style={styles.turnToy}
      bodyStyle={styles.turnBody}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={ink.pageInk} />
    </Toy>
  );
}

/** A line of the contents: what the level gives, then its number across the dots. */
function Line({
  node,
  progress,
  chosen,
  onPick,
}: {
  readonly node: RoadNode;
  readonly progress: Progress;
  readonly chosen: boolean;
  readonly onPick: () => void;
}) {
  const near = node.state === "next" || node.state === "claimable";
  const strong = near || node.milestone;
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={node.label}
      accessibilityState={{ selected: chosen }}
      style={({ pressed }) => [styles.line, (chosen || pressed) && styles.lineOn]}
    >
      <View style={styles.lineMark}>
        <LineMark node={node} level={progress.level} />
      </View>
      <View style={styles.lineText}>
        <Text style={[styles.lineTitle, near && styles.lineNear, strong && styles.lineStrong]}>
          {node.summary}
        </Text>
        {node.opensLine !== null && <Text style={styles.lineOpens}>{node.opensLine}</Text>}
        {node.state === "next" && (
          <View style={styles.lineBar}>
            <XpBar thin ratio={progress.xpIntoLevel / progress.xpForNextLevel} />
          </View>
        )}
      </View>
      <Text style={styles.leader} numberOfLines={1} ellipsizeMode="clip" aria-hidden>
        {LEADER}
      </Text>
      {node.state === "claimable" && <Text style={styles.toOpen}>À ouvrir</Text>}
      <Text
        style={[styles.lineLevel, near && styles.lineNear, node.milestone && styles.lineMilestone]}
      >
        {node.level}
      </Text>
    </Pressable>
  );
}

/** The dots of a table of contents, cut where the number begins. */
const LEADER = " ·".repeat(80);

function LineMark({ node, level }: { readonly node: RoadNode; readonly level: number }) {
  if (node.level === level) return <LevelMedal level={level} size={34} />;
  if (node.state === "claimed") return <Icon name="check" size={18} color={ink.gilt} />;
  if (node.state === "claimable") return <Icon name="coffret" size={20} color={ink.gilt} />;
  return null;
}

function Quarters({
  own,
  last,
  shown,
  onShow,
}: {
  readonly own: Quarter;
  readonly last: number;
  readonly shown: Quarter;
  readonly onShow: (index: number) => void;
}) {
  const quarters = Array.from({ length: last }, (_, k) => quarterAt(k + 1));
  return (
    <Panel paper style={styles.quarters}>
      <Text style={[styles.kicker, styles.quartersKicker]}>LES CHAPITRES</Text>
      {quarters.map((q) => {
        const done = q.index < own.index;
        const current = q.index === own.index;
        return (
          <Pressable
            key={q.index}
            onPress={() => onShow(q.index)}
            accessibilityRole="button"
            accessibilityState={{ selected: q.index === shown.index }}
            style={[styles.quarter, q.index === shown.index && styles.quarterOn]}
          >
            <View
              style={[
                styles.quarterMark,
                done ? styles.quarterDone : current ? styles.quarterHere : styles.quarterAhead,
              ]}
            >
              {done ? (
                <Icon name="check" size={14} color={colors.actionInk} />
              ) : (
                <Text style={[styles.quarterIndex, current && styles.quarterIndexHere]}>
                  {q.index}
                </Text>
              )}
            </View>
            <Text style={styles.quarterLabel} numberOfLines={1}>
              {q.name}
            </Text>
            <Text style={styles.quarterLevels}>
              {q.first} à {q.last}
            </Text>
          </Pressable>
        );
      })}
    </Panel>
  );
}

/** Every panel of the screen is a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  folio: { gap: space.s4 },
  folioHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s5,
    paddingBottom: space.s7,
    borderBottomWidth: 1,
    borderBottomColor: ink.rule,
  },
  turnToy: { width: 40, height: 40 },
  turnBody: { alignItems: "center", justifyContent: "center" },
  quarterName: { flex: 1, alignItems: "center" },
  quarterRange: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    letterSpacing: 1.3,
    color: ink.rubric,
    textAlign: "center",
  },
  quarterTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    lineHeight: 28,
    color: ink.pageInk,
    textAlign: "center",
    marginTop: space.s1,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    minHeight: 54,
    paddingVertical: 6,
    paddingHorizontal: space.s3,
    marginHorizontal: -space.s3,
    borderRadius: radii.sm,
  },
  lineOn: { backgroundColor: alpha(ink.pageInk, 0.07) },
  lineMark: { width: 34, alignItems: "center", justifyContent: "center" },
  lineText: { flexShrink: 1, gap: 1 },
  lineTitle: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  lineNear: { color: ink.pageInk },
  lineStrong: { fontFamily: fonts.text.medium },
  lineOpens: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    lineHeight: 17,
    color: ink.rubric,
  },
  lineBar: { width: 130, marginTop: 5 },
  leader: {
    flex: 1,
    minWidth: 16,
    alignSelf: "flex-end",
    marginBottom: 14,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: ink.pageInkFaint,
  },
  toOpen: {
    overflow: "hidden",
    paddingHorizontal: space.s4,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.action,
    color: colors.actionInk,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
  },
  lineLevel: {
    minWidth: 26,
    fontFamily: fonts.display,
    fontSize: fontSizes.titleSmall,
    color: ink.pageInkMuted,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  lineMilestone: { color: ink.rubric },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  detailTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 30,
    color: ink.pageInk,
  },
  items: { gap: space.s5 },
  item: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: ink.pageRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1 },
  itemTitle: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  itemDetail: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  opensBox: {
    paddingHorizontal: space.s7,
    paddingVertical: space.s6,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: alpha(colors.kraft, 0.4),
    backgroundColor: alpha(colors.kraft, 0.16),
  },
  opensKicker: { color: ink.rubric },
  opensText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: ink.pageInk,
    marginTop: space.s1,
  },
  done: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  doneText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.success },
  left: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInkMuted },
  quarters: { gap: space.s1, paddingHorizontal: space.s5 },
  quartersKicker: { paddingHorizontal: space.s3, marginBottom: space.s3 },
  quarter: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    minHeight: 44,
    paddingHorizontal: space.s4,
    borderRadius: 14,
  },
  quarterOn: { backgroundColor: ink.pageRaised },
  quarterMark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  quarterDone: { backgroundColor: colors.action },
  quarterHere: { backgroundColor: colors.badge },
  quarterAhead: { backgroundColor: ink.track },
  quarterIndex: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: ink.pageInkFaint,
  },
  quarterIndexHere: { color: colors.inkOnColor },
  quarterLabel: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: ink.pageInk,
  },
  quarterLevels: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: ink.pageInkFaint,
  },
  source: { flexDirection: "row", justifyContent: "space-between", gap: space.s6 },
  sourceAction: {
    flex: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: ink.pageInkMuted,
  },
  sourceXp: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: ink.pageInk },
});
