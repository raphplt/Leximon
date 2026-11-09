"use client";

import type { AdminPatron, AdminPatronsResponse, PatronSales } from "@leximon/contract";
import { formatEuros } from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { formatDateTime, formatNumber } from "./format";
import { PatronPolls } from "./patron-polls";

const SALES_LABELS: Readonly<Record<PatronSales, string>> = {
  closed: "Vente fermée : seuls les admins peuvent s'abonner, pour essayer le paiement.",
  open: "Vente ouverte.",
  unavailable: "Paiement non configuré : il manque les secrets Stripe sur ce serveur.",
};

const STANDING_LABELS: Readonly<Record<AdminPatron["standing"], string>> = {
  patron: "Mécène",
  none: "Arrêté",
};

/** The subscribers: counts, what they bring a month, and the refund a parent or the law asks for. */
export function PatronsScreen() {
  const [page, setPage] = useState<AdminPatronsResponse | null>(null);
  const [patrons, setPatrons] = useState<readonly AdminPatron[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per subscriber until the server answers: a retried click never refunds twice.
  const refundKeys = useRef(new Map<string, string>());

  const load = useCallback(() => {
    let live = true;
    setError(null);
    adminApi
      .fetchPatrons()
      .then((read) => {
        if (!live) return;
        setPage(read);
        setPatrons(read.patrons);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  const more = async () => {
    if (page?.nextCursor == null) return;
    setBusy(true);
    try {
      const next = await adminApi.fetchPatrons(page.nextCursor);
      setPage(next);
      setPatrons((current) => [...current, ...next.patrons]);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const refund = async (patron: AdminPatron) => {
    const who = patron.email;
    const amount =
      patron.lastPayment === null || patron.lastPayment.refunded
        ? "aucun paiement à rembourser"
        : `${formatEuros(patron.lastPayment.amount)} remboursés`;
    if (!window.confirm(`Arrêter tout de suite l'abonnement de ${who} (${amount}) ?`)) return;
    const key = refundKeys.current.get(patron.userId) ?? crypto.randomUUID();
    refundKeys.current.set(patron.userId, key);
    setBusy(true);
    setNotice(null);
    try {
      const done = await adminApi.refundPatron(patron.userId, key);
      refundKeys.current.delete(patron.userId);
      setNotice(
        done.refunded === 0
          ? "Abonnement arrêté, sans remboursement."
          : `Abonnement arrêté et ${formatEuros(done.refunded)} remboursés.`,
      );
      load();
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Mécènes</h1>
      </div>
      {page !== null && <p className={styles.muted}>{SALES_LABELS[page.sales]}</p>}
      {notice !== null && <p className={styles.success}>{notice}</p>}
      {error !== null && <p className={styles.error}>{error}</p>}
      {page === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {page !== null && (
        <div className={styles.stats}>
          <Figure label="Mécènes" value={formatNumber(page.counts.patrons)} />
          <Figure label="Résiliés, encore en cours" value={formatNumber(page.counts.cancelling)} />
          <Figure label="Paiements refusés" value={formatNumber(page.counts.failing)} />
          <Figure label="Fondateurs" value={formatNumber(page.counts.founders)} />
          <Figure
            label="Revenu par mois"
            value={formatEuros(page.monthlyRevenue)}
            note="Dernier paiement de chacun, un annuel compté pour un douzième."
          />
        </div>
      )}
      {page !== null && patrons.length === 0 && <p className={styles.muted}>Aucun abonné.</p>}
      {patrons.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Statut</th>
                <th>Formule</th>
                <th>Depuis</th>
                <th>Échéance</th>
                <th>Dernier paiement</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patrons.map((patron) => (
                <tr key={patron.userId}>
                  <td>
                    <Link href={`/admin/joueurs/${encodeURIComponent(patron.userId)}`}>
                      {patron.pseudo ?? patron.email}
                    </Link>
                    <br />
                    <span className={styles.muted}>{patron.email}</span>
                  </td>
                  <td>
                    {STANDING_LABELS[patron.standing]}
                    {patron.founder && " · fondateur"}
                    {patron.paymentFailing && (
                      <>
                        <br />
                        <span className={styles.error}>Paiement refusé</span>
                      </>
                    )}
                  </td>
                  <td>
                    {patron.plan === "yearly"
                      ? "Annuel"
                      : patron.plan === "monthly"
                        ? "Mensuel"
                        : "—"}
                  </td>
                  <td>{patron.since === null ? "—" : formatDateTime(patron.since)}</td>
                  <td>
                    {patron.cancelAt !== null
                      ? `s'arrête le ${formatDateTime(patron.cancelAt)}`
                      : patron.currentPeriodEnd === null
                        ? "—"
                        : formatDateTime(patron.currentPeriodEnd)}
                  </td>
                  <td>
                    {patron.lastPayment === null ? (
                      "—"
                    ) : (
                      <>
                        {formatEuros(patron.lastPayment.amount)}
                        {patron.lastPayment.refunded && " (remboursé)"}
                        <br />
                        <span className={styles.muted}>
                          {formatDateTime(patron.lastPayment.paidAt)}
                        </span>
                      </>
                    )}
                  </td>
                  <td>
                    {patron.standing !== "none" && (
                      <button
                        type="button"
                        className={styles.danger}
                        disabled={busy}
                        onClick={() => void refund(patron)}
                      >
                        Rembourser et résilier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page?.nextCursor != null && (
        <button type="button" className={styles.button} disabled={busy} onClick={() => void more()}>
          Afficher plus
        </button>
      )}
      <PatronPolls />
    </>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {note !== undefined && <span className={styles.statNote}>{note}</span>}
    </div>
  );
}
