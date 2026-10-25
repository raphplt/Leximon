"use client";

import Link from "next/link";
import { adminApi } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatNumber } from "./format";
import { useLoad } from "./use-load";

export function OverviewScreen() {
  const { state, reload } = useLoad(adminApi.fetchOverview);
  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Tableau de bord</h1>
        <button type="button" className={styles.button} onClick={reload}>
          Actualiser
        </button>
      </div>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && (
        <>
          <h2 className={styles.subtitle}>Joueurs</h2>
          <div className={styles.stats}>
            <Stat
              label="Comptes"
              value={state.data.players.members}
              note={`+${formatNumber(state.data.players.newMembers7d)} en 7 jours`}
              href="/admin/joueurs"
            />
            <Stat
              label="Invités"
              value={state.data.players.guests}
              note={`+${formatNumber(state.data.players.newGuests7d)} en 7 jours`}
              href="/admin/joueurs?kind=guest"
            />
            <Stat
              label="Bannis"
              value={state.data.players.banned}
              href="/admin/joueurs?kind=banned"
            />
            <Stat
              label="Liste d'attente"
              value={state.data.waitlist.total}
              note={`+${formatNumber(state.data.waitlist.last7d)} en 7 jours`}
              href="/admin/attente"
            />
          </div>
          <h2 className={styles.subtitle}>Activité</h2>
          <div className={styles.stats}>
            <Stat label="Plis ouverts (24 h)" value={state.data.boosters.last24h} />
            <Stat label="Plis ouverts (7 jours)" value={state.data.boosters.last7d} />
            <Stat label="Réponses aux défis (24 h)" value={state.data.answers.last24h} />
            <Stat label="Réponses aux défis (7 jours)" value={state.data.answers.last7d} />
            <Stat
              label="Échanges en attente"
              value={state.data.trades.pending}
              href="/admin/echanges"
            />
            <Stat label="Échanges conclus (7 jours)" value={state.data.trades.completed7d} />
          </div>
        </>
      )}
    </>
  );
}

export function Stat({
  label,
  value,
  note,
  href,
}: {
  readonly label: string;
  readonly value: number;
  readonly note?: string;
  readonly href?: string;
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
    <Link href={href} className={styles.stat} style={{ textDecoration: "none" }}>
      {body}
    </Link>
  );
}
