"use client";

import type { AdminJoustSuspect } from "@leximon/contract";
import Link from "next/link";
import { adminApi } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatNumber } from "./format";
import { useLoad } from "./use-load";

const REASON_LABELS: Readonly<Record<AdminJoustSuspect["reasons"][number], string>> = {
  fast: "Presque toujours juste, en moins de 2 s",
  regular: "Temps de réponse presque identiques",
  flawless: "Aucune erreur sur 50 questions ou plus",
};

const SECONDS = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const seconds = (ms: number) => `${SECONDS.format(ms / 1000)} s`;

/** Jousters whose ranked answers look scripted or looked up: a list to read, not a verdict. */
export function JoustSuspectsScreen() {
  const { state } = useLoad(adminApi.fetchJoustSuspects);

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Joutes à vérifier</h1>
      </div>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" && (
        <>
          <p className={styles.muted}>
            Les jouteurs dont les réponses en joute classée des {state.data.windowDays} derniers
            jours ressemblent à celles d'un script ou d'une recherche dans le catalogue. Rien n'est
            sanctionné d'office : ouvre la fiche du joueur pour décider.
          </p>
          {state.data.suspects.length === 0 ? (
            <p className={styles.muted}>Aucun jouteur à vérifier.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th className={styles.num}>Questions</th>
                    <th className={styles.num}>Réussite</th>
                    <th className={styles.num}>Temps médian</th>
                    <th className={styles.num}>Écart des temps</th>
                    <th>Pourquoi</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.suspects.map((suspect) => (
                    <tr key={suspect.userId}>
                      <td>
                        <Link href={`/admin/joueurs/${encodeURIComponent(suspect.userId)}`}>
                          {suspect.player?.pseudo ??
                            suspect.player?.code ??
                            suspect.userId.slice(0, 8)}
                        </Link>
                        {suspect.banned && <span className={styles.muted}> · banni</span>}
                      </td>
                      <td className={styles.num}>{formatNumber(suspect.served)}</td>
                      <td className={styles.num}>
                        {Math.round((suspect.correct / suspect.served) * 100)} %
                      </td>
                      <td className={styles.num}>{seconds(suspect.medianMs)}</td>
                      <td className={styles.num}>{seconds(suspect.spreadMs)}</td>
                      <td>
                        {suspect.reasons.map((reason) => (
                          <div key={reason}>{REASON_LABELS[reason]}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
