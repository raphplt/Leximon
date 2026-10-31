"use client";

import type { ClaimableGoal, ClanMember, ClanView } from "@leximon/contract";
import type { Catalog } from "@leximon/contract/client";
import { canAct } from "@leximon/core";
import { collectionTone } from "@leximon/tokens";
import {
  ALL_CLANS_LABEL,
  CLANS_PATH,
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
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { loadCatalog } from "@/cards/catalog";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { myClan } from "@/player/clan";
import { ownedCards } from "@/player/collection";
import { useShared } from "@/player/resource";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Bone, WaitingScreen } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { Banner } from "./banner";
import { ClanChat } from "./chat";
import { useClaim } from "./claim";
import styles from "./clan.module.css";
import { Emblem } from "./emblem";
import { ClanSettings, MemberSheet, RequestsDialog } from "./manage";

type Tab = "discussion" | "clan" | "members";

const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "discussion", label: "Discussion" },
  { id: "clan", label: "Clan" },
  { id: "members", label: "Membres" },
];

/** Refreshes the page's figures (goal, members online) while it is open. */
const VIEW_REFRESH_MS = 60_000;

/** The clan's page: two columns on the web, three tabs on a phone. */
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
  const [catalog, setCatalog] = useState<Catalog | null>(null);
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
  const toast = useToast();
  const claim = useClaim();

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

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, VIEW_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

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
      <main className={styles.screen}>
        <p className={styles.hint}>Impossible de charger ton clan.</p>
        <Button variant="secondary" onClick={() => void load()}>
          Réessayer
        </Button>
      </main>
    );
  }
  if (view === null || view.me === null || catalog === null) {
    return (
      <WaitingScreen className={styles.screen}>
        <Bone className={styles.heroBone} />
        <div className={styles.clanTabs}>
          {TABS.map((entry) => (
            <Bone key={entry.id} className={styles.clanTabBone} />
          ))}
        </div>
      </WaitingScreen>
    );
  }

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

  const invite = async () => {
    const text = inviteText(view.clan.name, me.inviteCode, window.location.origin);
    try {
      await navigator.clipboard.writeText(text);
      toast("Lien d'invitation copié.");
    } catch {
      toast(`Copie impossible. Le code : ${me.inviteCode}`);
    }
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
    if (await claim(goalClaim)) void load();
  };

  const goal = view.goal;
  const bar = goal === null ? null : goalBar(goal);
  const reward = goal === null ? null : goalRewardLine(goal);
  const progress = view.progress;
  const nextUnlock = nextUnlockLine(progress, wordOf);
  const hint = goal === null ? null : contributionHint(goal);
  // A claim taken from the mail leaves the page at once, without reading the clan again.
  const claimable = (goal?.claimable ?? []).filter(
    (c) => mine === null || mine.claimable.some((m) => m.week === c.week && m.tier === c.tier),
  );
  const canManage = canAct(me.role, "edit_clan") || canAct(me.role, "accept_request");

  return (
    <main className={styles.screen} data-tab={tab}>
      <header className={`${ui.panel} ${styles.hero}`}>
        <Banner cardId={view.clan.banner} />
        <Emblem emblem={view.clan.emblem} size={96} level={progress.level} />
        <div className={styles.heroText}>
          <p className={`${ui.kicker} ${styles.heroKicker}`}>Ton clan</p>
          <h1 className={`${ui.display} ${styles.heroName}`}>{view.clan.name}</h1>
          <p className={styles.heroLine}>{clanSubline(view.clan)}</p>
          <div className={styles.clanXp}>
            <div className={styles.clanXpHead}>
              <span>{clanLevelLine(progress)}</span>
              {nextUnlock !== null && <span className={styles.clanXpNext}>{nextUnlock}</span>}
            </div>
            <div className={`${ui.bar} ${styles.clanXpTrack}`}>
              <div
                className={`${ui.barFill} ${styles.clanXpFill}`}
                style={{
                  width: `${Math.min(100, (progress.xpIntoLevel / Math.max(1, progress.xpForNextLevel)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className={styles.heroActions}>
          {view.pendingRequests > 0 && canAct(me.role, "accept_request") && (
            <button type="button" className={ui.chip} onClick={() => setOverlay("requests")}>
              {view.pendingRequests > 1 ? `${view.pendingRequests} demandes` : "Une demande"}
              <span className={ui.badge}>{view.pendingRequests}</span>
            </button>
          )}
          <ButtonLink href={CLANS_PATH} variant="ghost" small>
            {ALL_CLANS_LABEL}
          </ButtonLink>
          <Button variant="secondary" small onClick={() => void invite()}>
            <Icon name="share" size={17} />
            Inviter
          </Button>
          <button
            type="button"
            className={ui.round}
            aria-label={canManage ? "Gérer le clan" : "Options du clan"}
            onClick={() => setOverlay("settings")}
          >
            <Icon name="reglages" size={20} />
          </button>
        </div>
      </header>

      <div className={styles.clanTabs} role="tablist" aria-label="Clan">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={styles.clanTab}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          {goal !== null && bar !== null && (
            <section className={`${ui.panel} ${styles.card} ${styles.onClan}`}>
              <div className={styles.cardHead}>
                <div>
                  <p className={ui.kicker}>Objectif de la semaine</p>
                  <h2 className={`${ui.display} ${styles.cardTitle}`}>{goalTitle(goal)}</h2>
                </div>
                <span className={styles.small}>{now > 0 && goalTimeLeft(goal.endsAt, now)}</span>
              </div>
              <div className={styles.goalBar}>
                <div className={`${ui.bar} ${styles.goalTrack}`}>
                  <div
                    className={`${ui.barFill} ${styles.goalFill}`}
                    style={{ width: `${bar.percent}%` }}
                  />
                </div>
                {bar.tiers.map((tier) => (
                  <span
                    key={tier.tier}
                    className={styles.tier}
                    data-tier={tier.tier}
                    data-reached={tier.reached}
                    style={{ left: `${Math.min(tier.left, 98)}%` }}
                    title={tier.label}
                  >
                    <Icon
                      name={tier.tier === "gold" || tier.tier === "illuminated" ? "star" : "check"}
                      size={16}
                    />
                    <span className={styles.visuallyHidden}>{tier.label}</span>
                  </span>
                ))}
              </div>
              <div className={styles.goalFoot}>
                <span>{goalCountLine(goal)}</span>
                {reward !== null && <span>{reward}</span>}
              </div>
              {hint !== null && <p className={styles.goalHint}>{hint}</p>}
              {claimable.length > 0 && (
                <div className={styles.claims}>
                  {claimable.map((goalClaim) => (
                    <Button
                      key={`${goalClaim.week}-${goalClaim.tier}`}
                      small
                      glow
                      onClick={() => void claimed(goalClaim)}
                    >
                      <Icon name="sachet" size={17} />
                      {claimLabel(goalClaim)}
                    </Button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className={`${ui.panel} ${styles.card} ${styles.onClan}`}>
            <p className={ui.kicker}>Bibliothèque du clan</p>
            <p className={styles.libraryLine}>
              <em>{libraryHeadline(rows)}</em>
            </p>
            {rows.map((row) => (
              <div key={row.collectionId} className={styles.libraryRow}>
                <div className={styles.libraryHead}>
                  <span className={styles.libraryName}>{row.name}</span>
                  <span className={styles.figures}>
                    {row.owned} / {row.total}
                  </span>
                </div>
                <div
                  className={styles.libraryTrack}
                  style={{ "--tone": collectionTone(row.collectionId) } as CSSProperties}
                >
                  <span className={styles.libraryClan} style={{ width: `${row.percent}%` }} />
                  <span className={styles.libraryMine} style={{ width: `${row.minePercent}%` }} />
                </div>
              </div>
            ))}
          </section>

          <section className={`${ui.panel} ${styles.card} ${styles.onMembers}`}>
            <div className={styles.cardHead}>
              <p className={ui.kicker}>Membres</p>
              <span className={styles.small}>{view.clan.memberCount}</span>
            </div>
            <ul className={styles.members}>
              {members.map((entry) => {
                const role = roleLabel(entry.role);
                return (
                  <li key={entry.player.code}>
                    <button
                      type="button"
                      className={styles.member}
                      onClick={() => setMember(entry)}
                    >
                      <span className={styles.memberAvatar}>
                        <Avatar avatar={entry.player.avatar} frame={null} size={40} />
                        {entry.online && <span className={styles.online} />}
                      </span>
                      <span className={styles.memberText}>
                        <span className={styles.memberName}>{entry.player.pseudo}</span>
                        <span className={styles.small}>{now > 0 && memberLine(entry, now)}</span>
                      </span>
                      {role !== null && (
                        <span className={styles.role} data-role={entry.role}>
                          <Icon name="crown" size={12} />
                          {role}
                        </span>
                      )}
                      <span className={styles.memberWords}>
                        {weekAnswersLabel(entry.weekAnswers)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {moreLabel !== null && (
              <Button variant="ghost" small onClick={() => void loadMore()}>
                {moreLabel}
              </Button>
            )}
          </section>
        </div>

        <div className={styles.onDiscussion}>
          <ClanChat
            clanId={clanId}
            role={me.role}
            mutedUntil={me.mutedUntil}
            online={onlineCountLabel(view.members)}
            now={now}
            wordOf={wordOf}
          />
        </div>
      </div>

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
      <RequestsDialog
        clanId={clanId}
        open={overlay === "requests"}
        onClose={() => setOverlay(null)}
        onChanged={() => void load()}
      />
      <ClanSettings
        view={view}
        open={overlay === "settings"}
        now={now}
        onClose={() => setOverlay(null)}
        onChanged={() => void load()}
        onLeft={onLeft}
      />
    </main>
  );
}
