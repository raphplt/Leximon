"use client";

import type { AdminWaitlistOpening, AdminWaitlistResponse } from "@leximon/contract";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { STATUS_LABELS } from "./campaigns-screen";
import { formatDateTime, formatNumber } from "./format";

type Entry = AdminWaitlistResponse["entries"][number];

export function WaitlistScreen() {
  const [total, setTotal] = useState<number | null>(null);
  const [opening, setOpening] = useState<AdminWaitlistOpening | null>(null);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi
      .fetchWaitlist()
      .then((page) => {
        if (!live) return;
        setTotal(page.total);
        setOpening(page.opening);
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
      const page = await adminApi.fetchWaitlist(cursor);
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
      const blob = await adminApi.downloadWaitlist();
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
      {opening !== null && total !== null && (
        <OpeningPanel
          opening={opening}
          total={total}
          onErased={(erasedAt) => {
            setTotal(0);
            setEntries([]);
            setCursor(null);
            setOpening({ ...opening, erasedAt });
          }}
        />
      )}
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

/** The opening e-mail: the list is closed, then erased once the e-mail has left. */
function OpeningPanel({
  opening,
  total,
  onErased,
}: {
  readonly opening: AdminWaitlistOpening;
  readonly total: number;
  readonly onErased: (erasedAt: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [count, setCount] = useState(total);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = opening.status === "completed" || opening.status === "cancelled";

  const erase = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi.eraseWaitlist(count);
      if (result.kind === "count_changed") {
        setCount(result.count);
        setTyped("");
        setError(
          `Le nombre a changé : ${formatNumber(result.count)} adresse(s). Confirme ce nombre.`,
        );
        return;
      }
      onErased(new Date().toISOString());
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.subtitle}>Liste fermée</h2>
      <p className={styles.muted}>
        L'e-mail d'ouverture est lancé :{" "}
        <Link href={`/admin/campagnes/${opening.campaignId}`}>
          {STATUS_LABELS[opening.status].toLowerCase()}
        </Link>
        . Plus aucune inscription, plus aucun second envoi.
      </p>
      {opening.erasedAt !== null ? (
        <p>Adresses effacées le {formatDateTime(opening.erasedAt)}.</p>
      ) : !sent ? (
        <p className={styles.muted}>L'effacement s'ouvre quand l'envoi est fini.</p>
      ) : (
        <form className={styles.form} onSubmit={(event) => void erase(event)}>
          <p>
            Effacer les {formatNumber(count)} adresse(s) de la liste. Les désinscriptions restent.
            Pas de retour en arrière.
          </p>
          <div className={styles.row}>
            <label className={styles.field}>
              Tape {formatNumber(count)} pour confirmer
              <input
                className={styles.input}
                inputMode="numeric"
                value={typed}
                onChange={(event) => setTyped(event.target.value.replace(/\s/g, ""))}
              />
            </label>
            <button
              type="submit"
              className={styles.danger}
              disabled={busy || typed !== String(count)}
            >
              Effacer la liste
            </button>
          </div>
          {error !== null && <p className={styles.error}>{error}</p>}
        </form>
      )}
    </section>
  );
}
