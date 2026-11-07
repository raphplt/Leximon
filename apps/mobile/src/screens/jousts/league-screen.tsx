import type { Board, BoardEntry, BoardResponse, LeagueResponse } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  BOARDS,
  boardNote,
  CLASSEMENT,
  divisionNumeral,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  leagueClaimedToast,
  leagueClaimRefusalText,
  meOutsidePage,
  playerName,
  ROAD_RULE,
  ROAD_TITLE,
  ratingLine,
  roadStops,
  SEASON_END_KICKER,
  SEASON_RULE,
  seasonRecord,
  seasonRewardLines,
  waitingReward,
} from "@leximon/view-model";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { api } from "@/api/client";
import { MainAction } from "@/library/play-pieces";
import { wallet } from "@/player/state";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { Segmented } from "@/ui/segmented";
import { toast } from "@/ui/toast";
import { Leaf, Lettering, ToyIcon } from "@/ui/toy";
import { Emblem, LeagueHeader, Shield } from "./league-pieces";
import { ink, LeafKicker, Notice, pieces } from "./pieces";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly league: LeagueResponse };

const rise = (index: number) => FadeInUp.delay(index * 90).duration(320);

/** The leagues: where the player stands, the road of the season, its rewards and the boards. */
export function LeagueScreen() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
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
    <Page title={CLASSEMENT}>
      <View style={styles.screen}>
        <Animated.View entering={rise(0)}>
          <Leaf style={pieces.leaf}>
            <LeagueHeader standing={league.standing} today={gameDayOf(Date.now()).key} />
            <ClaimBox league={league} onClaimed={load} />
            <Road league={league} />
          </Leaf>
        </Animated.View>
        <Animated.View entering={rise(1)}>
          <Boards league={league} />
        </Animated.View>
        <Animated.View entering={rise(2)}>
          <Leaf style={pieces.leaf}>
            <LeafKicker>Tes joutes classées</LeafKicker>
            <Text style={styles.record}>{seasonRecord(league.stats)}</Text>
            <Text style={pieces.line}>{ratingLine(league.stats)}</Text>
          </Leaf>
        </Animated.View>
      </View>
    </Page>
  );
}

/** The oldest reward waiting, with its button. */
function ClaimBox({
  league,
  onClaimed,
}: {
  readonly league: LeagueResponse;
  readonly onClaimed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const next = waitingReward(league);
  if (next === null) return null;

  const claim = async () => {
    setBusy(true);
    setRefusal(null);
    try {
      const result = await api.claimLeagueReward(next.season, next.step);
      if (result.kind === "refused") {
        setRefusal(leagueClaimRefusalText(result.reason));
        return;
      }
      wallet.publish(result.wallet);
      toast(leagueClaimedToast(result.rewards));
      onClaimed();
    } catch {
      setRefusal("La récompense n'a pas été prise. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.claim}>
      <View style={styles.claimText}>
        <ToyIcon name={next.icon === "ecu" ? "ecu" : "sachet"} size={30} />
        <View style={styles.claimWords}>
          <Text style={styles.claimTitle}>{next.title}</Text>
          {next.more !== null && <Text style={styles.claimMore}>{next.more}</Text>}
        </View>
      </View>
      <Button
        label={busy ? LEAGUE_CLAIM_BUSY : LEAGUE_CLAIM}
        disabled={busy}
        onPress={() => void claim()}
      />
      <Notice>{refusal}</Notice>
    </View>
  );
}

const STOP_WIDTH = 92;

function Road({ league }: { readonly league: LeagueResponse }) {
  const tray = useRef<ScrollViewInstance>(null);
  const [trayWidth, setTrayWidth] = useState(0);
  const stops = roadStops(league);
  const here = stops.findIndex((stop) => stop.here);
  useEffect(() => {
    if (trayWidth === 0 || here < 0) return;
    tray.current?.scrollTo({
      x: Math.max(0, here * STOP_WIDTH - trayWidth / 2 + STOP_WIDTH / 2),
      animated: false,
    });
  }, [trayWidth, here]);

  return (
    <>
      <Lettering size={fontSizes.subtitle}>{ROAD_TITLE}</Lettering>
      <ScrollView
        ref={tray}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setTrayWidth(event.nativeEvent.layout.width)}
        contentContainerStyle={styles.road}
      >
        {stops.map((stop) => (
          <View
            key={stop.key}
            style={[styles.stop, stop.here && styles.stopHere]}
            accessible
            accessibilityLabel={stop.label}
          >
            <View style={[styles.stopShield, !stop.reached && styles.later]}>
              <Shield league={stop.league} numeral={stop.numeral} size={stop.here ? 50 : 38} />
            </View>
            <Text style={styles.stopName} numberOfLines={1}>
              {stop.name}
            </Text>
            <Text style={styles.stopFrom}>{stop.from}</Text>
            <View style={[styles.stopReward, stop.status === "waiting" && styles.stopWaiting]}>
              {stop.short === null ? (
                <Text style={styles.stopRewardText}>Départ</Text>
              ) : (
                <>
                  <ToyIcon name={stop.icon === "ecu" ? "ecu" : "sachet"} size={16} />
                  <Text style={styles.stopRewardText}>{stop.short}</Text>
                </>
              )}
              {stop.status === "claimed" && (
                <Icon name="check" size={12} color={toyMatters.green.bottom} />
              )}
            </View>
            {stop.here && (
              <View style={styles.you}>
                <Text style={styles.youText}>{league.standing.laurels}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <Text style={pieces.line}>{ROAD_RULE}</Text>
      <View style={styles.endRewards}>
        <LeafKicker>{SEASON_END_KICKER}</LeafKicker>
        {seasonRewardLines(league).map((line) => (
          <View key={line.league} style={[styles.endLine, line.here && styles.endLineHere]}>
            <Shield
              league={line.league}
              numeral={line.league === "champion" ? null : "I"}
              size={24}
            />
            <Text style={styles.endName}>{line.name}</Text>
            <Text style={styles.endReward}>{line.reward}</Text>
          </View>
        ))}
        <Text style={pieces.line}>{SEASON_RULE}</Text>
      </View>
    </>
  );
}

type BoardState =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly board: BoardResponse; readonly more: boolean };

function Boards({ league }: { readonly league: LeagueResponse }) {
  const [tab, setTab] = useState<Board>("league");
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
      <Lettering size={fontSizes.subtitle}>{CLASSEMENT}</Lettering>
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
      {shown.state === "ready" && (
        <>
          <View style={styles.standings}>
            {shown.board.entries.map((entry) => (
              <Standing
                key={entry.player.code}
                entry={entry}
                me={entry.player.code === shown.board.me.player.code}
              />
            ))}
            {meOutsidePage(shown.board) && <Standing entry={shown.board.me} me pinned />}
          </View>
          {shown.board.next !== null && (
            <View style={pieces.actions}>
              <MainAction
                label={shown.more ? "Chargement…" : "Voir la suite"}
                disabled={shown.more}
                onPress={() => void more()}
              />
            </View>
          )}
          <Text style={pieces.line}>{boardNote(shown.board)}</Text>
        </>
      )}
    </Leaf>
  );
}

function Standing({
  entry,
  me,
  pinned = false,
}: {
  readonly entry: BoardEntry;
  readonly me: boolean;
  readonly pinned?: boolean;
}) {
  const name = playerName(entry.player);
  const podium = entry.place <= 3;
  return (
    <View style={[styles.standing, me && styles.standingMe, pinned && styles.pinned]}>
      <View style={[styles.place, podium && styles.podium]}>
        <Text style={styles.placeText}>{entry.place}</Text>
      </View>
      <Avatar avatar={entry.player.avatar} frame={entry.player.frame} size={34} />
      <View style={styles.standingName}>
        <Text style={styles.nameText} numberOfLines={1}>
          {me ? `${name} (toi)` : name}
        </Text>
        {entry.champion && <Emblem>Champion</Emblem>}
      </View>
      <Shield league={entry.division.league} numeral={divisionNumeral(entry.division)} size={22} />
      <Text style={styles.standingLaurels}>{entry.laurels}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: space.s8 },
  record: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  claim: {
    gap: space.s4,
    alignItems: "center",
    padding: space.s5,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: toyMatters.gold.edge,
    backgroundColor: alpha(toyMatters.gold.top, 0.35),
  },
  claimText: { flexDirection: "row", alignItems: "center", gap: space.s4, alignSelf: "stretch" },
  claimWords: { flex: 1, gap: space.s1 },
  claimTitle: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  claimMore: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  road: { alignItems: "flex-end", paddingVertical: space.s4 },
  stop: { width: STOP_WIDTH, alignItems: "center", gap: space.s1, paddingBottom: space.s2 },
  stopHere: { paddingBottom: space.s10 },
  stopShield: { minHeight: 58, justifyContent: "flex-end" },
  later: { opacity: 0.55 },
  stopName: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
  stopFrom: { fontFamily: fonts.ui.medium, fontSize: fontSizes.micro, color: ink.pageInkMuted },
  stopReward: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s1,
    paddingHorizontal: space.s3,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: ink.pageRaised,
  },
  stopWaiting: {
    backgroundColor: toyMatters.gold.top,
    borderWidth: 2,
    borderColor: toyValues.outline,
  },
  stopRewardText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.micro, color: ink.pageInk },
  you: {
    position: "absolute",
    bottom: 0,
    paddingHorizontal: space.s3,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.blue.bottom,
  },
  youText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    color: toyMatters.paper.top,
  },
  endRewards: { gap: space.s3 },
  endLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radii.md,
  },
  endLineHere: { backgroundColor: alpha(toyMatters.gold.top, 0.4) },
  endName: {
    width: 82,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    color: ink.pageInk,
  },
  endReward: {
    flex: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: ink.pageInk,
  },
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
  standingLaurels: {
    minWidth: 40,
    textAlign: "right",
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: ink.pageInk,
  },
});
