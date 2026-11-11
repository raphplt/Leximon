import type {
  BoardResponse,
  JoustDeckResponse,
  JoustsResponse,
  LeagueResponse,
  PlayerBadge,
} from "@leximon/contract";
import {
  accessText,
  JOUSTS_TITLE,
  LAUNCH_FRIENDLY,
  NO_FRIENDS_TO_DEFY,
  playerName,
  runSize,
} from "@leximon/view-model";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { useShared } from "@/player/shared";
import { joustsOverview, profile } from "@/player/state";
import { ChallengeHalves } from "@/screens/challenges/challenge-halves";
import { fontSizes, fonts, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { FormError, Page, Paragraph } from "@/ui/page";
import { Sheet } from "@/ui/sheet";
import { ParticleStage } from "@/ui/stage";
import { Leaf } from "@/ui/toy";
import { Guide } from "./guide";
import { Hall } from "./hall";
import { ink, pieces } from "./pieces";
import { NO_ANSWER, useLaunch } from "./use-launch";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly jousts: JoustsResponse; readonly deck: JoustDeckResponse };

/** The league's ladder and the player's group, read after the jousts: the hall shows without them. */
interface Ladder {
  readonly league: LeagueResponse;
  readonly group: BoardResponse | null;
}

/** The jousts' hall: the first visit, then the lice, the road of the leagues, the jousts and the deck. */
export function JoustsScreen() {
  return (
    <ParticleStage>
      <JoustsHall />
    </ParticleStage>
  );
}

function JoustsHall() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const me = useShared(profile);
  const opensAt = loaded.state === "ready" ? loaded.jousts.opensAtLevel : 0;
  const { launch, busy, refusal } = useLaunch(opensAt);

  const load = useCallback(() => {
    Promise.all([api.fetchJousts(), api.fetchJoustDeck()])
      .then(([jousts, deck]) => {
        setLoaded({ state: "ready", jousts, deck });
        joustsOverview.publish(jousts);
        if (jousts.access !== "open") return;
        api
          .fetchJoustLeague()
          .then(async (league) => {
            const group =
              league.standing.group === null ? null : await api.fetchJoustBoard("group");
            setLadder({ league, group });
          })
          .catch(() => undefined);
      })
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  // Read again on each return from a joust: its row moved, and the guide closed if it launched it.
  useFocusEffect(
    useCallback(() => {
      setGuideOpen(false);
      load();
    }, [load]),
  );

  if (loaded.state !== "ready") {
    return (
      <Page title={JOUSTS_TITLE}>
        <ChallengeHalves current="jousts" />
        {loaded.state === "loading" && <Paragraph muted>Un instant…</Paragraph>}
        {loaded.state === "failed" && (
          <>
            <Paragraph muted>Les joutes n'ont pas pu être chargées. Réessaie.</Paragraph>
            <Button label="Réessayer" secondary onPress={load} />
          </>
        )}
      </Page>
    );
  }
  const { jousts, deck } = loaded;
  const closed = accessText(jousts.access, jousts.opensAtLevel);

  if (closed !== null) {
    return (
      <Page title={JOUSTS_TITLE}>
        <ChallengeHalves current="jousts" />
        <Leaf style={[pieces.leaf, pieces.illuminated]}>
          <Text style={pieces.line}>{closed}</Text>
          {jousts.access === "account_required" && (
            <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
          )}
          {jousts.access === "pseudo_required" && (
            <Button label="Choisir mon pseudo" onPress={() => router.push("/profil")} />
          )}
        </Leaf>
      </Page>
    );
  }

  const closeGuide = () => {
    setGuideOpen(false);
    // Shown once: the server keeps it done, for the web and the phone.
    api
      .markJoustGuideDone()
      .catch(() => undefined)
      .finally(load);
  };

  if (!jousts.guideDone || guideOpen) {
    return (
      <Page title={JOUSTS_TITLE}>
        <Guide
          deck={deck}
          deckSaved={jousts.deckSaved}
          size={runSize(Date.now())}
          me={{ name: me?.pseudo ?? "Toi", avatar: me?.avatar ?? null, frame: me?.frame ?? null }}
          busy={busy}
          refusal={refusal}
          onDeckSaved={load}
          onLaunch={() => {
            api.markJoustGuideDone().catch(() => undefined);
            void launch({ kind: "ranked" });
          }}
          onClose={closeGuide}
        />
      </Page>
    );
  }

  return (
    <Page title={JOUSTS_TITLE}>
      <ChallengeHalves current="jousts" />
      <Hall
        jousts={jousts}
        deck={deck}
        league={ladder?.league ?? null}
        group={ladder?.group ?? null}
        busy={busy}
        refusal={refusal}
        onLaunch={(request) => void launch(request)}
        onFriends={() => setFriendsOpen(true)}
        onGuide={() => setGuideOpen(true)}
        onDeckSaved={load}
      />
      <FriendsSheet
        open={friendsOpen}
        busy={busy}
        onClose={() => setFriendsOpen(false)}
        onPick={(code) => {
          setFriendsOpen(false);
          void launch({ kind: "friendly", opponentCode: code });
        }}
      />
    </Page>
  );
}

function FriendsSheet({
  open,
  busy,
  onClose,
  onPick,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onPick: (code: string) => void;
}) {
  const [players, setPlayers] = useState<readonly PlayerBadge[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    setFailed(false);
    api
      .fetchJoustOpponents()
      .then((response) => setPlayers(response.players))
      .catch(() => setFailed(true));
  }, [open]);

  return (
    <Sheet open={open} title={LAUNCH_FRIENDLY} onClose={onClose}>
      <FormError message={failed ? NO_ANSWER : null} />
      {players !== null && players.length === 0 && (
        <Text style={pieces.line}>{NO_FRIENDS_TO_DEFY}</Text>
      )}
      {players?.map((player) => (
        <View key={player.code} style={styles.friendRow}>
          <Avatar avatar={player.avatar} frame={player.frame} size={40} />
          <Text style={[styles.rowName, styles.rowText]} numberOfLines={1}>
            {playerName(player)}
          </Text>
          <Button label="Défier" small disabled={busy} onPress={() => onPick(player.code)} />
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rowText: { flex: 1 },
  rowName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  friendRow: { flexDirection: "row", alignItems: "center", gap: space.s6, minHeight: 52 },
});
