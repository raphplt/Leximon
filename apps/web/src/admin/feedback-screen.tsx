"use client";

import type { AdminFeedback } from "@leximon/contract";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./admin.module.css";
import { adminErrorMessage, fetchFeedback, markFeedbackRead } from "./admin-api";
import { formatDateTime, formatNumber } from "./format";

/** Testers' notes, written from the game (« Un retour ? » in the player's menu). */
export function FeedbackScreen() {
  const [items, setItems] = useState<readonly AdminFeedback[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchFeedback()
      .then((page) => {
        if (!live) return;
        setItems(page.feedback);
        setUnread(page.unread);
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
      const page = await fetchFeedback(cursor);
      setItems((current) => [...current, ...page.feedback]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const read = async (id: string) => {
    try {
      await markFeedbackRead(id);
      const at = new Date().toISOString();
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, readAt: at } : item)),
      );
      setUnread((count) => (count === null ? count : Math.max(0, count - 1)));
    } catch (caught) {
      setError(adminErrorMessage(caught));
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Retours</h1>
      </div>
      <p className={styles.muted}>
        Écrits depuis le menu du joueur, avec l'écran d'où ils viennent. Lus par l'équipe seule.
      </p>
      {error !== null && <p className={styles.error}>{error}</p>}
      {unread === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {unread !== null && (
        <p>
          <strong>{formatNumber(unread)}</strong> non lu(s).
        </p>
      )}
      {items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Le</th>
                <th>Joueur</th>
                <th>Écran</th>
                <th>Retour</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <Link href={`/admin/joueurs/${encodeURIComponent(item.userId)}`}>
                      {item.email ?? "Invité"}
                    </Link>
                  </td>
                  <td className={styles.mono}>{item.screen}</td>
                  <td
                    style={{ whiteSpace: "pre-wrap", fontWeight: item.readAt === null ? 700 : 400 }}
                  >
                    {item.body}
                  </td>
                  <td>
                    {item.readAt === null && (
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => void read(item.id)}
                      >
                        Lu
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
