import type { Progress } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  levelDetail,
  playerTitle,
  type Quarter,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  ROAD_ROW,
  type RoadNode,
  roadGeometry,
  unlocksAhead,
  upcomingRewards,
  waitingCoffrets,
  XP_SOURCES_TITLE,
  xpProgressLabel,
  xpSources,
  xpToNextLabel,
} from "@leximon/view-model";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Polygon } from "react-native-svg";
import { openCoffret } from "@/levels/coffret";
import { RewardToy } from "@/levels/reward-toy";
import { MainAction } from "@/library/play-pieces";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { levelRewards, progress as progressResource } from "@/player/state";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";
import { Page, Paragraph } from "@/ui/page";
import { Leaf, Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";

/** Chapters the player may look at beyond their own. */
const QUARTERS_AHEAD = 2;

/** Every leaf of the screen is paper. */
const ink = paperColors;

/** The levels as a road that winds down the page, a chapter of ten at a time. */
export function LevelRoadScreen({ asked }: { readonly asked: number | null }) {
  const progress = useShared(progressResource);
  const rewards = useShared(levelRewards);
  const progressFailed = useSharedFailed(progressResource);
  const rewardsFailed = useSharedFailed(levelRewards);
  const now = useNow(60_000);
  // The detail of a level opens in a bubble under its stop, only when asked.
  const [bubble, setBubble] = useState<number | null>(asked);
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

  const pick = (node: RoadNode) => {
    if (node.state === "claimable") {
      setBubble(null);
      openCoffret(node.level);
    } else {
      setBubble((open) => (open === node.level ? null : node.level));
    }
  };

  return (
    <Page title="Niveaux">
      <Hero progress={progress} claimed={claimed} now={now} />
      <Leaf style={styles.roadLeaf}>
        <ChapterTabs
          own={own}
          last={last}
          shown={quarter}
          onShow={(index) => {
            setShown(index);
            setBubble(null);
          }}
        />
        <Banner quarter={quarter} />
        <Road
          nodes={nodes}
          progress={progress}
          claimed={claimed}
          now={now}
          bubble={bubble}
          onPick={pick}
        />
      </Leaf>
      <Unlocks level={progress.level} now={now} />
    </Page>
  );
}

/** A chest that waits gives a little hop now and then, to be opened. */
function Hop({ children }: { readonly children: ReactNode }) {
  const reduced = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    lift.value = withRepeat(
      withSequence(
        withDelay(1700, withTiming(1, { duration: 190 })),
        withTiming(-0.5, { duration: 190 }),
        withTiming(0.35, { duration: 140 }),
        withTiming(0, { duration: 180 }),
      ),
      -1,
    );
  }, [reduced, lift]);
  const hop = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, lift.value) * 8 }, { rotate: `${-lift.value * 6}deg` }],
  }));
  return <Animated.View style={hop}>{children}</Animated.View>;
}

/** An arc that fills as the XP of the level comes, round a medal or a stop. */
function XpRing({
  size,
  ratio,
  width,
  track,
}: {
  readonly size: number;
  readonly ratio: number;
  readonly width: number;
  readonly track: string;
}) {
  const r = (size - width) / 2;
  const length = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={width} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.successDeep}
        strokeWidth={width}
        fill="none"
        strokeDasharray={`${length * Math.min(1, ratio)} ${length}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** The player's level in big, the bar to the next one, and the coffrets that wait. */
function Hero({
  progress,
  claimed,
  now,
}: {
  readonly progress: Progress;
  readonly claimed: readonly number[];
  readonly now: number;
}) {
  const [helping, setHelping] = useState(false);
  const title = playerTitle(claimed, now);
  const coffrets = waitingCoffrets(progress.level, claimed).length;
  const [next] = upcomingRewards(progress.level, now, 1);
  const ratio = Math.min(1, progress.xpIntoLevel / progress.xpForNextLevel);
  return (
    <Leaf style={styles.hero}>
      <View style={styles.heroRow}>
        <View style={styles.ring}>
          <XpRing size={88} ratio={ratio} width={10} track={alpha(toyValues.outline, 0.15)} />
          <LevelMedal level={progress.level} size={66} />
        </View>
        <View style={styles.heroText}>
          {title !== null && <Text style={styles.kicker}>{title.toUpperCase()}</Text>}
          <Text style={styles.heroTitle}>Niveau {progress.level}</Text>
          <View style={styles.heroBar}>
            <View style={[styles.heroFill, { width: `${Math.round(ratio * 100)}%` }]} />
            <View style={styles.heroBarLabel}>
              <Lettering size={12} font={fonts.ui.extrabold}>
                {xpProgressLabel(progress)}
              </Lettering>
            </View>
          </View>
          <View style={styles.heroNext}>
            <Text style={styles.heroNextText}>{xpToNextLabel(progress)}</Text>
            <Pressable
              onPress={() => setHelping((was) => !was)}
              hitSlop={10}
              style={[styles.help, helping && styles.helpOn]}
              accessibilityRole="button"
              accessibilityLabel={XP_SOURCES_TITLE}
              accessibilityState={{ expanded: helping }}
            >
              <Icon name="help" size={18} color={ink.pageInkMuted} />
            </Pressable>
          </View>
        </View>
      </View>
      {helping && (
        <View style={styles.xpBox}>
          <Text style={styles.xpTitle}>{XP_SOURCES_TITLE}</Text>
          {xpSources(now).map((source) => (
            <View key={source.action} style={styles.xpLine}>
              <ToyIcon name={source.icon} size={26} />
              <Text style={styles.xpAction}>{source.action}</Text>
              <Text style={styles.xpFigure}>{source.xp} XP</Text>
            </View>
          ))}
        </View>
      )}
      {coffrets > 0 ? (
        <MainAction
          label="Ouvrir un coffret"
          count={String(coffrets)}
          onPress={() => openCoffret()}
        />
      ) : (
        next !== undefined && (
          <View style={styles.coming}>
            <RewardToy icon={next.icon} size={44} />
            <View style={styles.comingText}>
              <Text style={styles.kicker}>AU NIVEAU {next.level}</Text>
              <Text style={styles.comingTitle}>{next.opens ?? next.title}</Text>
            </View>
          </View>
        )
      )}
    </Leaf>
  );
}

/** The player's chapter, those before it and two after it. */
function ChapterTabs({
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Chapitres"
      contentContainerStyle={styles.tabs}
    >
      {quarters.map((quarter) => (
        <Toy
          key={quarter.index}
          matter={
            quarter.index === shown.index ? "gold" : quarter.index > own.index ? "locked" : "paper"
          }
          style={styles.tab}
          bodyStyle={styles.tabBody}
          accessibilityRole="button"
          accessibilityState={{ selected: quarter.index === shown.index }}
          onPress={() => onShow(quarter.index)}
        >
          {quarter.index < own.index && <Icon name="check" size={14} color={toyValues.outline} />}
          {quarter.index > own.index && <Icon name="lock" size={14} color={toyValues.outline} />}
          <Text style={styles.tabText}>{quarter.name}</Text>
        </Toy>
      ))}
    </ScrollView>
  );
}

/** The chapter's name on a red ribbon, its two tails folded behind. */
function Banner({ quarter }: { readonly quarter: Quarter }) {
  return (
    <View style={styles.banner}>
      <View style={styles.ribbonWrap}>
        <Svg width={40} height={34} style={[styles.tail, styles.tailLeft]}>
          <Polygon
            points="2,2 38,2 38,32 2,32 16,17"
            fill={toyMatters.red.edge}
            stroke={toyValues.outline}
            strokeWidth={toyValues.outlineWidth}
            strokeLinejoin="round"
          />
        </Svg>
        <Svg width={40} height={34} style={[styles.tail, styles.tailRight]}>
          <Polygon
            points="2,2 38,2 24,17 38,32 2,32"
            fill={toyMatters.red.edge}
            stroke={toyValues.outline}
            strokeWidth={toyValues.outlineWidth}
            strokeLinejoin="round"
          />
        </Svg>
        <ToyBody matter="red" style={styles.ribbon}>
          <Lettering size={fontSizes.title}>{quarter.name}</Lettering>
        </ToyBody>
      </View>
      <Text style={styles.range}>{`${quarter.chapter} · ${quarter.range}`.toUpperCase()}</Text>
    </View>
  );
}

/** The stop's token is laid in a square this wide, centred on the road. */
const STOP_BOX = 84;

function Road({
  nodes,
  progress,
  claimed,
  now,
  bubble,
  onPick,
}: {
  readonly nodes: readonly RoadNode[];
  readonly progress: Progress;
  readonly claimed: readonly number[];
  readonly now: number;
  readonly bubble: number | null;
  readonly onPick: (node: RoadNode) => void;
}) {
  const [width, setWidth] = useState(0);
  const reached = nodes.filter((node) => node.level <= progress.level).length;
  const road = roadGeometry(nodes.length, reached, width);
  const open = nodes.findIndex((node) => node.level === bubble);
  // Near the end of the road the bubble opens above its stop, to stay on the leaf.
  const above = open >= nodes.length - 3;
  return (
    <View
      style={{ height: road.height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={road.height} style={StyleSheet.absoluteFill}>
            <Path
              d={road.ahead}
              fill="none"
              stroke={alpha(toyValues.outline, 0.28)}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray="2 16"
            />
            {road.done !== "" && (
              <>
                <Path
                  d={road.done}
                  fill="none"
                  stroke={toyValues.outline}
                  strokeWidth={12}
                  strokeLinecap="round"
                  transform="translate(0 3)"
                />
                <Path
                  d={road.done}
                  fill="none"
                  stroke={toyMatters.gold.top}
                  strokeWidth={12}
                  strokeLinecap="round"
                />
              </>
            )}
          </Svg>
          {nodes.map((node, k) => {
            const stop = road.stops[k];
            if (stop === undefined) return null;
            const room = stop.side === "right" ? width - stop.x - 50 : stop.x - 50;
            return (
              <View key={node.level} style={[styles.stop, { top: k * ROAD_ROW }]}>
                <View
                  style={[
                    styles.tagWrap,
                    { maxWidth: room },
                    stop.side === "right" ? { left: stop.x + 44 } : { right: width - stop.x + 44 },
                  ]}
                  pointerEvents="none"
                >
                  <View
                    style={[
                      styles.tag,
                      node.milestone && styles.tagMilestone,
                      node.level === bubble && styles.tagChosen,
                    ]}
                  >
                    <RewardToy icon={node.icon} size={24} dim={node.fog} />
                    <Text
                      style={[styles.tagText, node.state === "locked" && styles.tagFar]}
                      numberOfLines={2}
                    >
                      {node.tag}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => onPick(node)}
                  accessibilityRole="button"
                  accessibilityLabel={node.label}
                  accessibilityState={{ expanded: node.level === bubble }}
                  style={[styles.stopButton, { left: stop.x - STOP_BOX / 2 }]}
                >
                  <StopToken node={node} progress={progress} />
                </Pressable>
              </View>
            );
          })}
          {bubble !== null && open !== -1 && (
            <View
              style={[
                styles.bubble,
                above
                  ? { bottom: (nodes.length - open) * ROAD_ROW - 6 }
                  : { top: (open + 1) * ROAD_ROW - 6 },
              ]}
            >
              <View
                style={[
                  styles.arrow,
                  { left: (road.stops[open]?.x ?? width / 2) - 10 },
                  above ? styles.arrowBelow : styles.arrowAbove,
                ]}
              />
              <Detail level={bubble} progress={progress} claimed={claimed} now={now} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function StopToken({ node, progress }: { readonly node: RoadNode; readonly progress: Progress }) {
  if (node.level === progress.level) {
    return (
      <View style={styles.here}>
        <LevelMedal level={node.level} size={node.milestone ? 76 : 68} />
        {node.state === "claimable" && (
          <View style={styles.hereChest}>
            <Hop>
              <ToyIcon name="chest" size={32} />
            </Hop>
          </View>
        )}
      </View>
    );
  }
  if (node.state === "claimable") {
    return (
      <Hop>
        <ToyIcon name="chest" size={node.milestone ? 64 : 54} />
        <ToyBody matter="red" shape="tag" style={styles.chestNumber}>
          <Lettering size={13}>{node.level}</Lettering>
        </ToyBody>
      </Hop>
    );
  }
  const size = node.milestone ? 62 : 52;
  return (
    <View>
      {node.state === "next" && (
        <View style={[styles.discRing, { width: size + 18, height: size + 18 }]}>
          <XpRing
            size={size + 18}
            ratio={progress.xpIntoLevel / progress.xpForNextLevel}
            width={5}
            track="transparent"
          />
        </View>
      )}
      <ToyBody
        matter={node.state === "claimed" ? "gold" : node.state === "next" ? "paper" : "locked"}
        shape="round"
        style={[styles.disc, { width: size, height: size }]}
      >
        <Lettering size={node.milestone ? 24 : 20}>{node.level}</Lettering>
      </ToyBody>
      {node.state === "claimed" && (
        <View style={styles.tick}>
          <Icon name="check" size={12} color={colors.paper} />
        </View>
      )}
    </View>
  );
}

/** What a level gives, as toys with their words, and its button when its coffret waits. */
function Detail({
  level,
  progress,
  claimed,
  now,
}: {
  readonly level: number;
  readonly progress: Progress;
  readonly claimed: readonly number[];
  readonly now: number;
}) {
  const detail = levelDetail(level, progress, claimed, now);
  return (
    <Leaf style={styles.detail}>
      <View accessibilityLiveRegion="polite" style={styles.detailInside}>
        <Text style={styles.kicker}>NIVEAU {detail.level}</Text>
        <Text style={styles.detailTitle}>{detail.title}</Text>
        {detail.items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list; two rewards may be alike
          <View key={`${item.title}-${index}`} style={styles.item}>
            <RewardToy icon={item.icon} size={38} dim={detail.state === "locked"} />
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}
        {detail.opens !== null && (
          <View style={styles.opens}>
            <ToyIcon name="lock" size={28} />
            <Text style={styles.opensText}>Débloque {detail.opens.toLowerCase()}</Text>
          </View>
        )}
        {detail.state === "claimable" && (
          <MainAction label="Ouvrir le coffret" onPress={() => openCoffret(detail.level)} />
        )}
        {detail.state === "claimed" && (
          <View style={styles.done}>
            <Icon name="check" size={18} color={ink.success} />
            <Text style={styles.doneText}>Coffret ouvert</Text>
          </View>
        )}
        {detail.xpLeft !== null && <Text style={styles.left}>{detail.xpLeft}</Text>}
      </View>
    </Leaf>
  );
}

/** The parts of the game still closed, each with the level that opens it. */
function Unlocks({ level, now }: { readonly level: number; readonly now: number }) {
  const ahead = unlocksAhead(level, now);
  if (ahead.length === 0) return null;
  return (
    <Leaf style={styles.unlocks}>
      <Text style={styles.kicker}>À DÉBLOQUER</Text>
      {ahead.map((unlock) => (
        <View key={unlock.level} style={styles.unlock}>
          <View>
            <ToyIcon name="lock" size={36} />
            <ToyBody matter="dark" shape="tag" style={styles.unlockLevel}>
              <Lettering size={12}>{unlock.level}</Lettering>
            </ToyBody>
          </View>
          <View style={styles.unlockText}>
            <Text style={styles.unlockName}>{unlock.text}</Text>
            <Text style={styles.unlockAt}>Au niveau {unlock.level}</Text>
          </View>
        </View>
      ))}
    </Leaf>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    letterSpacing: 1.6,
    color: ink.pageInkMuted,
  },
  hero: { gap: space.s7, padding: space.s7 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: space.s7 },
  ring: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    backgroundColor: colors.paper,
    boxShadow: `0 0 0 ${toyValues.outlineWidth}px ${toyValues.outline}, 0 4px 0 ${toyValues.outlineWidth}px ${toyValues.outline}`,
  },
  heroText: { flex: 1, gap: space.s2 },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 30,
    color: ink.pageInk,
  },
  heroBar: {
    height: 24,
    overflow: "hidden",
    justifyContent: "center",
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundColor: alpha(toyValues.outline, 0.14),
  },
  heroFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.green.top,
    borderBottomWidth: 8,
    borderBottomColor: toyMatters.green.bottom,
  },
  heroBarLabel: { alignItems: "center" },
  heroNext: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  heroNextText: {
    flexShrink: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  help: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  helpOn: { backgroundColor: ink.pageRaised },
  xpBox: {
    gap: space.s4,
    padding: space.s6,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: ink.track,
  },
  xpTitle: { fontFamily: fonts.display, fontSize: fontSizes.label, color: ink.pageInk },
  xpLine: { flexDirection: "row", alignItems: "center", gap: space.s5 },
  xpAction: { flex: 1, fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInk },
  xpFigure: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.success },
  coming: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    padding: space.s5,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: alpha(toyValues.outline, 0.35),
    borderRadius: radii.xl,
  },
  comingText: { flex: 1, gap: 2 },
  comingTitle: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  roadLeaf: { paddingTop: space.s6, paddingHorizontal: space.s4, paddingBottom: space.s9 },
  tabs: { gap: space.s4, paddingHorizontal: space.s2, paddingBottom: space.s4 },
  tab: { height: 36 },
  tabBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s2,
    paddingHorizontal: space.s6,
  },
  tabText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: toyValues.outline },
  banner: { alignItems: "center", gap: space.s5, marginTop: space.s5, marginBottom: space.s2 },
  ribbonWrap: { paddingHorizontal: 22 },
  ribbon: { paddingHorizontal: space.s12, paddingVertical: space.s3 },
  tail: { position: "absolute", top: 12 },
  tailLeft: { left: 0 },
  tailRight: { right: 0 },
  range: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    letterSpacing: 1.4,
    color: ink.pageInkMuted,
  },
  stop: { position: "absolute", left: 0, right: 0, height: ROAD_ROW },
  stopButton: {
    position: "absolute",
    top: (ROAD_ROW - STOP_BOX) / 2,
    width: STOP_BOX,
    height: STOP_BOX,
    alignItems: "center",
    justifyContent: "center",
  },
  tagWrap: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: space.s5,
    borderWidth: 2,
    borderColor: alpha(toyValues.outline, 0.4),
    borderRadius: radii.pill,
    backgroundColor: ink.pageRaised,
  },
  tagMilestone: { borderColor: toyMatters.gold.edge },
  tagChosen: {
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.gold.top,
  },
  tagText: {
    flexShrink: 1,
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    lineHeight: 14,
    color: ink.pageInk,
  },
  tagFar: { color: ink.pageInkMuted },
  here: {
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 0 18px ${alpha(toyMatters.gold.top, 0.8)}`,
    borderRadius: 40,
  },
  hereChest: { position: "absolute", top: -14, right: -20 },
  chestNumber: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    minWidth: 30,
    height: 22,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  disc: { alignItems: "center", justifyContent: "center" },
  discRing: { position: "absolute", top: -9, left: -9 },
  tick: {
    position: "absolute",
    right: -6,
    bottom: -4,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 11,
    backgroundColor: toyMatters.green.top,
  },
  bubble: { position: "absolute", left: 0, right: 0, zIndex: 3, elevation: 6 },
  arrow: {
    position: "absolute",
    zIndex: 1,
    width: 18,
    height: 18,
    backgroundColor: colors.paper,
    borderColor: toyValues.outline,
    transform: [{ rotate: "45deg" }],
  },
  arrowAbove: {
    top: -8,
    borderTopWidth: toyValues.outlineWidth,
    borderLeftWidth: toyValues.outlineWidth,
  },
  arrowBelow: {
    bottom: -8,
    borderBottomWidth: toyValues.outlineWidth,
    borderRightWidth: toyValues.outlineWidth,
  },
  detail: { padding: space.s7 },
  detailInside: { gap: space.s5 },
  detailTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    lineHeight: 26,
    color: ink.pageInk,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    padding: space.s4,
    borderRadius: radii.lg,
    backgroundColor: ink.pageRaised,
  },
  itemText: { flex: 1 },
  itemTitle: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  itemDetail: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  opens: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s5,
    padding: space.s4,
    borderRadius: radii.lg,
    backgroundColor: alpha(toyMatters.gold.top, 0.35),
  },
  opensText: { flex: 1, fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
  done: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  doneText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.success },
  left: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInkMuted },
  unlocks: { gap: space.s5, padding: space.s7 },
  unlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s7,
    padding: space.s4,
    borderRadius: radii.lg,
    backgroundColor: ink.pageRaised,
  },
  unlockLevel: {
    position: "absolute",
    right: -8,
    bottom: -6,
    minWidth: 24,
    height: 22,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockText: { flex: 1 },
  unlockName: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: ink.pageInk },
  unlockAt: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInkMuted },
});
