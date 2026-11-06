import type { ClaimableGoal, ClanGoal, ClanMember, ClanView } from "@leximon/contract";
import type { Catalog } from "@leximon/contract/client";
import { canAct } from "@leximon/core";
import { alpha, collectionTone, lettering, toy as toyValues } from "@leximon/tokens";
import {
  claimLabel,
  clanLevelLine,
  clanMottoLine,
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
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { claimGoal } from "@/clan/claim";
import { ClanFacts } from "@/clan/clan-facts";
import { Banner, Emblem } from "@/clan/emblem";
import { WEB_URL } from "@/config";
import { Desk } from "@/library/play-pieces";
import { ownedCards } from "@/player/collection";
import { useShared } from "@/player/shared";
import { myClan } from "@/player/state";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { KeyboardLift } from "@/ui/keyboard-lift";
import { Panel } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { TextButton } from "@/ui/text-button";
import { Lettering, Toy } from "@/ui/toy";
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
          <Desk style={StyleSheet.absoluteFill} />
          <Banner cardId={view.clan.banner} />
          <Emblem emblem={view.clan.emblem} size={52} level={progress.level} />
          <View style={styles.heroText}>
            <View accessible accessibilityRole="header" accessibilityLabel={view.clan.name}>
              <Lettering size={fontSizes.titleSmall} numberOfLines={1}>
                {view.clan.name}
              </Lettering>
            </View>
            <Text style={styles.heroSmall} numberOfLines={1}>
              {online ?? clanMottoLine(view.clan.motto) ?? ""}
            </Text>
          </View>
          {view.pendingRequests > 0 && canAct(me.role, "accept_request") && (
            <HeroButton
              onPress={() => setOverlay("requests")}
              label={view.pendingRequests > 1 ? `${view.pendingRequests} demandes` : "Une demande"}
            >
              <Icon name="amis" size={20} color={ink.pageInk} />
              <Badge count={view.pendingRequests} ring={toyValues.outline} />
            </HeroButton>
          )}
          <HeroButton onPress={invite} label="Inviter">
            <Icon name="share" size={19} color={ink.pageInk} />
          </HeroButton>
          <HeroButton
            onPress={() => setOverlay("settings")}
            label={canManage ? "Gérer le clan" : "Options du clan"}
          >
            <Icon name="reglages" size={20} color={ink.pageInk} />
          </HeroButton>
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
          <Panel paper>
            {clanMottoLine(view.clan.motto) !== null && (
              <Text style={styles.motto}>{clanMottoLine(view.clan.motto)}</Text>
            )}
            <ClanFacts clan={view.clan} color={ink.pageInk} iconColor={ink.pageInkMuted} />
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

          <Panel paper>
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
          <MembersGround>
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
                          <Icon name="crown" size={12} color={ink.rubric} />
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
          </MembersGround>
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

/** A round button of the header: a paper toy on the desk. */
function HeroButton({
  onPress,
  label,
  children,
}: {
  readonly onPress: () => void;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <Toy
      matter="paper"
      shape="round"
      onPress={onPress}
      style={styles.toy}
      bodyStyle={styles.toyBody}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Toy>
  );
}

/** The members, on one leaf of paper. */
function MembersGround({ children }: { readonly children: ReactNode }) {
  return (
    <Panel paper style={styles.membersLeaf}>
      {children}
    </Panel>
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
    <Panel paper>
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
              color={tier.reached ? ink.actionInk : ink.pageInkMuted}
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

/** What the clan shows lies on paper; the header stays on the desk. */
const ink = paperColors;

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
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    overflow: "hidden",
    padding: space.s8,
    paddingRight: space.s7,
  },
  heroText: { flex: 1, gap: space.s1 },
  heroSmall: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: alpha(lettering.fill, 0.85),
  },
  toy: { width: 42, height: 42 },
  toyBody: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    color: ink.pageInkMuted,
  },
  motto: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 24,
    color: ink.pageInk,
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  xpHead: { gap: space.s1 },
  xpLine: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  track: { height: 8, borderRadius: 4, backgroundColor: ink.well, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: ink.action },
  goalHead: { flexDirection: "row", alignItems: "flex-start", gap: space.s4 },
  goalTitles: { flex: 1, gap: space.s2 },
  goalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 25,
    color: ink.pageInk,
  },
  goalBar: { height: 28, justifyContent: "center", marginHorizontal: space.s4 },
  goalTrack: { height: 10, borderRadius: 5, backgroundColor: ink.well, overflow: "hidden" },
  goalFill: { height: 10, borderRadius: 5, backgroundColor: ink.success },
  tier: {
    position: "absolute",
    marginLeft: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ink.pageRaised,
    borderWidth: 2,
    borderColor: ink.track,
  },
  tierReached: { backgroundColor: ink.action, borderColor: ink.actionEdge },
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
    color: ink.pageInk,
  },
  libraryLine: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInk,
  },
  libraryRow: { gap: space.s3 },
  libraryHead: { flexDirection: "row", justifyContent: "space-between" },
  libraryName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
  libraryClan: { position: "absolute", top: 0, bottom: 0, left: 0, opacity: 0.4 },
  libraryMine: { position: "absolute", top: 0, bottom: 0, left: 0 },
  membersHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.s5,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    minHeight: 60,
    paddingHorizontal: space.s6,
    paddingVertical: space.s4,
    borderRadius: radii.xxl,
    backgroundColor: "transparent",
  },
  membersLeaf: { paddingHorizontal: space.s4, gap: space.s2 },
  pressed: { opacity: 0.7 },
  online: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ink.success,
    borderWidth: 2,
    borderColor: ink.page,
  },
  memberText: { flex: 1, gap: space.s1 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  memberName: {
    flexShrink: 1,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
  },
  role: { flexDirection: "row", alignItems: "center", gap: 3 },
  roleText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption, color: ink.rubric },
  memberWords: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInkMuted },
});
