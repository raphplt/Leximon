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
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import styles from "./profile.module.css";
import { PinnedCards, ProfileHeader, StatsPanel } from "./profile-view";
import { PseudoDialog } from "./pseudo-dialog";

/** The player's own profile, also before others can see it. */
export function ProfileScreen() {
  const me = useShared(profile);
  const { openCard } = useShell();
  const toast = useToast();
  const [choosing, setChoosing] = useState(false);

  if (me === null) {
    return (
      <main className={styles.page}>
        <div className={styles.banner}>
          <div className={styles.bannerArt} />
        </div>
      </main>
    );
  }

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
              Atelier
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
        <p className={styles.note}>
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
          <PinnedCards pinned={me.pinned} slots={me.pinnedSlots} onOpen={openCard} />
        ) : (
          <section className={styles.panel}>
            <p className={styles.muted}>
              Avec un compte, tu épingles tes plus belles cartes ici.{" "}
              <Link href="/compte">C'est par là.</Link>
            </p>
          </section>
        )}
        <StatsPanel stats={me.stats} />
      </div>
      <PseudoDialog open={choosing} onClose={() => setChoosing(false)} />
    </main>
  );
}
