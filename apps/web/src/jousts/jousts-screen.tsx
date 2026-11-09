"use client";

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
import { useCallback, useEffect, useState } from "react";
import { ChallengeHalves } from "@/challenges/challenge-halves";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { joustsOverview } from "@/player/jousts";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button, ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { LoadFailed } from "@/ui/load-failed";
import { ParticleStage } from "@/ui/stage";
import { Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import { Guide } from "./guide";
import { Hall } from "./hall";
import styles from "./jousts.module.css";
import { useLaunch } from "./use-launch";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly jousts: JoustsResponse; readonly deck: JoustDeckResponse };

/** What the hall shows beside the jousts, loaded after them: the ladder and the week's group. */
interface Ladder {
  readonly league: LeagueResponse | null;
  readonly group: BoardResponse | null;
}

/** The jousts' hall: the first visit, then « Joute classée », the deck and the player's jousts. */
export function JoustsScreen() {
  return (
    <ParticleStage>
      <JoustsHall />
    </ParticleStage>
  );
}

function JoustsHall() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [guideOpen, setGuideOpen] = useState(false);
  const me = useShared(profile);
  const opensAt = loaded.state === "ready" ? loaded.jousts.opensAtLevel : 0;
  const { launch, busy, refusal } = useLaunch(opensAt);

  const [ladder, setLadder] = useState<Ladder>({ league: null, group: null });

  const load = useCallback(() => {
    Promise.all([api.fetchJousts(), api.fetchJoustDeck()])
      .then(([jousts, deck]) => {
        setLoaded({ state: "ready", jousts, deck });
        joustsOverview.publish(jousts);
        if (jousts.access !== "open") return;
        // The hall stands without them: a failure leaves the road without its écus.
        Promise.all([
          api.fetchJoustLeague(),
          jousts.standing.group === null ? null : api.fetchJoustBoard("group"),
        ])
          .then(([league, group]) => setLadder({ league, group }))
          .catch(() => undefined);
      })
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);
  const [friendsOpen, setFriendsOpen] = useState(false);

  if (loaded.state === "failed") {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={load} />
      </main>
    );
  }
  if (loaded.state === "loading") {
    return (
      <main className={`${styles.page} ${styles.hallPage}`}>
        <ChallengeHalves current="jousts" />
      </main>
    );
  }
  const { jousts, deck } = loaded;
  const closed = accessText(jousts.access, jousts.opensAtLevel);

  if (closed !== null) {
    return (
      <main className={`${styles.page} ${styles.hallPage}`}>
        <ChallengeHalves current="jousts" />
        <section className={`${ui.leaf} ${styles.closed}`}>
          <Lettering className={styles.homeTitle}>{JOUSTS_TITLE}</Lettering>
          <p className={styles.line}>{closed}</p>
          {jousts.access === "account_required" && (
            <ButtonLink href="/compte">Créer mon compte</ButtonLink>
          )}
          {jousts.access === "pseudo_required" && (
            <ButtonLink href="/profil">Choisir mon pseudo</ButtonLink>
          )}
        </section>
      </main>
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
      <main className={styles.page}>
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
      </main>
    );
  }

  return (
    <main className={`${styles.page} ${styles.hallPage}`}>
      <ChallengeHalves current="jousts" />
      <Hall
        jousts={jousts}
        deck={deck}
        league={ladder.league}
        group={ladder.group}
        busy={busy}
        refusal={refusal}
        onLaunch={(request) => void launch(request)}
        onFriends={() => setFriendsOpen(true)}
        onGuide={() => setGuideOpen(true)}
        onDeckSaved={load}
      />
      <FriendsDialog
        open={friendsOpen}
        busy={busy}
        onClose={() => setFriendsOpen(false)}
        onPick={(code) => {
          setFriendsOpen(false);
          void launch({ kind: "friendly", opponentCode: code });
        }}
      />
    </main>
  );
}

function FriendsDialog({
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
    <Dialog open={open} title={LAUNCH_FRIENDLY} onClose={onClose}>
      <div className={styles.friends}>
        {failed && <p className={styles.notice}>Le serveur ne répond pas. Réessaie.</p>}
        {players !== null && players.length === 0 && (
          <p className={styles.line}>{NO_FRIENDS_TO_DEFY}</p>
        )}
        {players !== null && players.length > 0 && (
          <ul className={styles.rows}>
            {players.map((player) => (
              <li key={player.code} className={styles.friendRow}>
                <Avatar avatar={player.avatar} frame={player.frame} size={40} />
                <span className={styles.rowName}>{playerName(player)}</span>
                <Button small disabled={busy} onClick={() => onPick(player.code)}>
                  Défier
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
