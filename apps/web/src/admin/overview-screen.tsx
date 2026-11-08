"use client";

import type { AdminMeasures } from "@leximon/contract";
import Link from "next/link";
import { useState } from "react";
import { adminApi } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { SERIES } from "./charts";
import { Kpi, PanelHead, ratioDelta } from "./dashboard";
import { formatDateTime, formatNumber } from "./format";
import m from "./measures.module.css";
import { addDays, type DayMetric, type Range, total } from "./measures-model";
import { ActionsTable } from "./player-screen";
import { useLoad } from "./use-load";

const FEEDBACK_SHOWN = 4;
const PLAYERS_SHOWN = 6;
const ACTIONS_SHOWN = 5;
/** Days drawn in each small curve: this week and the one before. */
const TREND_DAYS = 14;

/** Everything that waits on the team, with the totals: one load for the top of the page. */
async function fetchInbox() {
  const [overview, feedback, reports, contests, waitlist] = await Promise.all([
    adminApi.fetchOverview(),
    adminApi.fetchFeedback(),
    adminApi.fetchReports(),
    adminApi.fetchContests(),
    adminApi.fetchWaitlist(),
  ]);
  return { overview, feedback, reports, contests, waitlist };
}

const fetchMeasures = () => adminApi.fetchMeasures();
const fetchTesters = () => adminApi.fetchTesters();
const fetchActions = () => adminApi.fetchActions();

/**
 * The first page of the back office: what waits on the team, how the week goes, and the latest
 * news. The figures over any period are on the measures page.
 */
export function OverviewScreen() {
  const [nonce, setNonce] = useState(0);
  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Tableau de bord</h1>
        <button type="button" className={styles.button} onClick={() => setNonce((n) => n + 1)}>
          Actualiser
        </button>
      </div>
      {/* A new key mounts every block again, so each one loads afresh. */}
      <div key={nonce} className={m.dashboard}>
        <Inbox />
        <Week />
        <div className={styles.overviewSplit}>
          <LatestFeedback />
          <RecentPlayers />
        </div>
        <LatestActions />
      </div>
    </>
  );
}

function Inbox() {
  const { state } = useLoad(fetchInbox);
  if (state.kind === "loading") return <p className={styles.muted}>Chargement…</p>;
  if (state.kind === "failed") return <p className={styles.error}>{state.message}</p>;
  const { overview, feedback, reports, contests, waitlist } = state.data;
  // Only what waits shows: a row of zeros would hide the one that matters.
  const todo = [
    { label: "Retours non lus", value: feedback.unread, href: "/admin/retours" },
    { label: "Signalements ouverts", value: reports.reports.length, href: "/admin/signalements" },
    {
      label: "Sanctions contestées",
      value: contests.contests.length,
      href: "/admin/contestations",
    },
    {
      label: "Adresses à inviter",
      value: waitlist.invitable,
      note: `${formatNumber(waitlist.total)} sur la liste d'attente`,
      href: "/admin/attente",
    },
  ].filter((item) => item.value > 0);
  const waiting = todo.length;
  return (
    <>
      <section className={styles.overviewSection}>
        <PanelHead
          title="À traiter"
          hint={
            waiting === 0
              ? "Rien n'attend de réponse : ni retour non lu, ni signalement, ni contestation, ni adresse à inviter."
              : "Ce qui attend une réponse de l'équipe."
          }
        />
        {waiting > 0 && (
          <div className={styles.overviewStats}>
            {todo.map((item) => (
              <Stat key={item.label} {...item} pending />
            ))}
          </div>
        )}
      </section>
      <section className={styles.overviewSection}>
        <PanelHead title="En tout" />
        <div className={styles.overviewStats}>
          <Stat
            label="Comptes"
            value={overview.players.members}
            note={`+${formatNumber(overview.players.newMembers7d)} en 7 jours`}
            href="/admin/joueurs"
          />
          <Stat
            label="Invités sans compte"
            value={overview.players.guests}
            note={`+${formatNumber(overview.players.newGuests7d)} en 7 jours`}
            href="/admin/joueurs?kind=guest"
          />
          <Stat label="Bannis" value={overview.players.banned} href="/admin/joueurs?kind=banned" />
          <Stat
            label="Échanges en cours"
            value={overview.trades.pending}
            note={`${formatNumber(overview.trades.completed7d)} conclus en 7 jours`}
            href="/admin/echanges"
          />
        </div>
      </section>
    </>
  );
}

function Week() {
  const { state } = useLoad(fetchMeasures);
  return (
    <section className={styles.overviewSection}>
      <PanelHead
        title="Les 7 derniers jours"
        hint="Comparés aux 7 jours d'avant ; la courbe montre les 14 derniers jours. Les admins ne comptent pas."
      >
        <Link href="/admin/mesure">Toutes les mesures</Link>
      </PanelHead>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && <WeekFigures data={state.data} />}
    </section>
  );
}

function WeekFigures({ data }: { readonly data: AdminMeasures }) {
  const { today } = data.period;
  const week: Range = { from: addDays(today, -6), to: today };
  const before: Range = { from: addDays(today, -13), to: addDays(today, -7) };
  const recent = data.daily.filter((day) => day.day > addDays(today, -TREND_DAYS));
  const todayRow = data.daily.find((day) => day.day === today);
  const figure = (metric: DayMetric) => {
    const current = total(data.daily, metric, week);
    return {
      value: formatNumber(current),
      delta: ratioDelta(current, total(data.daily, metric, before)),
      note: `${formatNumber(todayRow?.[metric] ?? 0)} aujourd'hui`,
      trend: recent.map((day) => day[metric]),
    };
  };
  return (
    <div className={styles.overviewKpis}>
      <Kpi
        label="Joueurs actifs"
        value={formatNumber(data.active7d)}
        note={`${formatNumber(data.activeToday)} aujourd'hui`}
        trend={recent.map((day) => day.active)}
      />
      <Kpi label="Nouveaux joueurs" {...figure("arrived")} color={SERIES.yellow} />
      <Kpi label="Comptes créés" {...figure("accounts")} />
      <Kpi label="Sachets ouverts" {...figure("boosters")} />
      <Kpi label="Défis répondus" {...figure("answers")} />
    </div>
  );
}

function LatestFeedback() {
  const { state } = useLoad(adminApi.fetchFeedback);
  return (
    <section className={styles.overviewSection}>
      <PanelHead title="Derniers retours">
        <Link href="/admin/retours">Tous les retours</Link>
      </PanelHead>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && state.data.feedback.length === 0 && (
        <p className={styles.muted}>Aucun retour pour l'instant.</p>
      )}
      {state.kind === "ready" && (
        <ul className={styles.overviewList}>
          {state.data.feedback.slice(0, FEEDBACK_SHOWN).map((item) => (
            <li key={item.id}>
              <span className={styles.muted}>
                {formatDateTime(item.createdAt)} · {item.email ?? "Invité"} · {item.screen}
                {item.readAt === null && (
                  <>
                    {" "}
                    <span className={styles.badgeWarn}>Non lu</span>
                  </>
                )}
              </span>
              <span className={styles.overviewQuote}>{item.body}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentPlayers() {
  const { state } = useLoad(fetchTesters);
  return (
    <section className={styles.overviewSection}>
      <PanelHead title="Joueurs du moment" hint="Les derniers à avoir joué d'abord.">
        <Link href="/admin/mesure">Tous les testeurs</Link>
      </PanelHead>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && state.data.testers.length === 0 && (
        <p className={styles.muted}>Personne n'a encore joué.</p>
      )}
      {state.kind === "ready" && (
        <ul className={styles.overviewList}>
          {state.data.testers.slice(0, PLAYERS_SHOWN).map((tester) => (
            <li key={tester.id}>
              <Link href={`/admin/joueurs/${encodeURIComponent(tester.id)}`}>
                {tester.pseudo ?? tester.email ?? "Invité"}
              </Link>
              <span className={styles.muted}>
                Niveau {tester.level} · {daysLabel(tester.daysPlayed)} ·{" "}
                {formatNumber(tester.boosters)} sachet{tester.boosters > 1 ? "s" : ""} ·{" "}
                {formatNumber(tester.answers)} défi{tester.answers > 1 ? "s" : ""} · vu le{" "}
                {shortDay(tester.lastDay)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LatestActions() {
  const { state } = useLoad(fetchActions);
  return (
    <section className={styles.overviewSection}>
      <PanelHead title="Dernières actions de l'équipe">
        <Link href="/admin/journal">Tout le journal</Link>
      </PanelHead>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" &&
        (state.data.actions.length === 0 ? (
          <p className={styles.muted}>Aucune action pour l'instant.</p>
        ) : (
          <ActionsTable actions={state.data.actions.slice(0, ACTIONS_SHOWN)} showTarget />
        ))}
    </section>
  );
}

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function shortDay(day: string): string {
  return DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));
}

function daysLabel(days: number): string {
  return `${formatNumber(days)} jour${days > 1 ? "s" : ""} joué${days > 1 ? "s" : ""}`;
}

export function Stat({
  label,
  value,
  note,
  href,
  pending = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly note?: string;
  readonly href?: string;
  /** Something waits on the team: the figure stands out. */
  readonly pending?: boolean;
}) {
  const body = (
    <>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{formatNumber(value)}</span>
      {note !== undefined && <span className={styles.statNote}>{note}</span>}
    </>
  );
  return href === undefined ? (
    <div className={styles.stat}>{body}</div>
  ) : (
    <Link
      href={href}
      className={styles.stat}
      data-pending={pending || undefined}
      style={{ textDecoration: "none" }}
    >
      {body}
    </Link>
  );
}
