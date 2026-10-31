"use client";

import type { MyClanResponse } from "@leximon/contract";
import {
  COMMUNITY_PATH,
  COMMUNITY_TABS,
  COMMUNITY_TITLE,
  communityTabOf,
  isFeatureOpen,
} from "@leximon/view-model";
import Link from "next/link";
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
  const tab = communityTabOf(params.get("onglet"));
  return (
    <main className={styles.screen}>
      <h1 className={`${ui.display} ${styles.title}`}>{COMMUNITY_TITLE}</h1>
      <nav className={styles.tabs} aria-label={COMMUNITY_TITLE}>
        {COMMUNITY_TABS.map((entry) => (
          <Link
            key={entry.id}
            href={entry.id === "joueurs" ? COMMUNITY_PATH : `${COMMUNITY_PATH}?onglet=${entry.id}`}
            className={styles.tab}
            aria-current={tab === entry.id ? "page" : undefined}
            replace
            scroll={false}
          >
            {entry.label}
          </Link>
        ))}
      </nav>
      {tab === "joueurs" ? <PlayerList /> : <ClansTab />}
    </main>
  );
}

function ClansTab() {
  const mine = useShared(myClan);
  const failed = useSharedFailed(myClan);
  const progress = useProgress();
  const now = useNow(30_000);
  if (mine === null && failed) return <LoadFailed onRetry={() => myClan.ensure()} />;
  if (mine === null || progress === null || now === 0) {
    return <Bone className={clanStyles.clanRowBone} />;
  }
  const canJoin = mine.clanId === null && isFeatureOpen("join_clan", progress.level, now);
  return canJoin ? <JoinableClans mine={mine} /> : <ClanList join={null} />;
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
