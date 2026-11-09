"use client";

import type { ClanMember, ClanSummary, ClanView, MyClanResponse } from "@leximon/contract";
import {
  ALREADY_IN_CLAN,
  CLAN_GONE,
  CLANS_PATH,
  CLANS_TITLE,
  clanMottoLine,
  isFeatureOpen,
  lockedToast,
  moreMembersLabel,
  playerName,
  profilePath,
  REPORT_CLAN_LABEL,
  roleLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { myClan } from "@/player/clan";
import { profile } from "@/player/player";
import { useShared, useSharedFailed } from "@/player/resource";
import { useProgress } from "@/progress/use-progress";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { Bone, WaitingScreen } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { Banner } from "./banner";
import { refusalText } from "./chat";
import styles from "./clan.module.css";
import { ClanFacts } from "./clan-facts";
import { JoinButton } from "./clan-list";
import { Emblem } from "./emblem";
import { useJoinClan } from "./use-join-clan";

/** A clan seen from outside: who it is and who is in it. Its own members go to their clan page. */
export function ClanVisitScreen({ clanId }: { readonly clanId: string }) {
  const mine = useShared(myClan);
  const clanFailed = useSharedFailed(myClan);
  const progress = useProgress();
  const now = useNow(30_000);
  const router = useRouter();
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
  }, [own, router]);

  if ((view === undefined && failed) || (mine === null && clanFailed)) {
    return (
      <main className={styles.screen}>
        <LoadFailed
          onRetry={() => {
            void load();
            myClan.ensure();
          }}
        />
      </main>
    );
  }
  if (view === null) {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>{CLAN_GONE}</p>
        <ButtonLink href={CLANS_PATH} variant="secondary">
          {CLANS_TITLE}
        </ButtonLink>
      </main>
    );
  }
  if (view === undefined || mine === null || progress === null || now === 0 || own) {
    return (
      <WaitingScreen className={styles.screen}>
        <Bone className={styles.heroBone} />
      </WaitingScreen>
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
  const toast = useToast();
  const narrow = useNarrow();
  const router = useRouter();
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
    router.push("/clan");
  };

  const report = async () => {
    const result = await api.reportClanName(clanId).catch(() => null);
    if (result === null) toast("Ça n'a pas marché. Réessaie.");
    else if (result.kind === "refused") toast(refusalText(result.reason));
    else toast("Signalement envoyé. L'équipe va le lire.");
  };

  return (
    <main className={styles.screen}>
      <header className={`${ui.panel} ${styles.hero}`}>
        <Banner cardId={clan.banner} />
        <Emblem emblem={clan.emblem} size={narrow ? 64 : 96} level={clan.level} />
        <div className={styles.heroText}>
          <p className={`${ui.kicker} ${styles.heroKicker}`}>Clan de niveau {clan.level}</p>
          <h1 className={`${ui.display} ${styles.heroName}`}>{clan.name}</h1>
          {clanMottoLine(clan.motto) !== null && (
            <p className={styles.heroMotto}>{clanMottoLine(clan.motto)}</p>
          )}
        </div>
        <div className={`${styles.heroSide} ${styles.visitActions}`}>
          <ClanFacts clan={clan} />
          <VisitorAction clan={clan} mine={mine} level={level} now={now} onJoined={onJoined} />
        </div>
      </header>

      <section className={`${ui.panel} ${styles.card}`}>
        <div className={styles.cardHead}>
          <p className={ui.kicker}>Membres</p>
          <span className={styles.small}>{clan.memberCount}</span>
        </div>
        <ul className={styles.members}>
          {members.map((entry) => (
            <li key={entry.player.code}>
              <VisitedMember member={entry} />
            </li>
          ))}
        </ul>
        {moreLabel !== null && (
          <Button variant="ghost" small onClick={() => void loadMore()}>
            {moreLabel}
          </Button>
        )}
      </section>

      <div className={styles.visitFoot}>
        <Button variant="ghost" small onClick={() => void report()}>
          {REPORT_CLAN_LABEL}
        </Button>
      </div>
    </main>
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
  const toast = useToast();
  if (mine.clanId !== null) {
    return <p className={`${styles.small} ${styles.visitNote}`}>{ALREADY_IN_CLAN}</p>;
  }
  if (!isFeatureOpen("join_clan", level, now)) {
    return (
      <Button variant="secondary" small onClick={() => toast(lockedToast("join_clan", now))}>
        <Icon name="lock" size={17} />
        Rejoindre
      </Button>
    );
  }
  return <JoinButton clan={clan} join={join} />;
}

function VisitedMember({ member }: { readonly member: ClanMember }) {
  const role = roleLabel(member.role);
  const row = (
    <>
      <span className={styles.memberAvatar}>
        <Avatar avatar={member.player.avatar} frame={null} size={40} />
      </span>
      <span className={styles.memberText}>
        <span className={styles.memberName}>{playerName(member.player)}</span>
      </span>
      {role !== null && (
        <span className={styles.role} data-role={member.role}>
          <Icon name="crown" size={12} />
          {role}
        </span>
      )}
    </>
  );
  const { pseudo } = member.player;
  return pseudo === null ? (
    <div className={styles.member}>{row}</div>
  ) : (
    <Link href={profilePath(pseudo)} className={`${styles.member} ${styles.memberLink}`}>
      {row}
    </Link>
  );
}
