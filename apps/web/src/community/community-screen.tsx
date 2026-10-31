"use client";

import type { MyClanResponse } from "@leximon/contract";
import { CLANS_TITLE, communitySectionOf, isFeatureOpen } from "@leximon/view-model";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import clanStyles from "@/clan/clan.module.css";
import { ClanList } from "@/clan/clan-list";
import { useJoinClan } from "@/clan/use-join-clan";
import { useNow } from "@/lib/use-now";
import { myClan } from "@/player/clan";
import { profile } from "@/player/player";
import { useShared, useSharedFailed } from "@/player/resource";
import { useProgress } from "@/progress/use-progress";
import { LoadFailed } from "@/ui/load-failed";
import { Bone } from "@/ui/skeleton";
import ui from "@/ui/ui.module.css";
import styles from "./community.module.css";
import { PlayerList } from "./player-list";

/** Everyone in the game: the public profiles and the clans, at every level, in a clan or not. */
export function CommunityScreen() {
  const params = useSearchParams();
  const clans = communitySectionOf("/communaute", params.get("onglet")) === "clans";
  return <main className={styles.screen}>{clans ? <ClansTab /> : <PlayerList />}</main>;
}

function ClansTab() {
  const mine = useShared(myClan);
  const failed = useSharedFailed(myClan);
  const progress = useProgress();
  const now = useNow(30_000);
  const title = <h1 className={`${ui.display} ${styles.title}`}>{CLANS_TITLE}</h1>;
  if (mine === null && failed) return <LoadFailed onRetry={() => myClan.ensure()} />;
  if (mine === null || progress === null || now === 0) {
    return (
      <>
        {title}
        <Bone className={clanStyles.clanRowBone} />
      </>
    );
  }
  const canJoin = mine.clanId === null && isFeatureOpen("join_clan", progress.level, now);
  return (
    <>
      {title}
      {canJoin ? <JoinableClans mine={mine} /> : <ClanList join={null} />}
    </>
  );
}

/** The list with its buttons: a player free to join goes straight to their new clan. */
function JoinableClans({ mine }: { readonly mine: MyClanResponse }) {
  const router = useRouter();
  const onJoined = useCallback(
    (clanId: string) => {
      myClan.publish({ ...mine, clanId });
      myClan.refresh();
      profile.refresh();
      router.push("/clan");
    },
    [mine, router],
  );
  return <ClanList join={useJoinClan(mine, onJoined)} />;
}
