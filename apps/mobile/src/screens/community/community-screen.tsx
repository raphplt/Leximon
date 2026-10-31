import type { MyClanResponse } from "@leximon/contract";
import {
  COMMUNITY_TABS,
  COMMUNITY_TITLE,
  type CommunityTab,
  isFeatureOpen,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useJoinClan } from "@/clan/use-join-clan";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { myClan, profile, progress as progressResource } from "@/player/state";
import { ClanList } from "@/screens/clan/clan-list";
import { Button } from "@/ui/button";
import { Page, Paragraph } from "@/ui/page";
import { Segmented } from "@/ui/segmented";
import { PlayerList } from "./player-list";

const TABS = COMMUNITY_TABS.map((tab) => ({ value: tab.id, label: tab.label }));

/** Everyone in the game: the public profiles and the clans, at every level, in a clan or not. */
export function CommunityScreen({ initialTab }: { readonly initialTab: CommunityTab }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <Page title={COMMUNITY_TITLE}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === "joueurs" ? <PlayerList /> : <ClansTab />}
    </Page>
  );
}

function ClansTab() {
  const mine = useShared(myClan);
  const failed = useSharedFailed(myClan);
  const progress = useShared(progressResource);
  const now = useNow(30_000);
  if (mine === null && failed) {
    return <Button label="Réessayer" secondary onPress={() => myClan.ensure()} />;
  }
  if (mine === null || progress === null) return <Paragraph muted>Un instant…</Paragraph>;
  const canJoin = mine.clanId === null && isFeatureOpen("join_clan", progress.level, now);
  return canJoin ? <JoinableClans mine={mine} /> : <ClanList join={null} />;
}

/** The list with its buttons: a player free to join goes straight to their new clan. */
function JoinableClans({ mine }: { readonly mine: MyClanResponse }) {
  const onJoined = useCallback(
    (clanId: string) => {
      myClan.publish({ ...mine, clanId });
      myClan.refresh();
      profile.refresh();
      router.replace("/clan");
    },
    [mine],
  );
  return <ClanList join={useJoinClan(mine, onJoined)} />;
}
