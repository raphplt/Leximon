"use client";

import type { AdminFeedback } from "@leximon/contract";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
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
    adminApi
      .fetchFeedback()
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
      const page = await adminApi.fetchFeedback(cursor);
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
      await adminApi.markFeedbackRead(id);
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
                  <td className={styles.mono}>
                    <Screen screen={item.screen} />
                  </td>
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

/** A card report names its card: the link opens the card's page to check what was reported. */
function Screen({ screen }: { readonly screen: string }) {
  const card = /\/carte\/([a-z0-9_-]+)$/.exec(screen)?.[1];
  if (card === undefined) return screen;
  return (
    <a href={`/carte/${card}`} target="_blank" rel="noreferrer">
      {screen}
    </a>
  );
}
