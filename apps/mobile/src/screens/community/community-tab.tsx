import type { MyClanResponse } from "@leximon/contract";
import {
  CLANS_TITLE,
  COMMUNITY_SECTIONS,
  type CommunitySection,
  isFeatureOpen,
  PLAYERS_TITLE,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useJoinClan } from "@/clan/use-join-clan";
import { FeatureGate } from "@/levels/feature-gate";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { myClan, profile, progress as progressResource } from "@/player/state";
import { ClanList } from "@/screens/clan/clan-list";
import { ClanScreen } from "@/screens/clan/clan-screen";
import { FriendsScreen } from "@/screens/friends/friends-screen";
import { Button } from "@/ui/button";
import { Page, Paragraph } from "@/ui/page";
import { Segmented } from "@/ui/segmented";
import { PlayerList } from "./player-list";

const SECTIONS = COMMUNITY_SECTIONS.map((section) => ({
  value: section.id,
  label: section.label,
}));

const open = (section: CommunitySection) => router.setParams({ section });

/** The community tab: the player's clan, their friends, the public profiles and the clans. */
export function CommunityTab({
  section,
  code,
}: {
  readonly section: CommunitySection;
  readonly code: string | null;
}) {
  return (
    <View style={styles.tab}>
      <View style={styles.nav}>
        <Segmented light options={SECTIONS} value={section} onChange={open} />
      </View>
      <View style={styles.tab}>
        {section === "clan" && (
          <FeatureGate feature="join_clan" icon="clan">
            <ClanScreen code={code} />
          </FeatureGate>
        )}
        {section === "amis" && <FriendsScreen adding={null} inTab />}
        {section === "joueurs" && (
          <Page inTab title={PLAYERS_TITLE}>
            <PlayerList />
          </Page>
        )}
        {section === "clans" && (
          <Page inTab title={CLANS_TITLE}>
            <ClansSection />
          </Page>
        )}
      </View>
    </View>
  );
}

function ClansSection() {
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
      open("clan");
    },
    [mine],
  );
  return <ClanList join={useJoinClan(mine, onJoined)} />;
}

const styles = StyleSheet.create({
  tab: { flex: 1 },
  nav: { paddingHorizontal: 16, paddingTop: 8 },
});
