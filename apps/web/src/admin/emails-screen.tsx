"use client";

import type { AdminEmail, AdminEmailKind, AdminEmailsResponse } from "@leximon/contract";
import { colors } from "@leximon/tokens";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { ColumnChart, Legend, SERIES } from "./charts";
import { Kpi, PanelHead } from "./dashboard";
import e from "./emails.module.css";
import { emailTotals, quotaOutlook } from "./emails-model";
import { formatDateTime, formatNumber } from "./format";
import m from "./measures.module.css";
import type { Range } from "./measures-model";
import { dayParam, PeriodPicker } from "./period-picker";

const GREEN = colors.success;

const KIND_LABELS: Readonly<Record<AdminEmailKind, string>> = {
  code: "Code de connexion",
  invitation_only: "Refus bêta fermée",
  news: "Nouvelles",
  reminder: "Rappel",
  campaign: "Campagne",
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  sent: "Envoyé",
  failed: "Échec",
  bounced: "Rejeté",
  complained: "Plainte",
};

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const LONG_DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const MONTH_START_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const USD = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" });

/**
 * Every e-mail the game sends, by kind and by day, and where the month stands against the
 * e-mails Cloudflare includes. The period lives in the address, like the measures.
 */
export function EmailsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const from = dayParam(params.get("du"));
  const to = dayParam(params.get("au"));
  const [data, setData] = useState<AdminEmailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nonce, setNonce] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `nonce` asks for a fresh read.
  useEffect(() => {
    let live = true;
    setBusy(true);
    adminApi
      .fetchEmails({ from, to })
      .then((emails) => {
        if (!live) return;
        setData(emails);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [from, to, nonce]);

  const choose = (range: Range) => {
    router.replace(`${pathname}?du=${range.from}&au=${range.to}`, { scroll: false });
  };

  return (
    <>
      <div className={m.header}>
        <h1 className={styles.title}>E-mails</h1>
        {data !== null && (
          <PeriodPicker
            period={data.period}
            firstDay={null}
            busy={busy}
            onChoose={choose}
            onRefresh={() => setNonce((n) => n + 1)}
          />
        )}
      </div>
      {error !== null && <p className={styles.error}>{error}</p>}
      {data === null ? (
        error === null && <p className={styles.muted}>Chargement…</p>
      ) : (
        <div className={m.dashboard} data-busy={busy}>
          <Quota data={data} />
          <Period data={data} />
          <Recent emails={data.recent} />
        </div>
      )}
    </>
  );
}

const LEVEL_LABELS = {
  ok: "Large",
  watch: "À surveiller",
  over: "Dépassement prévu",
} as const;

function Quota({ data }: { readonly data: AdminEmailsResponse }) {
  const { quota } = data;
  const outlook = quotaOutlook(quota, data.period.today);
  const projectedShare = Math.min(1, outlook.projected / quota.included);
  return (
    <section className={m.panel}>
      <PanelHead
        title="Quota Cloudflare du mois"
        hint={`Codes, refus de la bêta, rappels et nouvelles envoyés depuis le ${MONTH_START_FORMAT.format(asDate(quota.since))}. Les campagnes passent par Lettermint et ne comptent pas ici.`}
      >
        <span className={e.level} data-level={outlook.level}>
          <span aria-hidden="true">{outlook.level === "ok" ? "●" : "▲"}</span>{" "}
          {LEVEL_LABELS[outlook.level]}
        </span>
      </PanelHead>
      <div className={e.quotaLine}>
        <span className={e.quotaValue}>{formatNumber(quota.sent)}</span>
        <span className={e.quotaOf}>sur {formatNumber(quota.included)} inclus</span>
      </div>
      <div
        className={e.meter}
        // The figures just above say the same thing in words.
        aria-hidden="true"
      >
        <div className={e.projected} style={{ width: `${projectedShare * 100}%` }} />
        <div
          className={e.used}
          data-level={outlook.level}
          style={{ width: `${Math.min(1, outlook.used) * 100}%` }}
        />
      </div>
      <ul className={e.facts}>
        <li>
          Au rythme actuel : <strong>~{formatNumber(outlook.projected)}</strong> d'ici la fin du
          mois
          {outlook.overageUsd > 0 && (
            <>
              , soit <strong>{USD.format(outlook.overageUsd)}</strong> de dépassement (0,35 $ les 1
              000)
            </>
          )}
          .
        </li>
        <li>
          Plafond des rappels et nouvelles : {formatNumber(quota.notificationDailyLimit)} par jour.
          S'ils l'atteignaient chaque jour d'ici la fin du mois :{" "}
          <strong>{formatNumber(outlook.ceiling)}</strong> e-mails.
        </li>
        <li>
          Cloudflare compte sur ton cycle de facturation, pas sur le mois civil : le chiffre exact
          est dans Billing → Billable Usage.
        </li>
      </ul>
    </section>
  );
}

function Period({ data }: { readonly data: AdminEmailsResponse }) {
  const totals = emailTotals(data.daily);
  const labels = data.daily.map((day) => day.day);
  const series = [
    {
      key: "sign-in",
      label: "Connexion",
      color: SERIES.blue,
      values: data.daily.map((day) => day.codes + day.invitationOnly),
    },
    {
      key: "notifications",
      label: "Rappels et nouvelles",
      color: SERIES.yellow,
      values: data.daily.map((day) => day.notifications),
    },
    {
      key: "campaigns",
      label: "Campagnes",
      color: GREEN,
      values: data.daily.map((day) => day.campaigns),
    },
  ];
  return (
    <>
      <div className={m.kpis}>
        <Kpi
          label="Codes de connexion"
          value={formatNumber(totals.codes)}
          trend={data.daily.map((day) => day.codes)}
        />
        <Kpi
          label="Refus bêta fermée"
          value={formatNumber(totals.invitationOnly)}
          note="Une adresse sans invitation reçoit ce mot à la place d'un code."
        />
        <Kpi
          label="Rappels et nouvelles"
          value={formatNumber(totals.notifications)}
          trend={data.daily.map((day) => day.notifications)}
          color={SERIES.yellow}
        />
        <Kpi
          label="Campagnes (Lettermint)"
          value={formatNumber(totals.campaigns)}
          trend={data.daily.map((day) => day.campaigns)}
          color={GREEN}
        />
      </div>
      {totals.failed > 0 && (
        <p className={styles.error}>
          {formatNumber(totals.failed)} e-mail{totals.failed > 1 ? "s" : ""} refusé
          {totals.failed > 1 ? "s" : ""} par le fournisseur sur la période : le code d'erreur est
          dans la liste plus bas.
        </p>
      )}
      <section className={m.panel}>
        <PanelHead title="Envois par jour" />
        <Legend items={series.map(({ label, color }) => ({ label, color }))} />
        <ColumnChart
          labels={labels}
          tickLabel={(day) => DAY_FORMAT.format(asDate(day))}
          tooltipTitle={(day) => LONG_DAY_FORMAT.format(asDate(day))}
          series={series}
        />
      </section>
    </>
  );
}

function Recent({ emails }: { readonly emails: readonly AdminEmail[] }) {
  return (
    <section className={m.panel}>
      <PanelHead
        title="Derniers envois"
        hint="Les 50 plus récents de la période. Un code de connexion ne garde pas son adresse."
      />
      {emails.length === 0 ? (
        <p className={styles.muted}>Aucun e-mail sur la période.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Envoyé le</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Pour</th>
                <th>Erreur</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: e-mails have no id of their own here.
                <tr key={`${email.at}-${index}`}>
                  <td className={e.nowrap}>{formatDateTime(email.at)}</td>
                  <td>{KIND_LABELS[email.kind]}</td>
                  <td>
                    <span className={email.status === "sent" ? styles.badge : styles.badgeWarn}>
                      {STATUS_LABELS[email.status] ?? email.status}
                    </span>
                  </td>
                  <td>
                    <Recipient email={email} />
                  </td>
                  <td className={styles.mono}>{email.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Recipient({ email }: { readonly email: AdminEmail }) {
  if (email.userId !== null) {
    return (
      <Link href={`/admin/joueurs/${encodeURIComponent(email.userId)}`}>
        {email.label ?? "Joueur"}
      </Link>
    );
  }
  return <>{email.label ?? "—"}</>;
}
