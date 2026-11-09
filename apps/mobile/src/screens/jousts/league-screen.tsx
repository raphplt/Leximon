import type { Board, BoardEntry, BoardResponse, LeagueResponse } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  BOARDS,
  type BoardLine,
  boardLines,
  boardNote,
  CLASSEMENT,
  CLIMB_KICKER,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  LEAGUE_NAMES,
  leagueClaimedToast,
  leagueClaimRefusalText,
  leagueClimb,
  MY_GROUP,
  placeText,
  pointsText,
  ratingLine,
  waitingReward,
  weekRecord,
  ZONE_DOWN,
  ZONE_UP,
  zoneStarts,
} from "@leximon/view-model";
import { useFocusEffect } from "expo-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { api } from "@/api/client";
import { play } from "@/feedback/feedback";
import { MainAction } from "@/library/play-pieces";
import { wallet } from "@/player/state";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Page, Paragraph } from "@/ui/page";
import { Segmented } from "@/ui/segmented";
import { Sheet } from "@/ui/sheet";
import { ParticleStage } from "@/ui/stage";
import { toast } from "@/ui/toast";
import { Leaf, ToyIcon } from "@/ui/toy";
import { ClimbScene } from "./climb-scene";
import { Crest } from "./crest";
import { GroupRow, Leagues, Road, ZoneLine } from "./hall";
import { Emblem } from "./league-pieces";
import { ink, LeafKicker, Notice, pieces } from "./pieces";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly league: LeagueResponse };

const rise = (index: number) => FadeInUp.delay(index * 90).duration(320);

/**
 * The leagues: a league climbed plays its scene first, then the road of the seven leagues, the
 * week's boards with the group's zones, and the player's figures. The player's own line of the
 * group stays at the foot of the screen. As on the web.
 */
export function LeagueScreen() {
  return (
    <ParticleStage>
      <LeagueFlow />
    </ParticleStage>
  );
}

function LeagueFlow() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [mine, setMine] = useState<BoardLine | null>(null);
  const load = useCallback(() => {
    api
      .fetchJoustLeague()
      .then((league) => setLoaded({ state: "ready", league }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useFocusEffect(load);

  if (loaded.state !== "ready") {
    return (
      <Page title={CLASSEMENT}>
        {loaded.state === "loading" && <Paragraph muted>Un instant…</Paragraph>}
        {loaded.state === "failed" && (
          <>
            <Paragraph muted>Le classement n'a pas pu être chargé. Réessaie.</Paragraph>
            <Button label="Réessayer" secondary onPress={load} />
          </>
        )}
      </Page>
    );
  }
  const { league } = loaded;
  return (
    <Page title={CLASSEMENT} {...(mine === null ? {} : { footer: <GroupRow line={mine} zoned /> })}>
      <View style={styles.screen}>
        <Animated.View entering={rise(0)}>
          <Claim league={league} onClaimed={load} />
        </Animated.View>
        <Animated.View entering={rise(1)}>
          <Road standing={league.standing} league={league} onOpen={() => setLeaguesOpen(true)} />
        </Animated.View>
        <Animated.View entering={rise(2)}>
          <Boards league={league} onMine={setMine} />
        </Animated.View>
        <Animated.View entering={rise(3)}>
          <Leaf style={pieces.leaf}>
            <LeafKicker>Tes joutes classées</LeafKicker>
            <Text style={styles.record}>{weekRecord(league.stats)}</Text>
            <Text style={pieces.line}>{ratingLine(league.stats)}</Text>
          </Leaf>
        </Animated.View>
      </View>
      <Sheet open={leaguesOpen} title="Les ligues" onClose={() => setLeaguesOpen(false)}>
        <Leagues league={league} />
      </Sheet>
    </Page>
  );
}

/** The oldest reward waiting: the scene of a league climbed, or its leaf with the button. */
function Claim({
  league,
  onClaimed,
}: {
  readonly league: LeagueResponse;
  readonly onClaimed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const next = waitingReward(league);
  const climb = leagueClimb(league);
  if (next === null) return null;

  const claim = async () => {
    setBusy(true);
    setRefusal(null);
    try {
      const result = await api.claimLeagueReward(next.week);
      if (result.kind === "refused") {
        setRefusal(leagueClaimRefusalText(result.reason));
        return;
      }
      wallet.publish(result.wallet);
      play("coins");
      toast(leagueClaimedToast(result.rewards));
      onClaimed();
    } catch {
      setRefusal("La récompense n'a pas été prise. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  if (climb !== null) {
    return (
      <ClimbScene
        key={climb.week}
        climb={climb}
        busy={busy}
        refusal={refusal}
        onClaim={() => void claim()}
      />
    );
  }
  return (
    <Leaf style={pieces.leaf}>
      <LeafKicker>{CLIMB_KICKER}</LeafKicker>
      <View style={styles.claimText}>
        <ToyIcon name={next.icon === "ecu" ? "ecu" : "sachet"} size={34} />
        <View style={styles.claimWords}>
          <Text style={styles.claimTitle}>{next.title}</Text>
          <Text style={styles.claimDetail}>{next.detail}</Text>
          {next.more !== null && <Text style={styles.claimMore}>{next.more}</Text>}
        </View>
      </View>
      <View style={pieces.actions}>
        <MainAction
          label={busy ? LEAGUE_CLAIM_BUSY : LEAGUE_CLAIM}
          disabled={busy}
          onPress={() => void claim()}
        />
      </View>
      <Notice>{refusal}</Notice>
    </Leaf>
  );
}

type BoardState =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly board: BoardResponse; readonly more: boolean };

function Boards({
  league,
  onMine,
}: {
  readonly league: LeagueResponse;
  /** The player's own line of the group, held at the foot of the screen; `null` elsewhere. */
  readonly onMine: (line: BoardLine | null) => void;
}) {
  const [tab, setTab] = useState<Board>("group");
  const [shown, setShown] = useState<BoardState>({ state: "loading" });
  const tabs = BOARDS.filter((entry) => entry.id !== "general" || league.generalOpen);

  const load = useCallback((board: Board) => {
    setShown({ state: "loading" });
    api
      .fetchJoustBoard(board)
      .then((page) => setShown({ state: "ready", board: page, more: false }))
      .catch(() => setShown({ state: "failed" }));
  }, []);
  useEffect(() => load(tab), [load, tab]);
  useEffect(() => {
    const group = shown.state === "ready" && shown.board.board === "group" ? shown.board : null;
    // The player's line alone: the one the board pins under a page that does not show them.
    onMine(group === null ? null : boardLines({ ...group, entries: [] }).pinned);
  }, [shown, onMine]);

  const more = async () => {
    if (shown.state !== "ready" || shown.board.next === null) return;
    setShown({ ...shown, more: true });
    try {
      const page = await api.fetchJoustBoard(shown.board.board, shown.board.next);
      setShown({
        state: "ready",
        more: false,
        board: { ...page, entries: [...shown.board.entries, ...page.entries] },
      });
    } catch {
      setShown({ ...shown, more: false });
    }
  };

  return (
    <Leaf style={pieces.leaf}>
      <LeafKicker>
        {shown.state === "ready" && shown.board.league !== null
          ? `${MY_GROUP} · ${LEAGUE_NAMES[shown.board.league]}`
          : CLASSEMENT}
      </LeafKicker>
      <Segmented
        options={tabs.map((entry) => ({ value: entry.id, label: entry.label }))}
        value={tab}
        onChange={setTab}
      />
      {shown.state === "failed" && (
        <>
          <Paragraph muted>Le classement n'a pas pu être chargé.</Paragraph>
          <Button label="Réessayer" secondary onPress={() => load(tab)} />
        </>
      )}
      {shown.state === "ready" && shown.board.closed === null && (
        <>
          <BoardTable board={shown.board} />
          {shown.board.next !== null && (
            <View style={pieces.actions}>
              <MainAction
                label={shown.more ? "Chargement…" : "Voir la suite"}
                disabled={shown.more}
                onPress={() => void more()}
              />
            </View>
          )}
        </>
      )}
      {shown.state === "ready" && <Text style={pieces.line}>{boardNote(shown.board)}</Text>}
    </Leaf>
  );
}

/**
 * The lines of a board. In the group, as in Duolingo: the zones that go up and down in their
 * colour, and a line where each ends.
 */
function BoardTable({ board }: { readonly board: BoardResponse }) {
  const { lines, pinned } = boardLines(board);
  const group = board.board === "group";
  const zones = group ? zoneStarts(lines) : { stay: null, down: null };
  return (
    <View style={styles.standings}>
      {lines.map((line, index) => (
        <Fragment key={line.key}>
          {line.key === zones.stay && <ZoneLine move="up">{ZONE_UP}</ZoneLine>}
          {line.key === zones.down && <ZoneLine move="down">{ZONE_DOWN}</ZoneLine>}
          {group ? (
            <GroupRow line={line} zoned />
          ) : (
            <Standing line={line} entry={board.entries[index]} />
          )}
        </Fragment>
      ))}
      {pinned !== null && board.me !== null && !group && (
        <Standing line={pinned} entry={board.me} pinned />
      )}
    </View>
  );
}

/** A line of another board: friends, clan, every league, each with their league's crest. */
function Standing({
  line,
  entry,
  pinned = false,
}: {
  readonly line: BoardLine;
  /** The entry the line was made from, for its spoken label. */
  readonly entry: BoardEntry | undefined;
  readonly pinned?: boolean;
}) {
  const label =
    entry === undefined
      ? undefined
      : [placeText(entry.place), line.name, line.tag, pointsText(entry.points)]
          .filter((part) => part !== null)
          .join(", ");
  return (
    <View
      style={[styles.standing, line.me && styles.standingMe, pinned && styles.pinned]}
      accessible
      {...(label === undefined ? {} : { accessibilityLabel: label })}
    >
      <View style={[styles.place, line.podium && styles.podium]}>
        <Text style={styles.placeText}>{line.place}</Text>
      </View>
      {line.player !== null ? (
        <Avatar avatar={line.player.avatar} frame={line.player.frame} size={34} />
      ) : (
        <View style={[styles.portrait, line.kind === "bot" && styles.automaton]}>
          {line.kind === "bot" && <ToyIcon name="jousts" size={22} />}
        </View>
      )}
      <View style={styles.standingName}>
        <Text style={styles.nameText} numberOfLines={1}>
          {line.name}
        </Text>
        {line.tag !== null && <Text style={styles.tag}>{line.tag}</Text>}
        {line.champion && <Emblem>Champion</Emblem>}
      </View>
      <Crest league={line.league} size={26} />
      <Text style={styles.standingPoints}>{line.points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: space.s8 },
  record: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  claimText: { flexDirection: "row", alignItems: "center", gap: space.s4, alignSelf: "stretch" },
  claimWords: { flex: 1, gap: space.s1 },
  claimTitle: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  claimDetail: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInk },
  claimMore: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  standings: { gap: space.s3 },
  standing: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    minHeight: 52,
    paddingHorizontal: space.s3,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: ink.rule,
    backgroundColor: ink.pageRaised,
  },
  standingMe: {
    borderColor: toyMatters.blue.bottom,
    backgroundColor: alpha(toyMatters.blue.top, 0.18),
  },
  pinned: { marginTop: space.s4 },
  place: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  podium: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.gold.top,
  },
  portrait: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 2,
    borderColor: ink.rule,
    backgroundColor: alpha(ink.pageInk, 0.08),
  },
  automaton: { borderColor: toyMatters.locked.edge, backgroundColor: toyMatters.locked.top },
  placeText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
  standingName: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.s2,
  },
  nameText: {
    flexShrink: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    color: ink.pageInk,
  },
  tag: { fontFamily: fonts.ui.medium, fontSize: fontSizes.micro, color: ink.pageInkMuted },
  standingPoints: {
    minWidth: 40,
    textAlign: "right",
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: ink.pageInk,
  },
});
