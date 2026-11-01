import {
  levelDetail,
  type PlateauLayout,
  plateauLayout,
  type Quarter,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  type RoadNode,
  roadSubtitle,
  waitingCoffrets,
  xpSources,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { openCoffret } from "@/levels/coffret";
import { REWARD_ICONS } from "@/levels/reward-icons";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { levelRewards, progress as progressResource } from "@/player/state";
import { alpha, colors, fontSizes, fonts, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import {
  FogBank,
  MARK_COLORS,
  PlateauDecor,
  TILE_BOX,
  TileBlock,
  TileHalo,
  type TileLook,
} from "./plateau-art";

/** Quarters the player may look at beyond their own. */
const QUARTERS_AHEAD = 2;
const MEDAL = 46;

/** The level road, ten levels at a time: tiles climbing a plateau, the fog ahead. */
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
  const layout = plateauLayout(
    nodes.map((n) => n.level),
    progress.level,
  );
  const chosen = selected ?? waitingCoffrets(progress.level, claimed)[0] ?? progress.level + 1;
  const detail = levelDetail(chosen, progress, claimed, now);

  const pick = (node: RoadNode) => {
    setSelected(node.level);
    if (node.state === "claimable") openCoffret(node.level);
  };

  return (
    <Page title="Niveaux">
      <Paragraph muted>{roadSubtitle(progress)}</Paragraph>

      <View style={styles.board}>
        <View style={styles.boardHead}>
          <Pressable
            style={[styles.round, quarter.index === 1 && styles.dim]}
            disabled={quarter.index === 1}
            onPress={() => setShown(quarter.index - 1)}
            accessibilityRole="button"
            accessibilityLabel="Quartier précédent"
          >
            <Icon name="back" size={18} color={colors.pageInk} />
          </Pressable>
          <View style={styles.quarterName} accessibilityLiveRegion="polite">
            <Text style={styles.quarterRange}>{quarter.range.toUpperCase()}</Text>
            <Text style={styles.quarterTitle}>{quarter.name}</Text>
          </View>
          <Pressable
            style={[styles.round, quarter.index >= last && styles.dim]}
            disabled={quarter.index >= last}
            onPress={() => setShown(quarter.index + 1)}
            accessibilityRole="button"
            accessibilityLabel="Quartier suivant"
          >
            <Icon name="chev" size={18} color={colors.pageInk} />
          </Pressable>
        </View>
        <Plateau
          nodes={nodes}
          layout={layout}
          level={progress.level}
          chosen={chosen}
          onPick={pick}
        />
      </View>

      <Panel accessibilityLiveRegion="polite">
        <Text style={styles.kicker}>NIVEAU {detail.level}</Text>
        <Text style={styles.detailTitle}>{detail.title}</Text>
        <View style={styles.items}>
          {detail.items.map((item) => (
            <View key={item.title} style={styles.item}>
              <View style={styles.itemIcon}>
                <Icon name={REWARD_ICONS[item.icon]} size={22} color={colors.rubric} />
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
            <Text style={[styles.kicker, styles.opensKicker]}>OUVRE</Text>
            <Text style={styles.opensText}>{detail.opens}</Text>
          </View>
        )}
        {detail.state === "claimable" && (
          <Button label="Ouvrir le coffret" onPress={() => openCoffret(detail.level)} />
        )}
        {detail.state === "claimed" && (
          <View style={styles.done}>
            <Icon name="check" size={18} color={colors.success} />
            <Text style={styles.doneText}>Coffret ouvert</Text>
          </View>
        )}
        {detail.xpLeft !== null && <Text style={styles.left}>{detail.xpLeft}</Text>}
      </Panel>

      <Quarters own={own} last={last} shown={quarter} onShow={setShown} />

      <Panel>
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

function tileLook(node: RoadNode): TileLook {
  if (node.state === "claimed" || node.state === "claimable") return "gold";
  if (node.milestone) return "kraft";
  return node.state === "next" ? "cream" : "slate";
}

function Plateau({
  nodes,
  layout,
  level,
  chosen,
  onPick,
}: {
  readonly nodes: readonly RoadNode[];
  readonly layout: PlateauLayout;
  readonly level: number;
  readonly chosen: number;
  readonly onPick: (node: RoadNode) => void;
}) {
  const [width, setWidth] = useState(0);
  const scale = width / layout.width;
  const { tile } = layout;
  const fogged = layout.points.filter((_, index) => nodes[index]?.fog === true);
  // The fog reaches down to the lowest tile it hides.
  const fogLine = fogged.length === 0 ? null : Math.max(...fogged.map((p) => p.y)) + tile.height;
  const here = layout.points.find((p) => p.level === level);
  const tileWidth = TILE_BOX.width * scale;
  return (
    <View
      style={[styles.plateau, { aspectRatio: layout.width / layout.height }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          <PlateauDecor layout={layout} width={width} />
          {/* Highest first: a tile lower on the screen stands in front of the ones above it. */}
          {[...nodes].reverse().map((node) => {
            const point = layout.points.find((p) => p.level === node.level);
            if (point === undefined) return null;
            const look = tileLook(node);
            return (
              <Pressable
                key={node.level}
                onPress={() => onPick(node)}
                accessibilityRole="button"
                accessibilityLabel={node.label}
                accessibilityState={{ selected: node.level === chosen }}
                style={[
                  styles.tile,
                  {
                    left: (point.x - tile.width / 2) * scale,
                    top: (point.y - tile.height / 2) * scale,
                    width: tileWidth,
                    height: (TILE_BOX.height * tileWidth) / TILE_BOX.width,
                  },
                  node.fog && styles.fog,
                ]}
              >
                {node.state === "claimable" && <Halo width={tileWidth} />}
                <TileBlock look={look} selected={node.level === chosen} width={tileWidth} />
                <View style={styles.tileFace} pointerEvents="none">
                  <TileMark
                    node={node}
                    last={node === nodes[nodes.length - 1]}
                    color={MARK_COLORS[look]}
                    size={Math.max(13, Math.round(tileWidth * 0.26))}
                  />
                </View>
              </Pressable>
            );
          })}
          {fogLine !== null && <FogBank width={width} height={fogLine * scale} />}
          {here !== undefined && (
            <Here
              left={here.x * scale - MEDAL / 2}
              top={(here.y - tile.height / 2) * scale - MEDAL * 0.78}
              level={level}
            />
          )}
        </>
      )}
    </View>
  );
}

/** A coffret waits on this tile: its halo breathes. */
function Halo({ width }: { readonly width: number }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.6);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0.5, { duration: 900 })),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: -width * 0.2, top: -width * 0.12 }, style]}
    >
      <TileHalo width={width * 1.4} />
    </Animated.View>
  );
}

/** The player's medal, standing on their level. */
function Here({
  left,
  top,
  level,
}: {
  readonly left: number;
  readonly top: number;
  readonly level: number;
}) {
  const reduced = useReducedMotion();
  const hover = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    hover.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(hover);
  }, [reduced, hover]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * hover.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.here, { left, top }, style]}>
      <LevelMedal level={level} size={MEDAL} />
    </Animated.View>
  );
}

function TileMark({
  node,
  last,
  color,
  size,
}: {
  readonly node: RoadNode;
  readonly last: boolean;
  readonly color: string;
  readonly size: number;
}) {
  if (node.state === "claimed") return <Icon name="check" size={size + 2} color={color} />;
  if (node.state === "claimable" || last)
    return <Icon name="coffret" size={size + 2} color={color} />;
  return <Text style={[styles.mark, { color, fontSize: size }]}>{node.level}</Text>;
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
    <Panel style={styles.quarters}>
      <Text style={[styles.kicker, styles.quartersKicker]}>LES QUARTIERS</Text>
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

const styles = StyleSheet.create({
  board: {
    marginHorizontal: -12,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: colors.binding,
  },
  boardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s5,
    paddingHorizontal: space.s7,
    paddingTop: space.s7,
    zIndex: 3,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pageRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  dim: { opacity: 0.35 },
  quarterName: { flex: 1, alignItems: "center" },
  quarterRange: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    letterSpacing: 1.3,
    color: colors.pageInkFaint,
  },
  quarterTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    color: colors.pageInk,
    textAlign: "center",
  },
  plateau: { width: "100%", marginBottom: space.s4 },
  tile: { position: "absolute" },
  fog: { opacity: 0.55 },
  tileFace: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "70%",
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { fontFamily: fonts.display, includeFontPadding: false },
  here: { position: "absolute" },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: colors.pageInkMuted,
  },
  detailTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 30,
    color: colors.pageInk,
  },
  items: { gap: space.s5 },
  item: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: colors.page,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1 },
  itemTitle: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.pageInk },
  itemDetail: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: colors.pageInkMuted,
  },
  opensBox: {
    paddingHorizontal: space.s7,
    paddingVertical: space.s6,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: alpha(colors.kraft, 0.4),
    backgroundColor: alpha(colors.kraft, 0.16),
  },
  opensKicker: { color: colors.kraft },
  opensText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: colors.pageInk,
    marginTop: space.s1,
  },
  done: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  doneText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.success },
  left: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.pageInkMuted },
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
  quarterOn: { backgroundColor: colors.pageRaised },
  quarterMark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  quarterDone: { backgroundColor: colors.action },
  quarterHere: { backgroundColor: colors.badge },
  quarterAhead: { backgroundColor: colors.binding },
  quarterIndex: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: colors.pageInkFaint,
  },
  quarterIndexHere: { color: colors.inkOnColor },
  quarterLabel: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: colors.pageInk,
  },
  quarterLevels: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: colors.pageInkFaint,
  },
  source: { flexDirection: "row", justifyContent: "space-between", gap: space.s6 },
  sourceAction: {
    flex: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: colors.pageInkMuted,
  },
  sourceXp: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: colors.pageInk },
});
