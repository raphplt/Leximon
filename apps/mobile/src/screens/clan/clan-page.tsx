import type { ClaimableGoal, ClanGoal, ClanMember, ClanView } from "@leximon/contract";
import type { Catalog } from "@leximon/contract/client";
import { canAct } from "@leximon/core";
import { collectionTone } from "@leximon/tokens";
import {
  claimLabel,
  clanLevelLine,
  clanSubline,
  contributionHint,
  goalBar,
  goalCountLine,
  goalRewardLine,
  goalTimeLeft,
  goalTitle,
  inviteText,
  libraryHeadline,
  libraryRows,
  memberLine,
  moreMembersLabel,
  nextUnlockLine,
  onlineCountLabel,
  roleLabel,
  weekAnswersLabel,
} from "@leximon/view-model";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { claimGoal } from "@/clan/claim";
import { Banner, Emblem } from "@/clan/emblem";
import { WEB_URL } from "@/config";
import { ownedCards } from "@/player/collection";
import { useShared } from "@/player/shared";
import { myClan } from "@/player/state";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fontSizes, fonts, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { KeyboardLift } from "@/ui/keyboard-lift";
import { Panel } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { TextButton } from "@/ui/text-button";
import { ClanChat } from "./chat";
import { ClanSettings, MemberSheet, RequestsSheet } from "./manage";

type Tab = "discussion" | "clan" | "members";

/** Refreshes the page's figures (goal, members online) while it is in view. */
const VIEW_REFRESH_MS = 60_000;

/** The clan's page: its header, then three tabs: the discussion, the clan, its members. */
export function ClanPage({
  clanId,
  now,
  onLeft,
}: {
  readonly clanId: string;
  readonly now: number;
  /** The player is no longer in the clan: left, excluded, or the clan is gone. */
  readonly onLeft: () => void;
}) {
  const [view, setView] = useState<ClanView | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("discussion");
  const [extra, setExtra] = useState<{
    readonly members: readonly ClanMember[];
    readonly cursor: string | null;
  } | null>(null);
  const [member, setMember] = useState<ClanMember | null>(null);
  const [overlay, setOverlay] = useState<"settings" | "requests" | null>(null);
  const owned = useShared(ownedCards);
  const mine = useShared(myClan);

  const load = useCallback(async () => {
    try {
      const [loaded, loadedCatalog] = await Promise.all([api.fetchClan(clanId), loadCatalog()]);
      setCatalog(loadedCatalog);
      if (loaded === null || loaded.me === null) {
        onLeft();
        return;
      }
      setView(loaded);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [clanId, onLeft]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), VIEW_REFRESH_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const mineByCollection = useMemo(() => {
    const counts = new Map<string, number>();
    if (catalog === null || owned === null) return counts;
    for (const [cardId, quantity] of owned) {
      const card = catalog.cardsById.get(cardId);
      if (card !== undefined && quantity > 0) {
        counts.set(card.collectionId, (counts.get(card.collectionId) ?? 0) + 1);
      }
    }
    return counts;
  }, [catalog, owned]);

  if (failed && view === null) {
    return (
      <View style={styles.failed}>
        <Text style={styles.hint}>Impossible de charger ton clan.</Text>
        <Button label="Réessayer" secondary onPress={() => void load()} />
      </View>
    );
  }
  if (view === null || view.me === null || catalog === null) return null;

  const me = view.me;
  const wordOf = (cardId: string) => catalog.cardsById.get(cardId)?.word ?? cardId;
  const members = [...view.members, ...(extra?.members ?? [])];
  const moreLabel =
    extra === null
      ? moreMembersLabel(view.clan.memberCount, view.members.length)
      : extra.cursor === null
        ? null
        : "Voir plus";
  const rows = libraryRows(
    catalog.collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      total: collection.cards.length,
    })),
    new Map(view.library.map((entry) => [entry.collectionId, entry.owned])),
    mineByCollection,
  );

  const invite = () => {
    const text = inviteText(view.clan.name, me.inviteCode, WEB_URL);
    void Share.share({ message: text });
  };

  const loadMore = async () => {
    const cursor = extra === null ? null : extra.cursor;
    if (extra !== null && cursor === null) return;
    // The first page of the list starts after the members the page shows.
    const page = await api.fetchMembers(clanId, cursor).catch(() => null);
    if (page === null) return;
    const shown = new Set(members.map((m) => m.player.code));
    setExtra({
      members: [
        ...(extra?.members ?? []),
        ...page.members.filter((m) => !shown.has(m.player.code)),
      ],
      cursor: page.nextCursor,
    });
  };

  const claimed = async (goalClaim: ClaimableGoal) => {
    if (await claimGoal(goalClaim)) void load();
  };

  const progress = view.progress;
  const nextUnlock = nextUnlockLine(progress, wordOf);
  // A claim taken elsewhere leaves the page at once, without reading the clan again.
  const claimable = (view.goal?.claimable ?? []).filter(
    (c) => mine === null || mine.claimable.some((m) => m.week === c.week && m.tier === c.tier),
  );
  const canManage = canAct(me.role, "edit_clan") || canAct(me.role, "accept_request");
  const online = onlineCountLabel(view.members);

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.hero}>
          <Banner cardId={view.clan.banner} />
          <Emblem emblem={view.clan.emblem} size={52} level={progress.level} />
          <View style={styles.heroText}>
            <Text style={styles.heroName} numberOfLines={1} accessibilityRole="header">
              {view.clan.name}
            </Text>
            <Text style={styles.small} numberOfLines={1}>
              {online ?? clanSubline(view.clan)}
            </Text>
          </View>
          {view.pendingRequests > 0 && canAct(me.role, "accept_request") && (
            <Pressable
              onPress={() => setOverlay("requests")}
              style={styles.round}
              accessibilityRole="button"
              accessibilityLabel={
                view.pendingRequests > 1 ? `${view.pendingRequests} demandes` : "Une demande"
              }
            >
              <Icon name="amis" size={20} color={colors.pageInk} />
              <Badge count={view.pendingRequests} ring={colors.page} />
            </Pressable>
          )}
          <Pressable
            onPress={invite}
            style={styles.round}
            accessibilityRole="button"
            accessibilityLabel="Inviter"
          >
            <Icon name="share" size={19} color={colors.pageInk} />
          </Pressable>
          <Pressable
            onPress={() => setOverlay("settings")}
            style={styles.round}
            accessibilityRole="button"
            accessibilityLabel={canManage ? "Gérer le clan" : "Options du clan"}
          >
            <Icon name="reglages" size={20} color={colors.pageInk} />
          </Pressable>
        </View>
        <Segmented
          options={[
            { value: "discussion", label: "Discussion" },
            { value: "clan", label: "Clan" },
            { value: "members", label: "Membres" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === "discussion" && (
        <KeyboardLift style={styles.chat}>
          <ClanChat
            clanId={clanId}
            role={me.role}
            mutedUntil={me.mutedUntil}
            now={now}
            wordOf={wordOf}
          />
        </KeyboardLift>
      )}

      {tab === "clan" && (
        <ScrollView contentContainerStyle={styles.page}>
          <Panel>
            <Text style={styles.subline}>{clanSubline(view.clan)}</Text>
            <View style={styles.xpHead}>
              <Text style={styles.xpLine}>{clanLevelLine(progress)}</Text>
              {nextUnlock !== null && <Text style={styles.small}>{nextUnlock}</Text>}
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, (progress.xpIntoLevel / Math.max(1, progress.xpForNextLevel)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </Panel>

          {view.goal !== null && (
            <GoalPanel
              goal={view.goal}
              now={now}
              claimable={claimable}
              onClaim={(goalClaim) => void claimed(goalClaim)}
            />
          )}

          <Panel>
            <Text style={styles.kicker}>BIBLIOTHÈQUE DU CLAN</Text>
            <Text style={styles.libraryLine}>{libraryHeadline(rows)}</Text>
            {rows.map((row) => (
              <View key={row.collectionId} style={styles.libraryRow}>
                <View style={styles.libraryHead}>
                  <Text style={styles.libraryName}>{row.name}</Text>
                  <Text style={styles.small}>
                    {row.owned} / {row.total}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.libraryClan,
                      {
                        width: `${row.percent}%`,
                        backgroundColor: collectionTone(row.collectionId),
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.libraryMine,
                      {
                        width: `${row.minePercent}%`,
                        backgroundColor: collectionTone(row.collectionId),
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </Panel>
        </ScrollView>
      )}

      {tab === "members" && (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.membersHead}>
            <Text style={styles.kicker}>MEMBRES</Text>
            <Text style={styles.small}>{view.clan.memberCount}</Text>
          </View>
          {members.map((entry) => {
            const role = roleLabel(entry.role);
            return (
              <Pressable
                key={entry.player.code}
                style={({ pressed }) => [styles.member, pressed && styles.pressed]}
                onPress={() => setMember(entry)}
                accessibilityRole="button"
              >
                <View>
                  <Avatar avatar={entry.player.avatar} frame={null} size={40} />
                  {entry.online && <View style={styles.online} />}
                </View>
                <View style={styles.memberText}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {entry.player.pseudo}
                    </Text>
                    {role !== null && (
                      <View style={styles.role}>
                        <Icon name="crown" size={12} color={colors.rubric} />
                        <Text style={styles.roleText}>{role}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.small} numberOfLines={1}>
                    {memberLine(entry, now)}
                  </Text>
                </View>
                <Text style={styles.memberWords}>{weekAnswersLabel(entry.weekAnswers)}</Text>
              </Pressable>
            );
          })}
          {moreLabel !== null && <TextButton label={moreLabel} onPress={() => void loadMore()} />}
        </ScrollView>
      )}

      <MemberSheet
        clanId={clanId}
        myRole={me.role}
        member={member}
        now={now}
        onClose={() => setMember(null)}
        onChanged={() => {
          setMember(null);
          setExtra(null);
          void load();
        }}
      />
      <RequestsSheet
        clanId={clanId}
        open={overlay === "requests"}
        onClose={() => setOverlay(null)}
        onChanged={() => void load()}
      />
      <ClanSettings
        view={view}
        open={overlay === "settings"}
        onClose={() => setOverlay(null)}
        onChanged={() => void load()}
        onLeft={onLeft}
      />
    </View>
  );
}

function GoalPanel({
  goal,
  now,
  claimable,
  onClaim,
}: {
  readonly goal: ClanGoal;
  readonly now: number;
  readonly claimable: readonly ClaimableGoal[];
  readonly onClaim: (claim: ClaimableGoal) => void;
}) {
  const bar = goalBar(goal);
  const reward = goalRewardLine(goal);
  const hint = contributionHint(goal);
  return (
    <Panel>
      <View style={styles.goalHead}>
        <View style={styles.goalTitles}>
          <Text style={styles.kicker}>OBJECTIF DE LA SEMAINE</Text>
          <Text style={styles.goalTitle}>{goalTitle(goal)}</Text>
        </View>
        <Text style={styles.small}>{goalTimeLeft(goal.endsAt, now)}</Text>
      </View>
      <View style={styles.goalBar}>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${bar.percent}%` }]} />
        </View>
        {bar.tiers.map((tier) => (
          <View
            key={tier.tier}
            style={[
              styles.tier,
              { left: `${Math.min(tier.left, 98)}%` },
              tier.reached && styles.tierReached,
            ]}
            accessible
            accessibilityLabel={tier.label}
          >
            <Icon
              name={tier.tier === "gold" || tier.tier === "illuminated" ? "star" : "check"}
              size={14}
              color={tier.reached ? colors.actionInk : colors.pageInkMuted}
            />
          </View>
        ))}
      </View>
      <View style={styles.goalFoot}>
        <Text style={styles.small}>{goalCountLine(goal)}</Text>
        {reward !== null && <Text style={styles.small}>{reward}</Text>}
      </View>
      {hint !== null && <Text style={styles.goalHint}>{hint}</Text>}
      {claimable.map((goalClaim) => (
        <Button
          key={`${goalClaim.week}-${goalClaim.tier}`}
          label={claimLabel(goalClaim)}
          onPress={() => onClaim(goalClaim)}
        />
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  failed: { flex: 1, justifyContent: "center", gap: space.s8, paddingHorizontal: space.s12 },
  hint: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    color: colors.pageInk,
    textAlign: "center",
  },
  top: {
    gap: space.s6,
    paddingHorizontal: space.s8,
    paddingTop: space.s2,
    paddingBottom: space.s4,
  },
  hero: { flexDirection: "row", alignItems: "center", gap: space.s6, overflow: "hidden" },
  heroText: { flex: 1, gap: space.s1 },
  heroName: { fontFamily: fonts.display, fontSize: fontSizes.titleLarge, color: colors.pageInk },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
  },
  chat: { flex: 1, paddingBottom: TAB_BAR_RISE },
  page: {
    gap: space.s7,
    paddingHorizontal: space.s8,
    paddingTop: space.s2,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  small: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: colors.pageInkMuted,
  },
  subline: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.label, color: colors.pageInkMuted },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: colors.pageInkMuted,
  },
  xpHead: { gap: space.s1 },
  xpLine: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.pageInk },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.well, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.action },
  goalHead: { flexDirection: "row", alignItems: "flex-start", gap: space.s4 },
  goalTitles: { flex: 1, gap: space.s2 },
  goalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 25,
    color: colors.pageInk,
  },
  goalBar: { height: 28, justifyContent: "center", marginHorizontal: space.s4 },
  goalTrack: { height: 10, borderRadius: 5, backgroundColor: colors.well, overflow: "hidden" },
  goalFill: { height: 10, borderRadius: 5, backgroundColor: colors.success },
  tier: {
    position: "absolute",
    marginLeft: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageRaised,
    borderWidth: 2,
    borderColor: colors.track,
  },
  tierReached: { backgroundColor: colors.action, borderColor: colors.actionEdge },
  goalFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.s4,
    flexWrap: "wrap",
  },
  goalHint: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: colors.pageInk,
  },
  libraryLine: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: colors.pageInk,
  },
  libraryRow: { gap: space.s3 },
  libraryHead: { flexDirection: "row", justifyContent: "space-between" },
  libraryName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: colors.pageInk },
  libraryClan: { position: "absolute", top: 0, bottom: 0, left: 0, opacity: 0.4 },
  libraryMine: { position: "absolute", top: 0, bottom: 0, left: 0 },
  membersHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    minHeight: 60,
    paddingHorizontal: space.s6,
    paddingVertical: space.s4,
    borderRadius: radii.xxl,
    backgroundColor: colors.panel,
  },
  pressed: { opacity: 0.7 },
  online: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.page,
  },
  memberText: { flex: 1, gap: space.s1 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  memberName: {
    flexShrink: 1,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: colors.pageInk,
  },
  role: { flexDirection: "row", alignItems: "center", gap: 3 },
  roleText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption, color: colors.rubric },
  memberWords: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: colors.pageInkMuted },
});
