"use client";

import type { AdminWaitlistResponse } from "@leximon/contract";
import { useEffect, useState } from "react";
import styles from "./admin.module.css";
import { adminErrorMessage, downloadWaitlist, fetchWaitlist } from "./admin-api";
import { formatDateTime, formatNumber } from "./format";

type Entry = AdminWaitlistResponse["entries"][number];

export function WaitlistScreen() {
  const [total, setTotal] = useState<number | null>(null);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchWaitlist()
      .then((page) => {
        if (!live) return;
        setTotal(page.total);
        setEntries(page.entries);
        setCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        if (live) setError(adminErrorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, []);

  const more = async () => {
    if (cursor === null) return;
    setBusy(true);
    try {
      const page = await fetchWaitlist(cursor);
      setEntries((current) => [...current, ...page.entries]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await downloadWaitlist();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `liste-attente-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Liste d'attente</h1>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || total === 0}
          onClick={() => void download()}
        >
          Exporter en CSV
        </button>
      </div>
      <p className={styles.muted}>
        Adresses laissées sur la page d'accueil. Chaque export est inscrit au journal.
      </p>
      {error !== null && <p className={styles.error}>{error}</p>}
      {total === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {total !== null && (
        <>
          <p>
            <strong>{formatNumber(total)}</strong> inscrit(s).
          </p>
          {entries.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Adresse</th>
                    <th>Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.email}>
                      <td>{entry.email}</td>
                      <td>{formatDateTime(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cursor !== null && (
            <button
              type="button"
              className={styles.button}
              disabled={busy}
              onClick={() => void more()}
            >
              Afficher plus
            </button>
          )}
        </>
      )}
    </>
  );
}
