import type {
  BoardResponse,
  JoustDeckResponse,
  JoustStanding,
  JoustSummary,
  JoustsResponse,
  JoustView,
  LaunchJoustRequest,
  LeagueResponse,
} from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import { gainBanner, lettering, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  AUTOMATON,
  type BoardLine,
  CLASSEMENT,
  COMPOSE_DECK,
  DECK_NOT_SAVED,
  deckPointsLine,
  deckTrapsLine,
  EDIT_DECK_SHORT,
  ENDED_IN_VIEW,
  GUIDE_AGAIN,
  groupGlimpse,
  HOW_FOLD,
  HOW_TITLE,
  howOpenAtFirst,
  howSteps,
  JOUST,
  JOUSTS_HELP_LABEL,
  joustRowState,
  joustSections,
  LAUNCH_FREE,
  LAUNCH_FRIENDLY,
  LEAGUE_NAMES,
  LEAGUE_ROAD,
  LETTER_DETAIL,
  ladderRules,
  ladderSteps,
  launchRefusalText,
  leagueRoad,
  MY_GROUP,
  moveChip,
  NO_JOUSTS,
  OPEN_LETTER,
  openedLetter,
  outcomeWord,
  PLAY_JOUST,
  playerName,
  rankedLances,
  rankedLeftText,
  roadLabel,
  runSize,
  SEE_LEAGUES,
  sealedLine,
  seeAllEndedText,
  standingHeader,
  waitingTokenLine,
  weekFigures,
  weekRewardLine,
  YOU,
} from "@leximon/view-model";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Fragment, type ReactNode, useState } from "react";
import {
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { api } from "@/api/client";
import { useEngravingInk } from "@/cards/catalog";
import { useCatalog } from "@/cards/use-catalog";
import { play, vibrate } from "@/feedback/feedback";
import { DESK_PADDING, DESK_RIM, MainAction } from "@/library/play-pieces";
import { useNow } from "@/player/shared";
import { catalogCard, openCard } from "@/screens/trades/card-row";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Icon } from "@/ui/icon";
import { Matter } from "@/ui/matter";
import { BindingRule, Tooling } from "@/ui/ornaments";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { Leaf, Lettering, Toy, ToyIcon } from "@/ui/toy";
import { Crest } from "./crest";
import { DeckBuilder } from "./deck-builder";
import { ink, LeafKicker, Looping, MiniCard, Notice, pieces } from "./pieces";

/** The old print behind the lice: a rider at full gallop, from the card of the same name. */
const LICE_ENGRAVING = "palefroi";

const FAN_CARD = 60;

/** A toy matter as a fill: lit at the top, in shade at the bottom. */
const matterFill = (matter: { readonly top: string; readonly bottom: string }) =>
  `linear-gradient(180deg, ${matter.top}, ${matter.bottom})`;

/** Each leaf rises in turn when the screen appears. */
const rise = (index: number) => FadeInUp.delay(index * 90).duration(320);

/**
 * The jousts' hall, from top to bottom: the lice (league, week, launch), the road of the leagues,
 * the player's neighbours in the group, how it works, their jousts, their deck. As on the web.
 */
export function Hall({
  jousts,
  deck,
  league,
  group,
  busy,
  refusal,
  onLaunch,
  onFriends,
  onGuide,
  onDeckSaved,
}: {
  readonly jousts: JoustsResponse;
  readonly deck: JoustDeckResponse;
  readonly league: LeagueResponse | null;
  readonly group: BoardResponse | null;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onLaunch: (request: LaunchJoustRequest) => void;
  readonly onFriends: () => void;
  readonly onGuide: () => void;
  readonly onDeckSaved: () => void;
}) {
  const now = useNow(60_000);
  const [deckOpen, setDeckOpen] = useState(false);
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [howChoice, setHowChoice] = useState<boolean | null>(null);
  const howOpen = howChoice ?? (league === null ? false : howOpenAtFirst(league.stats.ranked));
  const glimpse = group === null ? null : groupGlimpse(group);
  let order = 0;

  return (
    <View style={styles.hall}>
      <Animated.View entering={rise(order++)}>
        <Lice standing={jousts.standing} league={league} now={now}>
          <View style={styles.helpCorner}>
            <Toy
              matter="paper"
              shape="round"
              style={styles.help}
              accessibilityRole="button"
              accessibilityLabel={JOUSTS_HELP_LABEL}
              accessibilityState={{ expanded: howOpen }}
              onPress={() => setHowChoice(!howOpen)}
            >
              <Lettering size={fontSizes.lead}>?</Lettering>
            </Toy>
          </View>
          <LiceActions
            jousts={jousts}
            busy={busy}
            refusal={refusal}
            onLaunch={onLaunch}
            onFriends={onFriends}
            onCompose={() => setDeckOpen(true)}
          />
        </Lice>
      </Animated.View>

      {jousts.deckSaved && (
        <Animated.View entering={rise(order++)}>
          <DeckLeaf deck={deck} onEdit={() => setDeckOpen(true)} />
        </Animated.View>
      )}

      <Animated.View entering={rise(order++)}>
        <Road standing={jousts.standing} league={league} onOpen={() => setLeaguesOpen(true)} />
      </Animated.View>

      {glimpse !== null && (
        <Animated.View entering={rise(order++)}>
          <Leaf style={[pieces.leaf, pieces.framed]}>
            <BindingRule />
            <View style={styles.leafHead}>
              <View style={styles.flex}>
                <LeafKicker>{`${MY_GROUP} · ${LEAGUE_NAMES[jousts.standing.league]}`}</LeafKicker>
              </View>
              <More label={CLASSEMENT} onPress={() => router.push("/joutes/classement")} />
            </View>
            {glimpse.lines.map((line) => (
              <Fragment key={line.key}>
                {glimpse.downFrom?.key === line.key && (
                  <ZoneLine move="down">{glimpse.downFrom.text}</ZoneLine>
                )}
                <GroupRow line={line} />
                {glimpse.upAfter?.key === line.key && (
                  <ZoneLine move="up">{glimpse.upAfter.text}</ZoneLine>
                )}
              </Fragment>
            ))}
          </Leaf>
        </Animated.View>
      )}

      {howOpen && (
        <Animated.View entering={rise(order++)}>
          <Leaf style={[pieces.leaf, pieces.framed]}>
            <BindingRule />
            <View style={styles.leafHead}>
              <View style={styles.flex}>
                <LeafKicker>{HOW_TITLE}</LeafKicker>
              </View>
              <More label={HOW_FOLD} onPress={() => setHowChoice(false)} />
            </View>
            {howSteps(runSize(now), league?.points.won ?? null).map((step, index) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <ToyIcon name={step.icon} size={34} />
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepText}>{step.text}</Text>
                </View>
              </View>
            ))}
            <TextButton label={GUIDE_AGAIN} onPress={onGuide} />
          </Leaf>
        </Animated.View>
      )}

      <Animated.View entering={rise(order++)}>
        <JoustLists jousts={jousts.jousts} now={now} />
      </Animated.View>

      <Sheet open={deckOpen} title="Ton deck" tall onClose={() => setDeckOpen(false)}>
        {deckOpen && (
          <DeckBuilder
            deck={deck}
            initial={deck.saved || jousts.jousts.length > 0 ? deck.cardIds : []}
            onSaved={() => {
              setDeckOpen(false);
              onDeckSaved();
            }}
          />
        )}
      </Sheet>
      <Sheet open={leaguesOpen} title="Les ligues" onClose={() => setLeaguesOpen(false)}>
        {league !== null && <Leagues league={league} />}
      </Sheet>
    </View>
  );
}

function More({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.more}
    >
      <Text style={styles.moreText}>{label}</Text>
      <Icon name="chev" size={14} color={ink.pageInk} />
    </Pressable>
  );
}

// --- The lice ------------------------------------------------------------------------------------

function Lice({
  standing,
  league,
  now,
  children,
}: {
  readonly standing: JoustStanding;
  readonly league: LeagueResponse | null;
  readonly now: number;
  readonly children: ReactNode;
}) {
  const header = standingHeader(standing, gameDayOf(now).key);
  const reward = weekRewardLine(standing.league, league?.ladder ?? null);
  const group = standing.group;
  const figures = group === null ? null : weekFigures(group);
  return (
    <LeatherStage>
      <View style={styles.crest}>
        <Crest league={standing.league} size={110} />
        <View style={styles.ribbon}>
          <Lettering size={fontSizes.subtitle}>{header.name}</Lettering>
        </View>
      </View>

      <Text style={styles.kickerLight}>Tournoi de la semaine</Text>
      <View style={styles.clock}>
        <Icon name="clock" size={14} color={lettering.fill} />
        <Text style={styles.clockText}>{header.week}</Text>
      </View>
      {figures !== null && group !== null ? (
        <>
          <View style={styles.figures}>
            <View style={styles.figure}>
              <Lettering size={fontSizes.display}>{figures.place}</Lettering>
              <Text style={styles.figureSmall}>{figures.of}</Text>
            </View>
            <View style={styles.figureDot} />
            <View style={styles.figure}>
              <Lettering size={fontSizes.display}>{figures.points}</Lettering>
              <Text style={styles.figureSmall}>{figures.pointsWord}</Text>
            </View>
          </View>
          <View style={[styles.zone, ZONE_FILLS[group.move]]}>
            {group.move !== "stay" && (
              <View style={{ transform: [{ rotate: group.move === "up" ? "-90deg" : "90deg" }] }}>
                <Icon name="chev" size={15} color={lettering.fill} />
              </View>
            )}
            <Text style={[styles.zoneText, group.move === "stay" && { color: ink.pageInk }]}>
              {moveChip(standing.league, group.move)}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.weekLine}>{header.line}</Text>
      )}
      {reward !== null && <Text style={styles.weekReward}>{reward}</Text>}
      {header.waiting !== null && (
        <Pressable
          style={styles.waiting}
          onPress={() => router.push("/joutes/classement")}
          accessibilityRole="button"
        >
          <ToyIcon name="chest" size={20} />
          <Text style={styles.waitingText}>{header.waiting}</Text>
        </Pressable>
      )}
      {children}
    </LeatherStage>
  );
}

/**
 * Red leather tooled in gold, with the old print of a rider behind: the lice of the hall, and the
 * arena before a run.
 */
export function LeatherStage({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const engraving = useEngravingInk(LICE_ENGRAVING);
  return (
    <View style={styles.frame}>
      <View style={[styles.leather, style]}>
        <Matter kind="leather" />
        {/* The leather turns in at its edge, a shade darker. */}
        <View style={styles.rim} pointerEvents="none" />
        {engraving !== null && (
          <Image
            source={{ uri: engraving }}
            style={styles.engraving}
            contentFit="contain"
            tintColor={lettering.fill}
            accessible={false}
          />
        )}
        <Tooling />
        {children}
      </View>
    </View>
  );
}

const ZONE_FILLS = StyleSheet.create({
  up: { backgroundImage: matterFill(toyMatters.green) },
  stay: { backgroundImage: matterFill(toyMatters.paper) },
  down: { backgroundImage: matterFill(toyMatters.red) },
});

function LiceActions({
  jousts,
  busy,
  refusal,
  onLaunch,
  onFriends,
  onCompose,
}: {
  readonly jousts: JoustsResponse;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onLaunch: (request: LaunchJoustRequest) => void;
  readonly onFriends: () => void;
  readonly onCompose: () => void;
}) {
  const ready = jousts.deckSaved && jousts.deckReady;
  const ranked = jousts.standing.rankedLeft > 0;
  return (
    <View style={styles.actions}>
      {ready ? (
        <>
          <MainAction
            label={ranked ? JOUST : LAUNCH_FREE}
            disabled={busy}
            onPress={() => onLaunch({ kind: ranked ? "ranked" : "free" })}
          />
          <Lances standing={jousts.standing} />
          <View style={styles.minorActions}>
            {ranked && (
              <Minor
                icon="swap"
                label={LAUNCH_FREE}
                disabled={busy}
                onPress={() => onLaunch({ kind: "free" })}
              />
            )}
            <Minor icon="amis" label={LAUNCH_FRIENDLY} disabled={busy} onPress={onFriends} />
          </View>
        </>
      ) : (
        <MainAction label={COMPOSE_DECK} disabled={!jousts.deckReady} onPress={onCompose} />
      )}
      {!jousts.deckReady && (
        <Text style={styles.actionLine}>{launchRefusalText("deck_too_small", 0)}</Text>
      )}
      {jousts.deckReady && !jousts.deckSaved && (
        <Text style={styles.actionLine}>{DECK_NOT_SAVED}</Text>
      )}
      <Notice>{refusal}</Notice>
    </View>
  );
}

/** The ranked jousts left today, under the button that spends them. */
function Lances({ standing }: { readonly standing: JoustStanding }) {
  const text = rankedLeftText(standing.rankedLeft);
  return (
    <View style={styles.lancesBlock}>
      <View style={styles.lances} accessible accessibilityLabel={text}>
        {rankedLances(standing.rankedLeft, standing.rankedPerDay).map((up, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the day's lances, in order
          <Lance key={index} spent={!up} />
        ))}
      </View>
      <Text style={styles.lancesText} importantForAccessibility="no">
        {text}
      </Text>
    </View>
  );
}

function Minor({
  icon,
  label,
  disabled,
  onPress,
}: {
  readonly icon: "swap" | "amis";
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Toy
      matter="paper"
      style={styles.minor}
      bodyStyle={styles.minorBody}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
    >
      <Icon name={icon} size={17} color={ink.pageInk} />
      <Text style={styles.minorText} numberOfLines={1}>
        {label}
      </Text>
    </Toy>
  );
}

/** A ranked joust of the day: standing while still to play, laid down once played. */
function Lance({ spent }: { readonly spent: boolean }) {
  return (
    <View style={spent && styles.lanceSpent}>
      <Svg width={13} height={40} viewBox="0 0 14 44">
        {["M7 1 L11 12 H3 Z", "M5.5 12 H8.5 L9 34 H5 Z", "M2 34 H12 L10 40 H4 Z"].map((d) => (
          <Path
            key={d}
            d={d}
            fill={spent ? toyMatters.locked.bottom : toyMatters.gold.top}
            stroke={toyValues.outline}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}

// --- The road of the leagues ---------------------------------------------------------------------

const STOP = 76;

export function Road({
  standing,
  league,
  onOpen,
}: {
  readonly standing: JoustStanding;
  readonly league: LeagueResponse | null;
  readonly onOpen: () => void;
}) {
  const stops = leagueRoad(standing.league);
  const here = stops.findIndex((stop) => stop.state === "here");
  return (
    <Leaf style={[pieces.leaf, pieces.framed]}>
      <BindingRule />
      <View style={styles.leafHead}>
        <View style={styles.flex}>
          <LeafKicker>{LEAGUE_ROAD}</LeafKicker>
        </View>
        {league !== null && <More label={SEE_LEAGUES} onPress={onOpen} />}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: Math.max(0, (here - 1) * STOP), y: 0 }}
      >
        <Pressable
          style={styles.road}
          onPress={onOpen}
          disabled={league === null}
          accessibilityRole="button"
          accessibilityLabel={`${roadLabel(standing.league)} ${SEE_LEAGUES}`}
        >
          <View style={styles.roadLine}>
            <View style={[styles.roadReached, { width: here * STOP }]} />
          </View>
          {stops.map((stop) => (
            <View key={stop.league} style={styles.stop}>
              <View style={styles.youSlot}>
                {stop.state === "here" && (
                  <View style={styles.youTag}>
                    <Text style={styles.youText}>{YOU.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Crest
                league={stop.league}
                size={stop.state === "here" ? 50 : 38}
                dim={stop.state === "ahead"}
              />
              <Text
                style={[styles.stopName, stop.state === "ahead" && { color: ink.pageInkMuted }]}
              >
                {stop.name}
              </Text>
            </View>
          ))}
        </Pressable>
      </ScrollView>
    </Leaf>
  );
}

export function Leagues({ league }: { readonly league: LeagueResponse }) {
  return (
    <View style={styles.leagues}>
      {ladderSteps(league).map((step) => (
        <View
          key={step.league}
          style={[styles.ladderRow, step.here && styles.ladderHere]}
          accessible
          accessibilityLabel={step.label}
        >
          <Crest league={step.league} size={46} />
          <View style={styles.flex}>
            <View style={styles.ladderName}>
              <Text style={styles.ladderTitle}>{step.name}</Text>
              {step.here && (
                <View style={styles.youTag}>
                  <Text style={styles.youText}>{YOU.toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.ladderLine}>{step.moves}</Text>
            <Text style={styles.ladderLine}>{step.reward}</Text>
          </View>
        </View>
      ))}
      {ladderRules(league).map((line) => (
        <View key={line} style={styles.ruleLine}>
          <View style={styles.bullet} />
          <Text style={styles.ruleText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

// --- The group -----------------------------------------------------------------------------------

/** A line of the group; `zoned` tints it in the colour of the zone it stands in. */
export function GroupRow({
  line,
  zoned = false,
}: {
  readonly line: BoardLine;
  readonly zoned?: boolean;
}) {
  return (
    <View
      style={[
        styles.groupRow,
        zoned && line.move === "up" && styles.groupRowUp,
        zoned && line.move === "down" && styles.groupRowDown,
        line.me && styles.groupRowMe,
      ]}
    >
      <Text style={styles.groupPlace}>{line.place}</Text>
      {line.player !== null ? (
        <Avatar avatar={line.player.avatar} frame={line.player.frame} size={32} />
      ) : (
        <View style={styles.automaton}>
          <Icon
            name={line.kind === "bot" ? "reglages" : "profil"}
            size={16}
            color={ink.pageInkMuted}
          />
        </View>
      )}
      <Text style={styles.groupName} numberOfLines={1}>
        {line.name}
        {line.tag !== null && <Text style={styles.botTag}> {AUTOMATON}</Text>}
      </Text>
      <Text style={styles.groupPoints}>{line.points} pts</Text>
    </View>
  );
}

export function ZoneLine({
  move,
  children,
}: {
  readonly move: "up" | "down";
  readonly children: string;
}) {
  const color = move === "up" ? toyMatters.green.bottom : toyMatters.red.bottom;
  return (
    <View style={styles.zoneLine}>
      <View style={[styles.zoneDash, { borderColor: color }]} />
      <Text style={[styles.zoneLineText, { color }]}>{children}</Text>
      <View style={[styles.zoneDash, { borderColor: color }]} />
    </View>
  );
}

// --- The jousts ----------------------------------------------------------------------------------

function JoustLists({
  jousts,
  now,
}: {
  readonly jousts: readonly JoustSummary[];
  readonly now: number;
}) {
  const sections = joustSections(jousts);
  const [allEnded, setAllEnded] = useState(false);
  return (
    <Leaf style={[pieces.leaf, pieces.framed]}>
      <BindingRule />
      {jousts.length === 0 && <Text style={pieces.line}>{NO_JOUSTS}</Text>}
      {sections.toPlay.length > 0 && (
        <Group title="À toi de jouer">
          {sections.toPlay.map((joust) => (
            <Looping key={joust.id} kind="beat">
              <JoustRow joust={joust} now={now} toPlay>
                <View style={styles.playTag}>
                  <Text style={styles.playText}>{PLAY_JOUST}</Text>
                </View>
              </JoustRow>
            </Looping>
          ))}
        </Group>
      )}
      {sections.toDiscover.length > 0 && (
        <Group title="Résultats à découvrir">
          {sections.toDiscover.map((joust) => (
            <Letter key={joust.id} joust={joust} />
          ))}
        </Group>
      )}
      {sections.waiting.length > 0 && (
        <Group title="En attente">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tokens}
          >
            {sections.waiting.map((joust) => (
              <WaitingToken key={joust.id} joust={joust} now={now} />
            ))}
          </ScrollView>
        </Group>
      )}
      {sections.ended.length > 0 && (
        <Group title="Terminées">
          <View style={styles.ended}>
            {(allEnded ? sections.ended : sections.ended.slice(0, ENDED_IN_VIEW)).map((joust) => (
              <EndedRow key={joust.id} joust={joust} now={now} />
            ))}
          </View>
          {!allEnded && sections.ended.length > ENDED_IN_VIEW && (
            <More
              label={seeAllEndedText(sections.ended.length)}
              onPress={() => setAllEnded(true)}
            />
          )}
        </Group>
      )}
    </Leaf>
  );
}

const OUTCOME_FILLS = StyleSheet.create({
  won: { backgroundImage: matterFill(toyMatters.green) },
  lost: { backgroundImage: matterFill(toyMatters.red) },
  draw: { backgroundImage: matterFill(toyMatters.paper) },
});

function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <View style={styles.group}>
      <LeafKicker>{title}</LeafKicker>
      {children}
    </View>
  );
}

const goTo = (joust: JoustSummary) =>
  router.push({ pathname: "/joutes/[id]", params: { id: joust.id } });

/** The letter turns over in this time; the seal's sound and the outcome's meet in the middle. */
const FLIP_MS = 640;

/**
 * A result to discover: a letter under a wax seal, the opponent's portrait in the wax. Opened, it
 * turns over where it lies and shows the result; the gains follow once the server sends them.
 */
function Letter({ joust }: { readonly joust: JoustSummary }) {
  const [opened, setOpened] = useState(false);
  const [result, setResult] = useState<JoustView["result"] | null>(null);
  const turn = useSharedValue(0);
  const back = openedLetter(joust, result);
  const name = playerName(joust.opponent);
  const won = joust.outcome === "won";

  const front = useAnimatedStyle(() => ({
    opacity: turn.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${turn.value * 180}deg` }],
  }));
  const reverse = useAnimatedStyle(() => ({
    opacity: turn.value < 0.5 ? 0 : 1,
    transform: [{ perspective: 900 }, { rotateY: `${turn.value * 180 - 180}deg` }],
  }));

  const open = () => {
    if (opened) return;
    setOpened(true);
    play("sealBreak");
    turn.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.back(1.4)) });
    setTimeout(() => {
      play(won ? "fanfareEpic" : "flip");
      vibrate(won ? [30, 40, 60] : [30]);
    }, FLIP_MS / 2);
    // Watched once: the seal stays broken on every device.
    api.markJoustSeen(joust.id).catch(() => undefined);
    api
      .fetchJoust(joust.id)
      .then((view) => setResult(view.result))
      .catch(() => undefined);
  };

  return (
    <View style={styles.letterSlot}>
      <Looping kind="wobble" style={styles.face}>
        <Animated.View style={[styles.flex, front]} pointerEvents={opened ? "none" : "auto"}>
          <Pressable
            onPress={open}
            style={({ pressed }) => [styles.flex, styles.letter, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${name}. ${sealedLine(joust)}`}
          >
            <Matter kind="paper" />
            <View style={styles.seal}>
              <Avatar
                avatar={joust.opponent?.avatar ?? null}
                frame={joust.opponent?.frame ?? null}
                size={42}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.rowState}>{sealedLine(joust)}</Text>
            </View>
            <View style={styles.playTag}>
              <Text style={styles.playText}>{OPEN_LETTER}</Text>
            </View>
          </Pressable>
        </Animated.View>
      </Looping>
      <Animated.View
        style={[styles.face, styles.letter, styles.letterBack, won && styles.letterWon, reverse]}
        pointerEvents={opened ? "auto" : "none"}
        accessibilityElementsHidden={!opened}
        accessibilityLiveRegion="polite"
      >
        <Matter kind="paper" />
        <Lettering
          size={fontSizes.titleLarge}
          {...(joust.outcome === "lost" ? { color: toyMatters.red.bottom } : {})}
        >
          {back.outcome}
        </Lettering>
        <Text style={styles.letterScore} numberOfLines={2}>
          <Text style={styles.letterName}>{name}</Text> · {back.score}
        </Text>
        {back.gains.length > 0 && (
          <View style={styles.gains}>
            {back.gains.map((gain, index) => (
              <Animated.View
                key={gain}
                entering={ZoomIn.delay(index * 90).springify()}
                style={styles.gain}
              >
                <Text style={styles.gainText}>{gain}</Text>
              </Animated.View>
            ))}
          </View>
        )}
        <More label={LETTER_DETAIL} onPress={() => goTo(joust)} />
      </Animated.View>
    </View>
  );
}

function JoustRow({
  joust,
  now,
  toPlay = false,
  children,
}: {
  readonly joust: JoustSummary;
  readonly now: number;
  readonly toPlay?: boolean;
  readonly children?: ReactNode;
}) {
  const name = playerName(joust.opponent);
  const state = joustRowState(joust, now);
  return (
    <Pressable
      onPress={() => goTo(joust)}
      style={({ pressed }) => [styles.row, toPlay && styles.rowPlay, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${state}`}
    >
      <Avatar
        avatar={joust.opponent?.avatar ?? null}
        frame={joust.opponent?.frame ?? null}
        size={38}
      />
      <View style={styles.flex}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.rowStateLine}>
          <Text style={styles.rowState} numberOfLines={2}>
            {state}
          </Text>
        </View>
      </View>
      {children}
    </Pressable>
  );
}

/** A joust waiting on the opponent: their portrait under an hourglass, and until when. */
function WaitingToken({ joust, now }: { readonly joust: JoustSummary; readonly now: number }) {
  const name = playerName(joust.opponent);
  const line = waitingTokenLine(joust, now);
  return (
    <Pressable
      onPress={() => goTo(joust)}
      style={({ pressed }) => [styles.token, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${line}`}
    >
      <View>
        <Avatar
          avatar={joust.opponent?.avatar ?? null}
          frame={joust.opponent?.frame ?? null}
          size={46}
        />
        <View style={styles.tokenClock}>
          <Icon name="clock" size={12} color={toyValues.outline} />
        </View>
      </View>
      <Text style={styles.tokenName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.tokenLine} numberOfLines={2}>
        {line}
      </Text>
    </Pressable>
  );
}

/** An ended joust on one tight line, its outcome in colour down its whole right end. */
function EndedRow({ joust, now }: { readonly joust: JoustSummary; readonly now: number }) {
  const name = playerName(joust.opponent);
  const state = joustRowState(joust, now);
  const outcome = outcomeWord(joust.outcome);
  return (
    <Pressable
      onPress={() => goTo(joust)}
      style={({ pressed }) => [styles.endedRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${state}. ${outcome}`}
    >
      <Avatar
        avatar={joust.opponent?.avatar ?? null}
        frame={joust.opponent?.frame ?? null}
        size={30}
      />
      <View style={styles.flex}>
        <Text style={styles.endedName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowState} numberOfLines={1}>
          {state}
        </Text>
      </View>
      <View style={[styles.outcome, OUTCOME_FILLS[joust.outcome ?? "draw"]]}>
        <Text style={[styles.outcomeText, joust.outcome === "draw" && { color: ink.pageInk }]}>
          {outcome}
        </Text>
      </View>
    </Pressable>
  );
}

// --- The deck ------------------------------------------------------------------------------------

function DeckLeaf({
  deck,
  onEdit,
}: {
  readonly deck: JoustDeckResponse;
  readonly onEdit: () => void;
}) {
  const catalog = useCatalog();
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const spent = deck.cardIds.reduce((total, id) => total + (costs.get(id) ?? 0), 0);
  const trapsLine = deckTrapsLine(deck.trapped);
  const middle = (deck.cardIds.length - 1) / 2;
  // The fan closes up to hold in the leaf, whatever the phone's width.
  const [fanWidth, setFanWidth] = useState(0);
  const fanStep =
    deck.cardIds.length < 2 || fanWidth === 0
      ? FAN_CARD
      : Math.min(FAN_CARD * 0.8, (fanWidth - FAN_CARD - 8) / (deck.cardIds.length - 1));
  return (
    <Leaf style={[pieces.leaf, pieces.framed]}>
      <BindingRule />
      <View style={styles.leafHead}>
        <View style={styles.flex}>
          <LeafKicker>Ton deck</LeafKicker>
        </View>
        <Toy
          matter="paper"
          style={styles.edit}
          bodyStyle={styles.minorBody}
          accessibilityRole="button"
          accessibilityLabel={EDIT_DECK_SHORT}
          onPress={onEdit}
        >
          <Text style={styles.minorText}>{EDIT_DECK_SHORT}</Text>
        </Toy>
      </View>
      <Text style={pieces.line}>
        {deckPointsLine(spent, deck.budget)}
        {trapsLine !== null && ` ${trapsLine}`}
      </Text>
      {catalog !== null && (
        <View style={styles.fan} onLayout={(event) => setFanWidth(event.nativeEvent.layout.width)}>
          {deck.cardIds.map((cardId, index) => {
            const offset = index - middle;
            const card = catalogCard(catalog, cardId);
            return (
              <Pressable
                key={cardId}
                accessibilityRole="button"
                accessibilityLabel={card.word}
                onPress={() => openCard(cardId, deck.cardIds)}
                style={{
                  marginLeft: index === 0 ? 0 : fanStep - FAN_CARD,
                  transform: [
                    { translateY: Math.abs(offset) * 2.5 },
                    { rotate: `${offset * 3.5}deg` },
                  ],
                }}
              >
                <MiniCard card={card} width={FAN_CARD} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Leaf>
  );
}

const styles = StyleSheet.create({
  hall: { gap: space.s8 },
  flex: { flex: 1 },
  leafHead: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  more: { flexDirection: "row", alignItems: "center", gap: space.s1 },
  moreText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },

  // The lice: red leather in old gold, as the gain banners.
  frame: {
    borderRadius: 24,
    boxShadow: `0 0 0 2.5px ${toyValues.outline}, 0 6px 0 2.5px ${toyValues.outline}, 0 14px 28px ${toyValues.drop}`,
  },
  // Clear of the gilt tooling round the leather.
  leather: {
    alignItems: "center",
    gap: space.s4,
    overflow: "hidden",
    paddingTop: DESK_PADDING + space.s6,
    paddingBottom: DESK_PADDING + space.s6,
    paddingHorizontal: DESK_PADDING + space.s3,
    borderRadius: 24,
    backgroundImage: `radial-gradient(ellipse 120% 70% at 50% 18%, ${gainBanner.center} 0%, ${gainBanner.middle} 55%, ${gainBanner.edge} 100%)`,
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    borderWidth: DESK_RIM,
    borderColor: alpha(gainBanner.edge, 0.7),
    boxShadow: `inset 0 2px 0 ${alpha(lettering.fill, 0.05)}`,
  },
  engraving: {
    position: "absolute",
    right: -40,
    top: 20,
    width: 260,
    height: 260,
    opacity: 0.12,
  },
  helpCorner: { position: "absolute", top: DESK_PADDING, right: DESK_PADDING, zIndex: 1 },
  help: { width: 40, height: 40 },
  crest: { alignItems: "center", filter: `drop-shadow(0 6px 0 ${toyValues.drop})` },
  ribbon: {
    marginTop: -16,
    paddingHorizontal: space.s10,
    paddingVertical: space.s1,
    borderWidth: 2.5,
    borderColor: toyValues.outline,
    borderRadius: radii.xs,
    backgroundImage: matterFill(toyMatters.gold),
    boxShadow: `0 3px 0 ${toyValues.outline}`,
  },
  kickerLight: {
    fontFamily: fonts.displayBold,
    marginTop: space.s4,
    fontSize: fontSizes.body,
    color: lettering.kicker,
  },
  figures: { flexDirection: "row", gap: space.s7, alignItems: "center" },
  figureDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: lettering.kicker,
    opacity: 0.7,
  },
  figure: { flexDirection: "row", alignItems: "baseline", gap: space.s2 },
  figureSmall: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: lettering.fill,
  },
  zone: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s2,
    paddingHorizontal: space.s6,
    paddingVertical: space.s2,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    boxShadow: `0 2px 0 ${toyValues.outline}`,
  },
  zoneText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: lettering.fill },
  weekLine: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    textAlign: "center",
    color: lettering.fill,
  },
  // Under a rule, what Sunday brings: after the place, not beside it.
  weekReward: {
    alignSelf: "stretch",
    marginTop: space.s2,
    paddingTop: space.s5,
    borderTopWidth: 1,
    borderTopColor: alpha(lettering.fill, 0.22),
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    textAlign: "center",
    color: lettering.kicker,
  },
  clock: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s2,
    paddingHorizontal: space.s6,
    paddingVertical: space.s2,
    borderRadius: radii.pill,
    backgroundColor: alpha(toyValues.outline, 0.55),
  },
  clockText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: lettering.fill },
  lancesBlock: { alignItems: "center", gap: space.s2 },
  lances: { flexDirection: "row", alignItems: "flex-end", gap: space.s3 },
  lanceSpent: { opacity: 0.6, transform: [{ rotate: "18deg" }, { translateY: 4 }] },
  lancesText: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    textAlign: "center",
    color: lettering.fill,
  },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingLeft: space.s3,
    paddingRight: space.s6,
    paddingVertical: space.s2,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundImage: matterFill(toyMatters.gold),
  },
  waitingText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
  actions: { alignSelf: "stretch", gap: space.s5, marginTop: space.s6 },
  minorActions: { flexDirection: "row", gap: space.s4 },
  minor: { flex: 1, height: 44 },
  minorBody: { flexDirection: "row", gap: space.s3, paddingHorizontal: space.s5 },
  minorText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
  actionLine: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    textAlign: "center",
    color: lettering.fill,
  },

  // The road.
  road: { flexDirection: "row", paddingTop: space.s2 },
  roadLine: {
    position: "absolute",
    left: STOP / 2,
    width: STOP * 6,
    top: 52,
    height: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.paper.bottom,
  },
  roadReached: { height: "100%", backgroundColor: toyMatters.gold.top },
  stop: { width: STOP, alignItems: "center", gap: space.s1 },
  youSlot: { height: 20, justifyContent: "flex-end" },
  youTag: {
    paddingHorizontal: space.s3,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundImage: matterFill(toyMatters.red),
  },
  youText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.nano,
    letterSpacing: 1,
    color: lettering.fill,
  },
  stopName: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.caption, color: ink.pageInk },

  // The leagues window.
  leagues: { gap: space.s4 },
  ladderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    padding: space.s4,
    borderWidth: 2,
    borderColor: ink.rule,
    borderRadius: radii.xxl,
  },
  ladderHere: {
    borderColor: toyValues.outline,
    backgroundColor: alpha(toyMatters.gold.top, 0.3),
  },
  ladderName: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  ladderTitle: { fontFamily: fonts.display, fontSize: fontSizes.subtitle, color: ink.pageInk },
  ladderLine: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.small, color: ink.pageInkMuted },
  ruleLine: { flexDirection: "row", alignItems: "flex-start", gap: space.s4 },
  bullet: {
    width: 7,
    height: 7,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: ink.rubric,
    borderWidth: 1,
    borderColor: toyValues.outline,
  },
  ruleText: {
    flex: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: ink.pageInk,
  },

  // The group.
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    paddingHorizontal: space.s5,
    paddingVertical: space.s3,
    borderWidth: 2,
    borderColor: ink.rule,
    borderRadius: radii.xl,
    backgroundColor: alpha(toyMatters.paper.top, 0.7),
  },
  groupRowUp: {
    borderColor: alpha(toyMatters.green.bottom, 0.55),
    backgroundColor: alpha(toyMatters.green.top, 0.22),
  },
  groupRowDown: {
    borderColor: alpha(toyMatters.red.bottom, 0.55),
    backgroundColor: alpha(toyMatters.red.top, 0.18),
  },
  groupRowMe: {
    borderColor: toyValues.outline,
    backgroundImage: matterFill(toyMatters.gold),
    boxShadow: `0 3px 0 ${toyValues.outline}`,
  },
  groupPlace: {
    width: 24,
    textAlign: "center",
    fontFamily: fonts.display,
    fontSize: fontSizes.lead,
    color: ink.pageInk,
  },
  automaton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: ink.rule,
    borderRadius: 16,
  },
  groupName: {
    flex: 1,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: ink.pageInk,
  },
  botTag: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption, color: ink.pageInkMuted },
  groupPoints: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  zoneLine: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  zoneDash: { flex: 1, borderTopWidth: 2.5, borderStyle: "dashed" },
  zoneLineText: {
    fontFamily: fonts.displayBold,
    flexShrink: 1,
    textAlign: "center",
    fontSize: fontSizes.body,
  },

  // How it works.
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    padding: space.s5,
    borderRadius: radii.xxl,
    backgroundColor: alpha(toyMatters.paper.bottom, 0.45),
  },
  stepIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: toyValues.outline,
    borderRadius: 26,
    backgroundImage: `radial-gradient(circle at 40% 30%, ${toyMatters.paper.top}, ${toyMatters.paper.bottom})`,
    boxShadow: `0 3px 0 ${toyValues.outline}`,
  },
  stepNumber: {
    position: "absolute",
    top: -7,
    left: -7,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 11,
    backgroundColor: toyMatters.gold.top,
  },
  stepNumberText: { fontFamily: fonts.display, fontSize: fontSizes.small, color: ink.pageInk },
  stepTitle: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  stepText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: ink.pageInkMuted,
  },

  // The jousts.
  group: { gap: space.s4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s5,
    minHeight: 56,
    paddingHorizontal: space.s4,
    paddingVertical: space.s3,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: ink.rule,
  },
  rowPlay: {
    borderColor: toyValues.outline,
    backgroundColor: alpha(toyMatters.gold.top, 0.28),
    boxShadow: `0 3px 0 ${toyValues.outline}`,
  },
  pressed: { opacity: 0.8 },
  rowName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  rowStateLine: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  rowState: {
    flexShrink: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  playTag: {
    paddingHorizontal: space.s6,
    paddingVertical: space.s3,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.md,
    backgroundImage: matterFill(toyMatters.gold),
    boxShadow: `0 3px 0 ${toyValues.outline}`,
  },
  playText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: ink.pageInk },
  letter: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    overflow: "hidden",
    padding: space.s6,
    borderWidth: 2.5,
    borderColor: toyValues.outline,
    borderRadius: radii.xl,
    backgroundImage: matterFill(toyMatters.paper),
    boxShadow: `inset 0 -4px 0 ${toyMatters.paper.edge}, 0 4px 0 ${toyValues.outline}`,
  },
  seal: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundImage: `radial-gradient(circle at 38% 32%, ${toyMatters.red.top}, ${toyMatters.red.edge})`,
    boxShadow: `0 0 0 2.5px ${toyValues.outline}, 0 3px 0 2.5px ${toyValues.outline}`,
  },
  letterSlot: { minHeight: 132 },
  face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  letterBack: {
    flexDirection: "column",
    justifyContent: "center",
    gap: space.s2,
    paddingVertical: space.s4,
  },
  letterWon: {
    backgroundImage: `radial-gradient(ellipse at 50% 20%, ${toyMatters.gold.top}, ${toyMatters.paper.bottom})`,
  },
  letterScore: {
    textAlign: "center",
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: ink.pageInk,
  },
  letterName: { fontFamily: fonts.ui.extrabold },
  gains: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s3 },
  gain: {
    paddingHorizontal: space.s5,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundImage: matterFill(toyMatters.gold),
  },
  gainText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
  tokens: { gap: space.s4, paddingBottom: space.s2 },
  token: {
    width: 104,
    alignItems: "center",
    gap: space.s1,
    paddingHorizontal: space.s3,
    paddingVertical: space.s4,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: ink.rule,
  },
  tokenClock: {
    position: "absolute",
    right: -6,
    bottom: -4,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundImage: matterFill(toyMatters.gold),
  },
  tokenName: {
    marginTop: space.s2,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: ink.pageInk,
  },
  tokenLine: {
    textAlign: "center",
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.caption,
    color: ink.pageInkMuted,
  },
  ended: { gap: space.s2 },
  endedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    minHeight: 46,
    paddingLeft: space.s3,
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: ink.rule,
  },
  endedName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  outcome: {
    alignSelf: "stretch",
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 2,
    borderLeftColor: toyValues.outline,
  },
  outcomeText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: lettering.fill,
  },

  // The deck.
  edit: { height: 36 },
  fan: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: space.s4,
    paddingBottom: space.s8,
  },
});
