import type { ClanMember, ClanSummary, ClanView, MyClanResponse } from "@leximon/contract";
import {
  ALREADY_IN_CLAN,
  CLAN_GONE,
  CLANS_TITLE,
  clanSubline,
  isFeatureOpen,
  lockedToast,
  moreMembersLabel,
  REPORT_CLAN_LABEL,
  roleLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { act } from "@/clan/act";
import { Banner, Emblem } from "@/clan/emblem";
import { useJoinClan } from "@/clan/use-join-clan";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { myClan, profile, progress as progressResource } from "@/player/state";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";
import { JoinButton } from "./clan-list";

const allClans = () => router.navigate({ pathname: "/clan", params: { section: "clans" } });

/** A clan seen from outside: who it is and who is in it. Its own members go to their clan page. */
export function ClanVisitScreen({ clanId }: { readonly clanId: string }) {
  const mine = useShared(myClan);
  const clanFailed = useSharedFailed(myClan);
  const progress = useShared(progressResource);
  const now = useNow(30_000);
  // `null` when the clan no longer exists; `undefined` until it is read.
  const [view, setView] = useState<ClanView | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setView(await api.fetchClan(clanId));
    } catch {
      setFailed(true);
    }
  }, [clanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const own = mine?.clanId === clanId || (view !== undefined && view?.me != null);
  useEffect(() => {
    if (own) router.replace("/clan");
  }, [own]);

  if ((view === undefined && failed) || (mine === null && clanFailed)) {
    return (
      <Page title="Clan">
        <Paragraph muted>Le serveur ne répond pas.</Paragraph>
        <Button
          label="Réessayer"
          secondary
          onPress={() => {
            void load();
            myClan.ensure();
          }}
        />
      </Page>
    );
  }
  if (view === null) {
    return (
      <Page title="Clan">
        <Paragraph>{CLAN_GONE}</Paragraph>
        <Button label={CLANS_TITLE} secondary onPress={allClans} />
      </Page>
    );
  }
  if (view === undefined || mine === null || progress === null || own) {
    return (
      <Page title="Clan">
        <Paragraph muted>Un instant…</Paragraph>
      </Page>
    );
  }
  return <ClanVisit view={view} clanId={clanId} mine={mine} level={progress.level} now={now} />;
}

function ClanVisit({
  view,
  clanId,
  mine,
  level,
  now,
}: {
  readonly view: ClanView;
  readonly clanId: string;
  readonly mine: MyClanResponse;
  readonly level: number;
  readonly now: number;
}) {
  const [extra, setExtra] = useState<{
    readonly members: readonly ClanMember[];
    readonly cursor: string | null;
  } | null>(null);
  const clan = view.clan;

  const members = [...view.members, ...(extra?.members ?? [])];
  const moreLabel =
    extra === null
      ? moreMembersLabel(clan.memberCount, view.members.length)
      : extra.cursor === null
        ? null
        : "Voir plus";

  const loadMore = async () => {
    const cursor = extra === null ? null : extra.cursor;
    if (extra !== null && cursor === null) return;
    const page = await api.fetchMembers(clanId, cursor).catch(() => null);
    if (page === null) return;
    const shown = new Set(members.map((member) => member.player.code));
    setExtra({
      members: [
        ...(extra?.members ?? []),
        ...page.members.filter((member) => !shown.has(member.player.code)),
      ],
      cursor: page.nextCursor,
    });
  };

  const onJoined = (joined: string) => {
    myClan.publish({ ...mine, clanId: joined });
    myClan.refresh();
    profile.refresh();
    router.replace("/clan");
  };

  return (
    <Page kicker={`Clan de niveau ${clan.level}`} title={clan.name}>
      <Panel style={styles.hero}>
        <Banner cardId={clan.banner} />
        <View style={styles.heroHead}>
          <Emblem emblem={clan.emblem} size={64} level={clan.level} />
          <Text style={[styles.small, styles.heroLine]}>{clanSubline(clan)}</Text>
        </View>
        <VisitorAction clan={clan} mine={mine} level={level} now={now} onJoined={onJoined} />
      </Panel>

      <Panel>
        <View style={styles.membersHead}>
          <Text style={styles.kicker}>MEMBRES</Text>
          <Text style={styles.small}>{clan.memberCount}</Text>
        </View>
        {members.map((entry) => (
          <VisitedMember key={entry.player.code} member={entry} />
        ))}
        {moreLabel !== null && <TextButton label={moreLabel} onPress={() => void loadMore()} />}
      </Panel>

      <TextButton
        label={REPORT_CLAN_LABEL}
        onPress={() =>
          void act(() => api.reportClanName(clanId), "Signalement envoyé. L'équipe va le lire.")
        }
      />
    </Page>
  );
}

/** What the player can do about this clan, or why they cannot. */
function VisitorAction({
  clan,
  mine,
  level,
  now,
  onJoined,
}: {
  readonly clan: ClanSummary;
  readonly mine: MyClanResponse;
  readonly level: number;
  readonly now: number;
  readonly onJoined: (clanId: string) => void;
}) {
  const join = useJoinClan(mine, onJoined);
  if (mine.clanId !== null) return <Text style={styles.small}>{ALREADY_IN_CLAN}</Text>;
  if (!isFeatureOpen("join_clan", level, now)) {
    return (
      <Button label="Rejoindre" secondary onPress={() => toast(lockedToast("join_clan", now))} />
    );
  }
  return <JoinButton clan={clan} join={join} />;
}

function VisitedMember({ member }: { readonly member: ClanMember }) {
  const role = roleLabel(member.role);
  const { pseudo, avatar } = member.player;
  return (
    <Pressable
      style={({ pressed }) => [styles.member, pressed && styles.pressed]}
      disabled={pseudo === null}
      onPress={() => {
        if (pseudo !== null) router.push({ pathname: "/joueur/[pseudo]", params: { pseudo } });
      }}
      accessibilityRole="link"
    >
      <Avatar avatar={avatar} frame={null} size={40} />
      <Text style={styles.memberName} numberOfLines={1}>
        {pseudo}
      </Text>
      {role !== null && (
        <View style={styles.role}>
          <Icon name="crown" size={12} color={colors.accent} />
          <Text style={styles.roleText}>{role}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden" },
  heroHead: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroLine: { flex: 1 },
  small: { fontFamily: fonts.ui.medium, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  membersHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  member: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  pressed: { opacity: 0.7 },
  memberName: { flex: 1, fontFamily: fonts.ui.bold, fontSize: 16, color: colors.text },
  role: { flexDirection: "row", alignItems: "center", gap: 4 },
  roleText: { fontFamily: fonts.ui.bold, fontSize: 12, color: colors.accent },
});
