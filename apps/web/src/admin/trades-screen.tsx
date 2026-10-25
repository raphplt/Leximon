"use client";

import { type AdminTrade, type TradeStatus, tradeStatusSchema } from "@leximon/contract";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import { Select } from "@/components/select";
import styles from "./admin.module.css";
import { formatDateTime } from "./format";

const STATUS_LABELS: Readonly<Record<TradeStatus, string>> = {
  pending: "En attente",
  completed: "Conclu",
  declined: "Refusé",
  cancelled: "Annulé",
  expired: "Expiré",
};

export function TradesScreen() {
  const [status, setStatus] = useState<TradeStatus | undefined>("pending");
  const [trades, setTrades] = useState<readonly AdminTrade[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setTrades(null);
    setError(null);
    adminApi
      .fetchTrades(status === undefined ? {} : { status })
      .then((page) => {
        if (!live) return;
        setTrades(page.trades);
        setCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, [status]);
  useEffect(() => load(), [load]);

  const more = async () => {
    if (cursor === null) return;
    setBusy(true);
    try {
      const page = await adminApi.fetchTrades(
        status === undefined ? { cursor } : { status, cursor },
      );
      setTrades((current) => [...(current ?? []), ...page.trades]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (trade: AdminTrade) => {
    const reason = window.prompt("Motif de l'annulation (inscrit au journal) :");
    if (reason === null || reason.trim() === "") return;
    setBusy(true);
    setNotice(null);
    try {
      await adminApi.cancelTrade(trade.id, reason.trim());
      setNotice("Échange annulé.");
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
        <h1 className={styles.title}>Échanges</h1>
        <Select
          value={status ?? ""}
          onChange={(val) => {
            const parsed = tradeStatusSchema.safeParse(val);
            setStatus(parsed.success ? parsed.data : undefined);
          }}
          ariaLabel="Statut"
          options={[
            { value: "", label: "Tous" },
            ...tradeStatusSchema.options.map((option) => ({
              value: option,
              label: STATUS_LABELS[option],
            })),
          ]}
        />
      </div>
      {notice !== null && <p className={styles.success}>{notice}</p>}
      {error !== null && <p className={styles.error}>{error}</p>}
      {trades === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {trades !== null && trades.length === 0 && <p className={styles.muted}>Aucun échange.</p>}
      {trades !== null && trades.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Proposé le</th>
                <th>De</th>
                <th>À</th>
                <th>Donne</th>
                <th>Demande</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{formatDateTime(trade.createdAt)}</td>
                  <td>
                    <Party party={trade.proposer} />
                  </td>
                  <td>
                    <Party party={trade.recipient} />
                  </td>
                  <td className={styles.mono}>{trade.give.join(", ")}</td>
                  <td className={styles.mono}>{trade.want.join(", ")}</td>
                  <td>
                    {STATUS_LABELS[trade.status]}
                    <br />
                    <span className={styles.muted}>
                      {trade.resolvedAt === null
                        ? `expire le ${formatDateTime(trade.expiresAt)}`
                        : `le ${formatDateTime(trade.resolvedAt)}`}
                    </span>
                  </td>
                  <td>
                    {trade.status === "pending" && (
                      <button
                        type="button"
                        className={styles.danger}
                        disabled={busy}
                        onClick={() => void cancel(trade)}
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor !== null && (
        <button type="button" className={styles.button} disabled={busy} onClick={() => void more()}>
          Afficher plus
        </button>
      )}
    </>
  );
}

function Party({ party }: { readonly party: AdminTrade["proposer"] }) {
  return (
    <Link href={`/admin/joueurs/${encodeURIComponent(party.id)}`}>
      {party.email ?? party.playerCode ?? party.id.slice(0, 8)}
    </Link>
  );
}
