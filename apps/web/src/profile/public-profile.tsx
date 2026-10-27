"use client";

import type { ProfileResponse, PublicProfile } from "@leximon/contract";
import {
  BLOCK_CONFIRM,
  BLOCKED_NOTE,
  BLOCKED_TOAST,
  blockRefusalMessage,
  friendRefusalText,
  PROFILE_NOT_FOUND,
  REPORTED_TOAST,
  requestSentToast,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { ToastProvider, useToast } from "@/ui/toast";
import styles from "./profile.module.css";
import { PinnedCards, type ProfileFace, ProfileHeader, StatsPanel } from "./profile-view";
import { failureMessage } from "./use-profile-actions";

/**
 * Someone's profile, as the server rendered it for everyone. A signed-in viewer reads
 * it again with their session, which hides it when either blocked the other, and gets the actions.
 */
export function PublicProfileScreen({
  pseudo,
  initial,
}: {
  readonly pseudo: string;
  readonly initial: PublicProfile | null;
}) {
  return (
    <ToastProvider>
      <PublicProfileBody pseudo={pseudo} initial={initial} />
    </ToastProvider>
  );
}

function PublicProfileBody({
  pseudo,
  initial,
}: {
  readonly pseudo: string;
  readonly initial: PublicProfile | null;
}) {
  const [shown, setShown] = useState(initial);
  const [blocked, setBlockedHere] = useState(false);
  // `undefined` until known: neither the visitor's invitation nor the actions flash by.
  const [viewer, setViewer] = useState<ProfileResponse | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchProfileIfSignedIn()
      .then(async (me) => {
        if (cancelled) return;
        setViewer(me);
        if (me === null) return;
        const seen = await api.fetchPublicProfile(pseudo);
        if (!cancelled) setShown(seen);
      })
      .catch(() => {
        // The copy everyone sees stays, without the actions.
        if (!cancelled) setViewer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pseudo]);

  if (blocked) return <p className={styles.note}>{BLOCKED_NOTE}</p>;
  if (shown === null) {
    return (
      <div className={styles.note}>
        <span>{PROFILE_NOT_FOUND}</span>
        <ButtonLink href="/jouer" small>
          Jouer à Leximon
        </ButtonLink>
      </div>
    );
  }

  const face: ProfileFace =
    shown.visibility === "public"
      ? {
          name: shown.pseudo,
          avatar: shown.avatar,
          frame: shown.frame,
          title: shown.title,
          level: shown.level,
          code: shown.code,
          memberSince: shown.memberSince,
          clan: shown.clan,
        }
      : {
          name: shown.pseudo,
          avatar: shown.avatar,
          frame: shown.frame,
          title: null,
          level: 1,
          code: null,
          memberSince: null,
          clan: null,
        };
  const own = viewer != null && shown.visibility === "public" && viewer.playerCode === shown.code;

  return (
    <>
      <ProfileHeader face={face} />
      {viewer === undefined ? null : own ? (
        <p className={styles.note}>
          Tu vois ton profil comme les autres le voient.
          <ButtonLink href="/profil" small variant="secondary">
            Mon profil
          </ButtonLink>
        </p>
      ) : viewer === null ? (
        <p className={styles.note}>
          Leximon, le jeu de cartes des mots rares et oubliés du français.
          <ButtonLink href="/jouer" small>
            Jouer à Leximon
          </ButtonLink>
        </p>
      ) : (
        <ViewerActions
          // The viewer's own copy of the profile comes after the shared one, with the friendship.
          key={shown.friendship ?? "unknown"}
          profile={shown}
          viewer={viewer}
          onBlocked={() => setBlockedHere(true)}
        />
      )}
      {shown.visibility === "public" ? (
        <div className={styles.layout}>
          <PinnedCards pinned={shown.pinned} />
          <StatsPanel stats={shown.stats} />
        </div>
      ) : (
        <p className={styles.note}>
          <Icon name="lock" size={18} />
          Profil privé.
        </p>
      )}
    </>
  );
}

/** What a signed-in player can do on someone's profile. */
function ViewerActions({
  profile,
  viewer,
  onBlocked,
}: {
  readonly profile: PublicProfile;
  readonly viewer: ProfileResponse;
  readonly onBlocked: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reported, setReported] = useState(false);
  const [friendship, setFriendship] = useState(profile.friendship ?? null);
  const code = profile.visibility === "public" ? profile.code : null;

  const befriend = async () => {
    setBusy(true);
    try {
      const result = await api.askFriend({ pseudo: profile.pseudo });
      if (result.kind === "refused") {
        toast(friendRefusalText(result.reason));
        return;
      }
      setFriendship(result.value.outcome === "accepted" ? "friends" : "requested");
      toast(requestSentToast(result.value.outcome, result.value.player));
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    setBusy(true);
    try {
      const result = await api.reportPlayer(profile.pseudo);
      if (result.kind === "refused") toast(blockRefusalMessage(result.reason));
      else {
        setReported(true);
        toast(REPORTED_TOAST);
      }
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (code === null) return;
    setBusy(true);
    try {
      const result = await api.setBlocked(code, true);
      if (result.kind === "refused") {
        toast(blockRefusalMessage(result.reason));
        return;
      }
      toast(BLOCKED_TOAST);
      setConfirmBlock(false);
      onBlocked();
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.viewer}>
      {code !== null && (
        <ButtonLink href={`/echanges?avec=${code}`} small>
          <Icon name="echange" size={17} />
          Proposer un échange
        </ButtonLink>
      )}
      {viewer.member && friendship === "none" && (
        <Button variant="secondary" small disabled={busy} onClick={() => void befriend()}>
          <Icon name="amis" size={17} />
          Ajouter en ami
        </Button>
      )}
      {friendship === "requested" && (
        <Button variant="secondary" small disabled>
          Demande envoyée
        </Button>
      )}
      {friendship === "incoming" && (
        <ButtonLink href="/amis" variant="secondary" small>
          <Icon name="amis" size={17} />
          Répondre à sa demande
        </ButtonLink>
      )}
      {friendship === "friends" && (
        <span className={styles.friendTag}>
          <Icon name="amis" size={17} />
          Ami
        </span>
      )}
      {viewer.member && (
        <>
          <Button variant="ghost" small disabled={busy || reported} onClick={() => void report()}>
            <Icon name="flag" size={17} />
            {reported ? "Signalé" : "Signaler le pseudo"}
          </Button>
          {code !== null && (
            <Button
              variant="ghost"
              small
              className={styles.danger}
              disabled={busy}
              onClick={() => setConfirmBlock(true)}
            >
              Bloquer
            </Button>
          )}
        </>
      )}
      <Dialog
        open={confirmBlock}
        title={`Bloquer ${profile.pseudo} ?`}
        onClose={() => setConfirmBlock(false)}
        variant="center"
      >
        <div className={styles.dialogPad}>
          <p className={styles.muted}>{BLOCK_CONFIRM}</p>
          <div className={styles.viewer}>
            <Button disabled={busy} onClick={() => void block()}>
              Bloquer
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmBlock(false)}>
              Annuler
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
