"use client";

import {
  canShareProfile,
  PROFILE_LINK_COPIED,
  playerName,
  profilePath,
  visibilityNote,
} from "@leximon/view-model";
import Link from "next/link";
import { useState } from "react";
import { profile } from "@/player/player";
import { useShared, useSharedFailed } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { Bone, WaitingScreen } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { PinnedCardsEditor } from "./pinned-editor";
import styles from "./profile.module.css";
import { JoustsPanel, ProfileHeader, StatsPanel } from "./profile-view";
import { PseudoDialog } from "./pseudo-dialog";

/** The player's own profile, also before others can see it. */
export function ProfileScreen() {
  const me = useShared(profile);
  const failed = useSharedFailed(profile);
  const { openCard } = useShell();
  const toast = useToast();
  const [choosing, setChoosing] = useState(false);

  if (me === null && failed) {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={() => profile.ensure()} />
      </main>
    );
  }
  if (me === null) return <ProfileWaiting />;

  const share = async () => {
    if (me.pseudo === null) return;
    const url = new URL(profilePath(me.pseudo), window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url, title: `${me.pseudo} sur Leximon` });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast(PROFILE_LINK_COPIED);
    } catch {
      // Sharing cancelled: nothing to say.
    }
  };

  const note = visibilityNote(me);
  const face = {
    name: me.member ? playerName({ code: me.playerCode, pseudo: me.pseudo }) : "Invité",
    avatar: me.avatar,
    frame: me.frame,
    title: me.title,
    level: me.level,
    code: me.playerCode,
    memberSince: me.member ? me.memberSince : null,
    clan: me.clan,
    clanHref: "/clan",
  };

  return (
    <main className={styles.page}>
      <ProfileHeader
        face={face}
        actions={
          <>
            <ButtonLink href="/atelier" variant="secondary" small>
              <Icon name="palette" size={17} />
              Apparence
            </ButtonLink>
            {canShareProfile(me) && (
              <Button variant="secondary" small onClick={() => void share()}>
                <Icon name="share" size={17} />
                Partager
              </Button>
            )}
          </>
        }
      />
      {note !== null && (
        <p className={`${styles.note} ${ui.leaf}`}>
          <Icon name={me.member && me.pseudo !== null ? "lock" : "profil"} size={18} />
          {note}
          {!me.member && (
            <ButtonLink href="/compte" small>
              Créer mon compte
            </ButtonLink>
          )}
          {me.member && me.pseudo === null && (
            <Button small onClick={() => setChoosing(true)}>
              Choisir mon pseudo
            </Button>
          )}
        </p>
      )}
      <div className={styles.layout}>
        {me.member ? (
          <PinnedCardsEditor
            pinned={me.pinned}
            slots={me.pinnedSlots}
            onOpen={(cardId) => openCard(cardId, me.pinned)}
          />
        ) : (
          <section className={`${styles.panel} ${ui.leaf}`}>
            <p className={styles.muted}>
              Avec un compte, tu peux épingler tes plus belles cartes ici.{" "}
              <Link href="/compte">Créer mon compte</Link>
            </p>
          </section>
        )}
        <div className={styles.side}>
          <StatsPanel stats={me.stats} />
          {me.jousts !== null && <JoustsPanel jousts={me.jousts} />}
        </div>
      </div>
      <PseudoDialog open={choosing} onClose={() => setChoosing(false)} />
    </main>
  );
}

/** The banner while the profile arrives: the avatar, the name and the button in their places. */
function ProfileWaiting() {
  return (
    <WaitingScreen className={styles.page}>
      <div className={styles.banner}>
        <div className={styles.bannerArt} />
        <div className={styles.identity}>
          <Bone className={styles.avatarBone} />
          <div className={styles.names}>
            <Bone className={styles.nameBone} />
            <Bone className={styles.headlineBone} />
            <Bone className={styles.sublineBone} />
          </div>
          <div className={styles.actions}>
            <Bone className={styles.actionBone} />
          </div>
        </div>
      </div>
    </WaitingScreen>
  );
}
