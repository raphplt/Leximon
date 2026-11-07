import type { Board, BoardEntry, BoardResponse, LeagueResponse } from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  BOARDS,
  type BoardLine,
  boardLines,
  boardNote,
  CLASSEMENT,
  LADDER_TITLE,
  LEAGUE_CLAIM,
  LEAGUE_CLAIM_BUSY,
  ladderRules,
  ladderSteps,
  leagueClaimedToast,
  leagueClaimRefusalText,
  leagueNumeral,
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
import { MainAction } from "@/library/play-pieces";
import { wallet } from "@/player/state";
import { alpha, fontSizes, fonts, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Page, Paragraph } from "@/ui/page";
import { Segmented } from "@/ui/segmented";
import { toast } from "@/ui/toast";
import { Leaf, Lettering, ToyIcon } from "@/ui/toy";
import { Emblem, LeagueHeader, MOVE_COLORS, Shield } from "./league-pieces";
import { ink, LeafKicker, Notice, pieces } from "./pieces";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly league: LeagueResponse };

const rise = (index: number) => FadeInUp.delay(index * 90).duration(320);

/** The leagues: where the player stands this week, the rewards to claim, the ladder, the boards. */
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
            <Ladder league={league} />
          </Leaf>
        </Animated.View>
        <Animated.View entering={rise(1)}>
          <Boards league={league} />
        </Animated.View>
        <Animated.View entering={rise(2)}>
          <Leaf style={pieces.leaf}>
            <LeafKicker>Tes joutes classées</LeafKicker>
            <Text style={styles.record}>{weekRecord(league.stats)}</Text>
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
      const result = await api.claimLeagueReward(next.week);
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
          <Text style={styles.claimDetail}>{next.detail}</Text>
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

/** Every league, highest first, the player's own picked out, and how the tournament works. */
function Ladder({ league }: { readonly league: LeagueResponse }) {
  return (
    <>
      <Lettering size={fontSizes.subtitle}>{LADDER_TITLE}</Lettering>
      <View style={styles.ladder}>
        {ladderSteps(league).map((step) => (
          <View
            key={step.league}
            style={[styles.step, step.here && styles.stepHere]}
            accessible
            accessibilityLabel={step.label}
          >
            <Shield
              league={step.league}
              numeral={leagueNumeral(step.league)}
              size={step.here ? 40 : 32}
            />
            <View style={styles.stepText}>
              <Text style={styles.stepName}>{step.name}</Text>
              <Text style={styles.stepMoves}>{step.moves}</Text>
              <Text style={styles.stepReward}>{step.reward}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.rules}>
        {ladderRules(league).map((rule) => (
          <View key={rule} style={styles.rule}>
            <View style={styles.bullet} />
            <Text style={[pieces.line, styles.ruleText]}>{rule}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

type BoardState =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly board: BoardResponse; readonly more: boolean };

function Boards({ league }: { readonly league: LeagueResponse }) {
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

/** The lines of a board; the group's split into the places that go up, stay and go down. */
function BoardTable({ board }: { readonly board: BoardResponse }) {
  const { lines, pinned } = boardLines(board);
  const group = board.board === "group";
  const zones = group ? zoneStarts(lines) : { stay: null, down: null };
  return (
    <View style={styles.standings}>
      {group && lines[0]?.move === "up" && <ZoneRule label={ZONE_UP} color={MOVE_COLORS.up} />}
      {lines.map((line, index) => (
        <Fragment key={line.key}>
          {line.key === zones.stay && <View style={styles.zoneBreak} />}
          {line.key === zones.down && <ZoneRule label={ZONE_DOWN} color={MOVE_COLORS.down} />}
          <Standing line={line} entry={board.entries[index]} shield={!group} />
        </Fragment>
      ))}
      {pinned !== null && board.me !== null && (
        <Standing line={pinned} entry={board.me} shield={!group} pinned />
      )}
    </View>
  );
}

function ZoneRule({ label, color }: { readonly label: string; readonly color: string }) {
  return (
    <View style={styles.zone} accessibilityRole="header">
      <View style={[styles.zoneLine, { backgroundColor: color }]} />
      <Text style={[styles.zoneText, { color }]}>{label}</Text>
      <View style={[styles.zoneLine, { backgroundColor: color }]} />
    </View>
  );
}

function Standing({
  line,
  entry,
  shield,
  pinned = false,
}: {
  readonly line: BoardLine;
  /** The entry the line was made from, for its spoken label. */
  readonly entry: BoardEntry | undefined;
  readonly shield: boolean;
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
      style={[
        styles.standing,
        line.move === "up" && styles.standingUp,
        line.move === "down" && styles.standingDown,
        line.me && styles.standingMe,
        pinned && styles.pinned,
      ]}
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
      {shield && <Shield league={line.league} numeral={leagueNumeral(line.league)} size={22} />}
      <Text style={styles.standingPoints}>{line.points}</Text>
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
  claimDetail: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInk },
  claimMore: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  ladder: { gap: space.s2 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  stepHere: {
    borderColor: toyMatters.gold.edge,
    backgroundColor: alpha(toyMatters.gold.top, 0.4),
  },
  stepText: { flex: 1, gap: 2 },
  stepName: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  stepMoves: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  stepReward: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInk },
  rules: { gap: space.s3 },
  rule: { flexDirection: "row", alignItems: "flex-start", gap: space.s4 },
  ruleText: { flex: 1 },
  bullet: {
    width: 7,
    height: 7,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: ink.rubric,
    borderWidth: 1,
    borderColor: toyValues.outline,
  },
  zone: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  zoneLine: { flex: 1, height: 2, borderRadius: 1, opacity: 0.6 },
  zoneText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.micro, letterSpacing: 1 },
  zoneBreak: { height: 2, marginVertical: space.s1, backgroundColor: ink.rule },
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
  standingUp: { backgroundColor: alpha(toyMatters.green.top, 0.14) },
  standingDown: { backgroundColor: alpha(toyMatters.red.top, 0.12) },
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
