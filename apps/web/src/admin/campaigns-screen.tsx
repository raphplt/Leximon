"use client";

import type { AdminCampaignSummary, CampaignAudience, CampaignStatus } from "@leximon/contract";
import Link from "next/link";
import { adminApi } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatDateTime, formatNumber } from "./format";
import { useLoad } from "./use-load";

export const AUDIENCE_LABELS: Readonly<Record<CampaignAudience, string>> = {
  waitlist: "Liste d'attente",
  players: "Joueurs inscrits aux nouvelles",
  test: "Adresses de test",
};

export const STATUS_LABELS: Readonly<Record<CampaignStatus, string>> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  sending: "En cours",
  paused: "En pause",
  completed: "Terminée",
  cancelled: "Annulée",
};

export function CampaignsScreen() {
  const { state } = useLoad(adminApi.fetchCampaigns);
  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Campagnes</h1>
        <Link href="/admin/campagnes/nouvelle" className={styles.primary}>
          Nouvelle campagne
        </Link>
      </div>
      <p className={styles.muted}>
        E-mails aux joueurs qui l'ont demandé et à la liste d'attente. Jamais les codes de
        connexion.
      </p>
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" &&
        (state.data.length === 0 ? (
          <p className={styles.muted}>Aucune campagne.</p>
        ) : (
          <CampaignTable campaigns={state.data} />
        ))}
    </>
  );
}

function CampaignTable({ campaigns }: { readonly campaigns: readonly AdminCampaignSummary[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Public</th>
            <th>État</th>
            <th className={styles.num}>Envoyés</th>
            <th className={styles.num}>Destinataires</th>
            <th>Lancée le</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>
                <Link href={`/admin/campagnes/${campaign.id}`}>{campaign.name}</Link>
              </td>
              <td>{AUDIENCE_LABELS[campaign.audience]}</td>
              <td>
                <span className={styles.badge}>{STATUS_LABELS[campaign.status]}</span>
              </td>
              <td className={styles.num}>{formatNumber(campaign.counts.sent)}</td>
              <td className={styles.num}>
                {campaign.recipientCount === null ? "–" : formatNumber(campaign.recipientCount)}
              </td>
              <td>{campaign.launchedAt === null ? "–" : formatDateTime(campaign.launchedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
