"use client";

import type { AdminAction } from "@leximon/contract";
import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import styles from "./admin.module.css";
import { ActionsTable } from "./player-screen";

export function JournalScreen() {
  const [actions, setActions] = useState<readonly AdminAction[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi
      .fetchActions()
      .then((page) => {
        if (!live) return;
        setActions(page.actions);
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
      const page = await adminApi.fetchActions(cursor);
      setActions((current) => [...(current ?? []), ...page.actions]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className={styles.title}>Journal</h1>
      <p className={styles.muted}>Toutes les actions de l'équipe, les plus récentes d'abord.</p>
      {error !== null && <p className={styles.error}>{error}</p>}
      {actions === null && error === null && <p className={styles.muted}>Chargement…</p>}
      {actions !== null && <ActionsTable actions={actions} showTarget />}
      {cursor !== null && (
        <button type="button" className={styles.button} disabled={busy} onClick={() => void more()}>
          Afficher plus
        </button>
      )}
    </>
  );
}
